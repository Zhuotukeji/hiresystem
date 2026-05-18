import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiList } from "../api/client";
import { Candidate, CandidateEvaluation, Job, ResumeEvaluationResponse, ResumeParseResult } from "../api/types";
import { canDeleteResource } from "../domain/permissions";
import { getCandidateAiSubmitBlocker, hasResumeInput } from "../domain/candidateAi";
import { useCurrentPermissions } from "../hooks/useCurrentUser";
import { PageHeader } from "../ui/PageHeader";
import { ScoreTag } from "../ui/ScoreTag";

type CandidateFormValues = {
  jobId?: string;
  name: string;
  city?: string;
  currentCompanyName?: string;
  currentTitle?: string;
  currentLevel?: string;
  yearsOfExperience?: number | null;
  expectedSalary?: string;
  currentSalary?: string;
  availability?: string;
  jobIntention?: string;
  educationSummary?: string;
  phone?: string;
  email?: string;
  wechat?: string;
  sourceChannel?: string;
  tags?: string;
  resumeText?: string;
  aiSummary?: string;
};

type AiEvaluationUiStatus = "idle" | "evaluating" | "completed" | "failed";

export function CandidatesPage() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("ai");
  const [manualForm] = Form.useForm<CandidateFormValues>();
  const [aiForm] = Form.useForm<CandidateFormValues>();
  const [resumeFileList, setResumeFileList] = useState<UploadFile[]>([]);
  const [parsedResume, setParsedResume] = useState<ResumeParseResult | null>(null);
  const [latestEvaluation, setLatestEvaluation] = useState<ResumeEvaluationResponse | null>(null);
  const [createdCandidate, setCreatedCandidate] = useState<Candidate | null>(null);
  const [aiEvaluationStatus, setAiEvaluationStatus] = useState<AiEvaluationUiStatus>("idle");
  const [aiEvaluationError, setAiEvaluationError] = useState("");
  const queryClient = useQueryClient();
  const permissions = useCurrentPermissions();

  const { data, isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => api.get<ApiList<Candidate>>("/candidates")
  });

  const jobsQuery = useQuery({
    queryKey: ["jobs", "open-for-candidate-ai"],
    queryFn: () => api.get<ApiList<Job>>("/jobs?status=OPEN")
  });

  const createdCandidateQuery = useQuery({
    queryKey: ["candidate", createdCandidate?.id, "ai-evaluation-poll"],
    queryFn: () => api.get<Candidate>(`/candidates/${createdCandidate?.id}`),
    enabled: Boolean(createdCandidate?.id && aiEvaluationStatus === "evaluating"),
    refetchInterval: aiEvaluationStatus === "evaluating" ? 3000 : false
  });

  const jobOptions = useMemo(
    () =>
      (jobsQuery.data?.items ?? []).map((job) => ({
        value: job.id,
        label: `${job.title}${job.department ? ` / ${job.department}` : ""}${job.priority ? ` / ${job.priority}` : ""}`
      })),
    [jobsQuery.data?.items]
  );

  const resumeTextWatch = Form.useWatch("resumeText", aiForm);
  const aiJobId = Form.useWatch("jobId", aiForm);
  const aiName = Form.useWatch("name", aiForm);
  const aiSubmitBlocker = getCandidateAiSubmitBlocker({
    jobId: aiJobId,
    name: aiName,
    resumeParsed: Boolean(parsedResume)
  });

  const createMutation = useMutation({
    mutationFn: (values: CandidateFormValues) => api.post<Candidate>("/candidates", toCandidatePayload(values)),
    onSuccess: () => {
      message.success("候选人已创建");
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "创建失败")
  });

  const parseResumeMutation = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      const uploadedFile = resumeFileList[0]?.originFileObj;
      if (uploadedFile) formData.append("resume", uploadedFile);
      if (resumeTextWatch?.trim()) formData.append("resumeText", resumeTextWatch.trim());
      return api.postForm<{ status: string; result: ResumeParseResult }>("/ai/resume-parse", formData);
    },
    onSuccess: ({ result }) => {
      setParsedResume(result);
      setLatestEvaluation(null);
      setCreatedCandidate(null);
      setAiEvaluationStatus("idle");
      setAiEvaluationError("");
      aiForm.setFieldsValue({
        ...result,
        yearsOfExperience: result.yearsOfExperience ?? undefined,
        sourceChannel: result.sourceChannel || "简历上传",
        tags: result.tags.join(", ")
      });
      message.success("简历已识别，请确认候选人信息");
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "简历识别失败")
  });

  const createAndEvaluateMutation = useMutation({
    mutationFn: async () => {
      const values = await aiForm.validateFields();
      const blocker = getCandidateAiSubmitBlocker({
        jobId: values.jobId,
        name: values.name,
        resumeParsed: Boolean(parsedResume)
      });
      if (blocker) throw new Error(blocker);

      const candidate = await api.post<Candidate>("/candidates", toCandidatePayload(values));
      return { candidate, jobId: values.jobId as string };
    },
    onSuccess: ({ candidate, jobId }) => {
      setCreatedCandidate(candidate);
      setLatestEvaluation(null);
      setAiEvaluationError("");
      setAiEvaluationStatus("evaluating");
      message.success("候选人已保存，AI 判断已开始");
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      evaluateCandidateMutation.mutate({ candidateId: candidate.id, jobId });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "保存失败")
  });

  const evaluateCandidateMutation = useMutation({
    mutationFn: ({ candidateId, jobId }: { candidateId: string; jobId: string }) =>
      api.post<ResumeEvaluationResponse>("/ai/resume-evaluations", { candidateId, jobId, mode: "async" }),
    onSuccess: (evaluation) => {
      if (evaluation.result) {
        setLatestEvaluation(evaluation);
        setAiEvaluationStatus("completed");
        message.success(`AI 判断已完成：${evaluation.status}`);
      } else {
        setAiEvaluationStatus("evaluating");
        message.success("AI 判断已开始");
      }
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (error) => {
      setAiEvaluationStatus("failed");
      setAiEvaluationError(error instanceof Error ? error.message : "AI 判断失败");
      message.error(error instanceof Error ? error.message : "AI 判断失败");
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/candidates/${id}`),
    onSuccess: () => {
      message.success("候选人已删除");
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "删除失败")
  });

  const canDeleteCandidate = canDeleteResource(permissions.data, "CANDIDATE");

  useEffect(() => {
    if (aiEvaluationStatus !== "evaluating") return;
    const evaluation = createdCandidateQuery.data?.evaluations?.[0];
    if (!evaluation) return;

    setLatestEvaluation(evaluationToResponse(evaluation));
    setAiEvaluationStatus("completed");
    message.success("AI 判断已完成");
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
  }, [aiEvaluationStatus, createdCandidateQuery.data?.evaluations, queryClient]);

  function closeModal() {
    setOpen(false);
    setActiveTab("ai");
    manualForm.resetFields();
    aiForm.resetFields();
    setResumeFileList([]);
    setParsedResume(null);
    setLatestEvaluation(null);
    setCreatedCandidate(null);
    setAiEvaluationStatus("idle");
    setAiEvaluationError("");
  }

  return (
    <div className="page">
      <PageHeader
        title="候选人库"
        desc="统一沉淀 BOSS、目标公司、内推和主动寻访候选人。"
        actions={
          <Button type="primary" onClick={() => setOpen(true)}>
            新增候选人
          </Button>
        }
      />
      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items ?? []}
          columns={[
            { title: "姓名", dataIndex: "name", render: (text, record) => <Link to={`/candidates/${record.id}`}>{text}</Link> },
            { title: "当前公司", dataIndex: "currentCompanyName" },
            { title: "职位", dataIndex: "currentTitle" },
            { title: "城市", dataIndex: "city" },
            { title: "年限", dataIndex: "yearsOfExperience" },
            { title: "状态", dataIndex: "status" },
            {
              title: "最新判断",
              render: (_, record) => {
                const latest = record.evaluations?.[0];
                return <ScoreTag level={latest?.level} score={latest?.matchScore} />;
              }
            },
            {
              title: "标签",
              render: (_, record) => (
                <Space wrap>
                  {(record.tags ?? []).slice(0, 4).map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>
              )
            },
            {
              title: "操作",
              render: (_, record) =>
                canDeleteCandidate ? (
                  <Popconfirm
                    title="确认删除该候选人？"
                    description="关联的面试、评估和应聘记录会一起删除。"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => deleteMutation.mutate(record.id)}
                  >
                    <Button danger size="small">
                      删除
                    </Button>
                  </Popconfirm>
                ) : null
            }
          ]}
        />
      </Card>

      <Modal title="新增候选人" open={open} onCancel={closeModal} width={960} footer={null} destroyOnClose>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "ai",
              label: "AI 识别简历",
              children: (
                <Space direction="vertical" size="large" style={{ width: "100%" }}>
                  <Alert
                    type="info"
                    showIcon
                    message="先选择目标岗位，再上传简历。系统会识别候选人信息，并基于该岗位判断是否建议进入 HR 初试。"
                  />
                  <Form layout="vertical" form={aiForm}>
                    <Form.Item label="目标岗位" name="jobId" rules={[{ required: true, message: "请选择目标岗位" }]}>
                      <Select
                        showSearch
                        loading={jobsQuery.isLoading}
                        placeholder="选择要匹配判断的开放岗位"
                        optionFilterProp="label"
                        options={jobOptions}
                      />
                    </Form.Item>
                    <Form.Item label="上传简历">
                      <Upload
                        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        beforeUpload={() => false}
                        fileList={resumeFileList}
                        maxCount={1}
                        onChange={({ fileList }) => setResumeFileList(fileList.slice(-1))}
                        onRemove={() => {
                          setResumeFileList([]);
                          return true;
                        }}
                      >
                        <Button icon={<UploadOutlined />}>选择 PDF / DOCX / TXT</Button>
                      </Upload>
                    </Form.Item>
                    <Form.Item label="简历文本" name="resumeText">
                      <Input.TextArea rows={6} placeholder="也可以直接粘贴简历文本；上传文件和粘贴文本二选一即可。" />
                    </Form.Item>
                    <Button
                      icon={<UploadOutlined />}
                      loading={parseResumeMutation.isPending}
                      disabled={!hasResumeInput(resumeFileList.length, resumeTextWatch)}
                      onClick={() => parseResumeMutation.mutate()}
                    >
                      AI识别并填入
                    </Button>

                    <Divider />
                    <CandidateFields />
                    <Form.Item label="标签" name="tags">
                      <Input placeholder="HRBP, 组织发展, 绩效管理" />
                    </Form.Item>
                    <Form.Item label="AI 摘要" name="aiSummary">
                      <Input.TextArea rows={3} />
                    </Form.Item>
                  </Form>

                  <AiEvaluationStatusAlert
                    status={aiEvaluationStatus}
                    responseStatus={latestEvaluation?.status}
                    interviewKitStatus={latestEvaluation?.interview_kit_status}
                    candidate={createdCandidate}
                    error={aiEvaluationError}
                  />

                  {latestEvaluation?.result ? (
                    <EvaluationResult response={latestEvaluation} candidate={createdCandidate} />
                  ) : null}

                  <Space style={{ width: "100%", justifyContent: "flex-end" }}>
                    <Button onClick={closeModal}>取消</Button>
                    <Button
                      type="primary"
                      loading={createAndEvaluateMutation.isPending}
                      disabled={Boolean(aiSubmitBlocker) || Boolean(createdCandidate) || aiEvaluationStatus === "evaluating"}
                      onClick={() => createAndEvaluateMutation.mutate()}
                    >
                      保存并判断是否进入HR初试
                    </Button>
                  </Space>
                  {aiSubmitBlocker ? <Typography.Text type="secondary">{aiSubmitBlocker}</Typography.Text> : null}
                </Space>
              )
            },
            {
              key: "manual",
              label: "手动新增",
              children: (
                <Form
                  layout="vertical"
                  form={manualForm}
                  onFinish={(values) => createMutation.mutate(values)}
                >
                  <CandidateFields />
                  <Form.Item label="标签" name="tags">
                    <Input placeholder="Java, 交易系统, 目标公司" />
                  </Form.Item>
                  <Form.Item label="简历文本" name="resumeText">
                    <Input.TextArea rows={8} />
                  </Form.Item>
                  <Space style={{ width: "100%", justifyContent: "flex-end" }}>
                    <Button onClick={closeModal}>取消</Button>
                    <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                      创建候选人
                    </Button>
                  </Space>
                </Form>
              )
            }
          ]}
        />
      </Modal>
    </div>
  );
}

function CandidateFields() {
  return (
    <div className="grid grid-2">
      <Form.Item label="姓名" name="name" rules={[{ required: true, message: "请填写候选人姓名" }]}>
        <Input />
      </Form.Item>
      <Form.Item label="城市" name="city">
        <Input />
      </Form.Item>
      <Form.Item label="当前公司" name="currentCompanyName">
        <Input />
      </Form.Item>
      <Form.Item label="当前职位" name="currentTitle">
        <Input />
      </Form.Item>
      <Form.Item label="职级" name="currentLevel">
        <Input />
      </Form.Item>
      <Form.Item label="工作年限" name="yearsOfExperience">
        <InputNumber min={0} max={50} style={{ width: "100%" }} />
      </Form.Item>
      <Form.Item label="期望薪资" name="expectedSalary">
        <Input />
      </Form.Item>
      <Form.Item label="当前薪资" name="currentSalary">
        <Input />
      </Form.Item>
      <Form.Item label="到岗时间" name="availability">
        <Input />
      </Form.Item>
      <Form.Item label="求职意向" name="jobIntention">
        <Input />
      </Form.Item>
      <Form.Item label="手机号码" name="phone">
        <Input />
      </Form.Item>
      <Form.Item label="邮箱" name="email">
        <Input />
      </Form.Item>
      <Form.Item label="微信" name="wechat">
        <Input />
      </Form.Item>
      <Form.Item label="来源渠道" name="sourceChannel">
        <Input />
      </Form.Item>
      <Form.Item label="学历摘要" name="educationSummary">
        <Input />
      </Form.Item>
    </div>
  );
}

function AiEvaluationStatusAlert({
  status,
  responseStatus,
  interviewKitStatus,
  candidate,
  error
}: {
  status: AiEvaluationUiStatus;
  responseStatus?: string;
  interviewKitStatus?: string;
  candidate: Candidate | null;
  error: string;
}) {
  if (status === "idle") return null;

  if (status === "evaluating") {
    return (
      <Alert
        type="info"
        showIcon
        message="AI判断中..."
        description={
          <Space direction="vertical" size={4}>
            <Typography.Text>候选人已保存，系统正在异步判断是否进入下一阶段。</Typography.Text>
            {candidate ? <Link to={`/candidates/${candidate.id}`}>查看候选人详情</Link> : null}
          </Space>
        }
      />
    );
  }

  if (status === "failed") {
    return (
      <Alert
        type="warning"
        showIcon
        message="AI判断失败"
        description={
          <Space direction="vertical" size={4}>
            <Typography.Text>{error || "候选人已保存，但 AI 判断没有完成。"}</Typography.Text>
            {candidate ? <Link to={`/candidates/${candidate.id}`}>进入候选人详情页后可重新触发 AI 简历判定</Link> : null}
          </Space>
        }
      />
    );
  }

  return (
    <Alert
      type="success"
      showIcon
      message="AI判断完成"
      description={
        <Space direction="vertical" size={4}>
          <Typography.Text>
            响应状态：{responseStatus ?? "completed"}
            {interviewKitStatus ? `，初面套件：${interviewKitStatus}` : ""}
          </Typography.Text>
          {candidate ? <Link to={`/candidates/${candidate.id}`}>查看候选人详情</Link> : null}
        </Space>
      }
    />
  );
}

function EvaluationResult({
  response,
  candidate
}: {
  response: ResumeEvaluationResponse;
  candidate: Candidate | null;
}) {
  const result = response.result;
  if (!result) return null;

  return (
    <Alert
      type={result.level === "green" ? "success" : result.level === "red" ? "warning" : "info"}
      showIcon
      message={
        <Space>
          <span>AI 判定完成</span>
          <ScoreTag level={result.level} score={result.match_score} />
          {candidate ? <Link to={`/candidates/${candidate.id}`}>查看候选人详情</Link> : null}
        </Space>
      }
      description={
        <Space direction="vertical" size={6}>
          <Typography.Text>{result.summary}</Typography.Text>
          {result.suggested_next_step ? <Typography.Text>建议下一步：{result.suggested_next_step}</Typography.Text> : null}
          {result.risks?.length ? <Typography.Text type="warning">风险点：{result.risks.join("；")}</Typography.Text> : null}
          {result.questions_to_confirm?.length ? (
            <Typography.Text type="secondary">待确认：{result.questions_to_confirm.join("；")}</Typography.Text>
          ) : null}
        </Space>
      }
    />
  );
}

function evaluationToResponse(evaluation: CandidateEvaluation): ResumeEvaluationResponse {
  return {
    evaluation_id: evaluation.id,
    status: "completed",
    result: {
      match_score: evaluation.matchScore,
      level: evaluation.level,
      recommendation: evaluation.recommendation,
      summary: evaluation.summary,
      reasons: evaluation.reasons,
      risks: evaluation.risks,
      questions_to_confirm: evaluation.questionsToConfirm,
      suggested_next_step: evaluation.suggestedNextStep
    }
  };
}

function toCandidatePayload(values: CandidateFormValues) {
  const { jobId, tags, yearsOfExperience, ...candidate } = values;
  return {
    ...candidate,
    yearsOfExperience: yearsOfExperience ?? undefined,
    tags: split(tags)
  };
}

function split(value?: string | string[]) {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  return value
    ? value
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
