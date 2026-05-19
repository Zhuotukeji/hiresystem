import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  message
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Application, Interview, InterviewKit, Job } from "../api/types";
import { AiJdAssistant } from "../components/AiJdAssistant";
import { interviewStageLabel, interviewStatusLabel, jobStatusLabel } from "../domain/labels";
import { pipelineStages, stageLabel, stageToKitStage } from "../domain/stages";
import { PageHeader } from "../ui/PageHeader";
import { ScoreTag } from "../ui/ScoreTag";

export function JobDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.get<Job>(`/jobs/${id}`),
    enabled: Boolean(id)
  });

  return (
    <div className="page">
      <PageHeader title={job?.title ?? "岗位详情"} desc={`${job?.department ?? "未设置部门"} · ${job?.city ?? "不限城市"}`} />
      <Tabs
        items={[
          {
            key: "overview",
            label: "概览",
            children: (
              <Card loading={isLoading}>
                <Descriptions column={2}>
                  <Descriptions.Item label="优先级">{job?.priority}</Descriptions.Item>
                  <Descriptions.Item label="状态">{jobStatusLabel(job?.status)}</Descriptions.Item>
                  <Descriptions.Item label="HC">{job?.headcount}</Descriptions.Item>
                  <Descriptions.Item label="薪资">
                    {job?.salaryMin || job?.salaryMax ? `${job?.salaryMin ?? "-"}-${job?.salaryMax ?? "-"}` : "-"}
                  </Descriptions.Item>
                </Descriptions>
                <Typography.Title level={5}>JD</Typography.Title>
                <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{job?.jd ?? "暂无JD"}</Typography.Paragraph>
              </Card>
            )
          },
          {
            key: "profile",
            label: "岗位画像卡",
            children: job ? <JobProfileForm job={job} onSaved={() => queryClient.invalidateQueries({ queryKey: ["job", id] })} /> : null
          },
          {
            key: "ai-jd",
            label: "AI JD助手",
            children: job ? (
              <AiJdAssistant
                jobId={job.id}
                initialJd={job.jd}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ["job", id] })}
              />
            ) : null
          },
          {
            key: "pipeline",
            label: "流程看板",
            children: <Pipeline applications={job?.applications ?? []} jobId={id!} />
          }
        ]}
      />
    </div>
  );
}

function JobProfileForm({ job, onSaved }: { job: Job; onSaved: () => void }) {
  const [form] = Form.useForm();
  const mutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      api.put(`/jobs/${job.id}/profile`, {
        ...values,
        mustHaveSkills: split(values.mustHaveSkills),
        niceToHaveSkills: split(values.niceToHaveSkills),
        targetCompanies: split(values.targetCompanies),
        excludedCompanies: split(values.excludedCompanies),
        targetTitles: split(values.targetTitles),
        targetLevels: split(values.targetLevels),
        keyProjectExperience: split(values.keyProjectExperience),
        knockoutRules: split(values.knockoutRules),
        flexibleRules: split(values.flexibleRules),
        screeningQuestions: split(values.screeningQuestions),
        interviewDimensions: split(values.interviewDimensions)
      }),
    onSuccess: () => {
      message.success("岗位画像已保存");
      onSaved();
    }
  });

  const profile = job.profile;
  return (
    <Card>
      <Form
        layout="vertical"
        form={form}
        initialValues={{
          mission: profile?.mission,
          mustHaveSkills: join(profile?.mustHaveSkills),
          niceToHaveSkills: join(profile?.niceToHaveSkills),
          targetCompanies: join(profile?.targetCompanies),
          excludedCompanies: join(profile?.excludedCompanies),
          targetTitles: join(profile?.targetTitles),
          targetLevels: join(profile?.targetLevels),
          keyProjectExperience: join(profile?.keyProjectExperience),
          knockoutRules: join(profile?.knockoutRules),
          flexibleRules: join(profile?.flexibleRules),
          screeningQuestions: join(profile?.screeningQuestions),
          interviewDimensions: join(profile?.interviewDimensions),
          passScore: profile?.passScore ?? 75,
          yellowScoreMin: profile?.yellowScoreMin ?? 60,
          yellowScoreMax: profile?.yellowScoreMax ?? 74
        }}
        onFinish={(values) => mutation.mutate(values)}
      >
        <Form.Item label="岗位使命" name="mission">
          <Input.TextArea rows={3} />
        </Form.Item>
        <div className="grid grid-2">
          <Form.Item label="必须技能" name="mustHaveSkills">
            <Input placeholder="逗号分隔" />
          </Form.Item>
          <Form.Item label="加分技能" name="niceToHaveSkills">
            <Input placeholder="逗号分隔" />
          </Form.Item>
          <Form.Item label="目标公司" name="targetCompanies">
            <Input placeholder="逗号分隔" />
          </Form.Item>
          <Form.Item label="排除公司" name="excludedCompanies">
            <Input placeholder="逗号分隔" />
          </Form.Item>
          <Form.Item label="目标职位" name="targetTitles">
            <Input placeholder="逗号分隔" />
          </Form.Item>
          <Form.Item label="目标职级" name="targetLevels">
            <Input placeholder="逗号分隔" />
          </Form.Item>
        </div>
        <Form.Item label="关键项目经验" name="keyProjectExperience">
          <Input.TextArea rows={3} placeholder="逗号或换行分隔" />
        </Form.Item>
        <Form.Item label="直接淘汰规则" name="knockoutRules">
          <Input.TextArea rows={3} placeholder="逗号或换行分隔" />
        </Form.Item>
        <Form.Item label="HR 初筛问题" name="screeningQuestions">
          <Input.TextArea rows={3} placeholder="逗号或换行分隔" />
        </Form.Item>
        <Form.Item label="面试评估维度" name="interviewDimensions">
          <Input placeholder="技术深度, 项目复杂度, 业务理解, 沟通协作" />
        </Form.Item>
        <Space>
          <Form.Item label="通过线" name="passScore">
            <InputNumber min={0} max={100} />
          </Form.Item>
          <Form.Item label="黄区下限" name="yellowScoreMin">
            <InputNumber min={0} max={100} />
          </Form.Item>
          <Form.Item label="黄区上限" name="yellowScoreMax">
            <InputNumber min={0} max={100} />
          </Form.Item>
        </Space>
        <Button type="primary" htmlType="submit" loading={mutation.isPending}>
          保存画像
        </Button>
      </Form>
    </Card>
  );
}

function Pipeline({ applications, jobId }: { applications: Application[]; jobId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [preparingApplicationId, setPreparingApplicationId] = useState<string>();
  const preparingApplication = applications.find((application) => application.id === preparingApplicationId);
  const updateStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.patch(`/applications/${id}`, { stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", jobId] })
  });
  const generateKit = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      api.post<{ status: string; ai_status?: string; ai_error?: string }>("/ai/interview-kits", { applicationId: id, stage }),
    onSuccess: (response) => {
      if (response.status === "fallback_completed") {
        message.warning(`AI生成失败，已使用基础模板生成面试套件${response.ai_error ? `：${response.ai_error}` : ""}`);
      } else {
        message.success("面试套件已生成");
      }
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: (error) => showInterviewKitError(error)
  });
  const createInterview = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.post<{ id: string }>("/interviews", { applicationId: id, interviewRound: stage }),
    onSuccess: (interview) => {
      message.success("面试工作台已创建");
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      navigate(`/interviews/${interview.id}`);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "创建失败")
  });

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="面试准备流程：进入需要面试的阶段后，先生成面试套件，再创建面试官工作台。"
      />
      <div className="grid">
        {pipelineStages.map((stage) => {
          const stageApps = applications.filter((item) => item.stage === stage);
          return (
            <Card key={stage} title={`${stageLabel(stage)} · ${stageApps.length}`}>
              <Space direction="vertical" style={{ width: "100%" }}>
                {stageApps.map((application) => {
                  const readiness = getInterviewReadiness(application);
                  return (
                    <Card key={application.id} size="small">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Space wrap>
                          <Link to={`/candidates/${application.candidateId}`}>{application.candidate?.name}</Link>
                          <Typography.Text type="secondary">{application.candidate?.currentCompanyName}</Typography.Text>
                          <ScoreTag
                            level={application.evaluations?.[0]?.level}
                            score={application.evaluations?.[0]?.matchScore}
                          />
                        </Space>
                        <Space wrap>
                          <Tag color={readiness.canPrepare ? "blue" : "default"}>{readiness.summary}</Tag>
                          {readiness.canPrepare ? <Tag color={readiness.kit ? "success" : "warning"}>{readiness.kit ? "套件已生成" : "待生成套件"}</Tag> : null}
                          {readiness.interview ? <Tag color={readiness.interview.status === "COMPLETED" ? "success" : "processing"}>{interviewStatusLabel(readiness.interview.status)}</Tag> : null}
                        </Space>
                        <Space wrap>
                          <Select
                            size="small"
                            value={application.stage}
                            options={pipelineStages.map((value) => ({ value, label: stageLabel(value) }))}
                            onChange={(value) => updateStage.mutate({ id: application.id, stage: value })}
                            style={{ width: 160 }}
                          />
                          <Button size="small" disabled={!readiness.canPrepare} onClick={() => setPreparingApplicationId(application.id)}>
                            面试准备
                          </Button>
                          {readiness.interview ? (
                            <Button size="small" onClick={() => navigate(`/interviews/${readiness.interview?.id}`)}>
                              进入面试工作台
                            </Button>
                          ) : null}
                        </Space>
                      </Space>
                    </Card>
                  );
                })}
              </Space>
            </Card>
          );
        })}
      </div>
      <InterviewPreparationModal
        application={preparingApplication}
        open={Boolean(preparingApplication)}
        generating={generateKit.isPending}
        creating={createInterview.isPending}
        onClose={() => setPreparingApplicationId(undefined)}
        onGenerateKit={(application, stage) => generateKit.mutate({ id: application.id, stage })}
        onCreateInterview={(application, stage) => createInterview.mutate({ id: application.id, stage })}
      />
    </>
  );
}

function showInterviewKitError(error: unknown) {
  const title = "面试套件生成失败";
  const messageText = error instanceof Error ? error.message : "生成失败";
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const details = error instanceof ApiError ? compactErrorDetails(error.details) : "";

  console.error(title, error);
  Modal.error({
    title,
    width: 720,
    content: (
      <Space direction="vertical" style={{ width: "100%" }}>
        <Typography.Text>请把下面的信息发给开发排查。</Typography.Text>
        {requestId ? <Typography.Text copyable>错误ID：{requestId}</Typography.Text> : null}
        <Typography.Paragraph copyable style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>
          {messageText}
          {details ? `\n\n${details}` : ""}
        </Typography.Paragraph>
      </Space>
    )
  });
}

function compactErrorDetails(details: unknown) {
  if (!details) return "";
  if (typeof details === "string") return details.slice(0, 1200);
  try {
    return JSON.stringify(details, null, 2).slice(0, 1200);
  } catch {
    return String(details).slice(0, 1200);
  }
}

function InterviewPreparationModal({
  application,
  open,
  generating,
  creating,
  onClose,
  onGenerateKit,
  onCreateInterview
}: {
  application?: Application;
  open: boolean;
  generating: boolean;
  creating: boolean;
  onClose: () => void;
  onGenerateKit: (application: Application, stage: string) => void;
  onCreateInterview: (application: Application, stage: string) => void;
}) {
  if (!application) return null;
  const readiness = getInterviewReadiness(application);
  const stage = readiness.kitStage;
  const latestEvaluation = application.evaluations?.[0];

  return (
    <Modal title="面试准备" open={open} onCancel={onClose} footer={null} width={760}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="候选人">{application.candidate?.name ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="当前阶段">{stageLabel(application.stage)}</Descriptions.Item>
          <Descriptions.Item label="准备轮次">{interviewStageLabel(stage)}</Descriptions.Item>
          <Descriptions.Item label="最新判断">
            <ScoreTag level={latestEvaluation?.level} score={latestEvaluation?.matchScore} />
          </Descriptions.Item>
        </Descriptions>

        <Alert
          type="info"
          showIcon
          message="建议顺序"
          description="先生成面试套件，系统会把简历风险点、必问问题和评分关注点整理好；再创建面试官工作台，面试官从工作台查看问题并提交反馈。"
        />

        <Card size="small" title="1. 生成面试套件">
          <Space direction="vertical" style={{ width: "100%" }}>
            {readiness.kit ? (
              <Typography.Text type="success">
                已生成 {interviewStageLabel(readiness.kit.stage)} 套件，可重新生成以覆盖最新简历判断和岗位画像。
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary">当前轮次还没有面试套件。</Typography.Text>
            )}
            <Button loading={generating} onClick={() => onGenerateKit(application, stage)}>
              {readiness.kit ? "重新生成面试套件" : "生成面试套件"}
            </Button>
          </Space>
        </Card>

        <Card size="small" title="2. 创建面试官工作台">
          <Space direction="vertical" style={{ width: "100%" }}>
            {readiness.interview ? (
              <Space>
                <Typography.Text>该轮面试已创建：</Typography.Text>
                <Tag color={readiness.interview.status === "COMPLETED" ? "success" : "processing"}>{interviewStatusLabel(readiness.interview.status)}</Tag>
                <Link to={`/interviews/${readiness.interview.id}`}>进入面试工作台</Link>
              </Space>
            ) : (
              <Typography.Text type={readiness.kit ? "secondary" : "warning"}>
                {readiness.kit ? "套件已就绪，可以创建面试官工作台。" : "请先生成面试套件，再创建面试官工作台。"}
              </Typography.Text>
            )}
            <Button
              type="primary"
              loading={creating}
              disabled={!readiness.kit || Boolean(readiness.interview)}
              onClick={() => onCreateInterview(application, stage)}
            >
              创建面试工作台
            </Button>
          </Space>
        </Card>
      </Space>
    </Modal>
  );
}

function getInterviewReadiness(application: Application) {
  const canPrepare = isInterviewStage(application.stage);
  const kitStage = stageToKitStage(application.stage);
  const kit = latestKitForStage(application.interviewKits, kitStage);
  const interview = latestInterviewForStage(application.interviews, kitStage);
  return {
    canPrepare,
    kitStage,
    kit,
    interview,
    summary: canPrepare ? `准备${interviewStageLabel(kitStage)}` : "当前阶段无需面试准备"
  };
}

function isInterviewStage(stage: string) {
  return ["HR_SCREEN", "FIRST_INTERVIEW", "SECOND_INTERVIEW", "FINAL_INTERVIEW"].includes(stage);
}

function latestKitForStage(kits: InterviewKit[] | undefined, stage: string) {
  return kits?.find((kit) => kit.stage === stage);
}

function latestInterviewForStage(interviews: Interview[] | undefined, stage: string) {
  return interviews?.find((interview) => interview.interviewRound === stage && interview.status !== "CANCELED");
}

function split(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function join(value?: string[]) {
  return value?.join(", ") ?? "";
}
