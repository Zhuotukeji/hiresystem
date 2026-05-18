import { Alert, Button, Card, Descriptions, Modal, Select, Space, Tabs, Tag, Typography, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiList } from "../api/client";
import { Candidate, CandidateEvaluation, Job, ResumeEvaluationResponse } from "../api/types";
import { canStartManualCandidateEvaluation } from "../domain/candidateAi";
import { PageHeader } from "../ui/PageHeader";
import { ScoreTag } from "../ui/ScoreTag";

export function CandidateDetailPage() {
  const { id } = useParams();
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [evaluationJobId, setEvaluationJobId] = useState<string>();
  const [evaluationStatus, setEvaluationStatus] = useState<"idle" | "evaluating" | "completed" | "failed">("idle");
  const [evaluationBaselineId, setEvaluationBaselineId] = useState<string>();
  const [queuedEvaluationResponse, setQueuedEvaluationResponse] = useState<ResumeEvaluationResponse>();
  const [evaluationError, setEvaluationError] = useState("");
  const queryClient = useQueryClient();

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => api.get<Candidate>(`/candidates/${id}`),
    enabled: Boolean(id),
    refetchInterval: evaluationStatus === "evaluating" ? 3000 : false
  });
  const { data: jobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.get<ApiList<Job>>("/jobs")
  });

  const latestEvaluation = candidate?.evaluations?.[0];
  const jobOptions = useMemo(
    () => (jobs?.items ?? []).map((job) => ({ value: job.id, label: `${job.title} · ${job.city ?? "不限城市"}` })),
    [jobs]
  );

  const addToJobMutation = useMutation({
    mutationFn: () => api.post("/applications", { candidateId: id, jobId: selectedJobId }),
    onSuccess: () => {
      message.success("已加入岗位流程");
      setJobModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
    }
  });

  const evaluateMutation = useMutation({
    mutationFn: (jobId: string) => api.post<ResumeEvaluationResponse>("/ai/resume-evaluations", { candidateId: id, jobId, mode: "async" }),
    onMutate: () => {
      setEvaluationBaselineId(latestEvaluation?.id);
      setQueuedEvaluationResponse(undefined);
      setEvaluationError("");
      setEvaluationStatus("evaluating");
    },
    onSuccess: (response) => {
      setQueuedEvaluationResponse(response);
      message.success(response.status === "queued" ? "AI 判断已开始" : `AI 判断已完成：${response.status}`);
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
    },
    onError: (error) => {
      setEvaluationStatus("failed");
      setEvaluationError(error instanceof Error ? error.message : "AI 判定失败");
      message.error(error instanceof Error ? error.message : "AI 判定失败");
    }
  });

  const canStartEvaluation = canStartManualCandidateEvaluation(evaluationJobId, evaluationStatus === "evaluating" || evaluateMutation.isPending);

  useEffect(() => {
    if (evaluationStatus !== "evaluating") return;
    const newestEvaluation = candidate?.evaluations?.[0];
    if (!newestEvaluation?.id) return;
    if (newestEvaluation.id === evaluationBaselineId) return;

    setEvaluationStatus("completed");
    setQueuedEvaluationResponse(evaluationToResponse(newestEvaluation));
    message.success("AI 判断已完成");
  }, [candidate?.evaluations, evaluationBaselineId, evaluationStatus]);

  return (
    <div className="page">
      <PageHeader
        title={candidate?.name ?? "候选人详情"}
        desc={`${candidate?.currentCompanyName ?? "未知公司"} · ${candidate?.currentTitle ?? "未知职位"}`}
        actions={
          <Space>
            <Button onClick={() => setJobModalOpen(true)}>加入岗位</Button>
            <Select
              placeholder="选择目标岗位"
              options={jobOptions}
              style={{ width: 260 }}
              value={evaluationJobId}
              disabled={evaluationStatus === "evaluating" || evaluateMutation.isPending}
              onChange={(value) => {
                setEvaluationJobId(value);
                evaluateMutation.reset();
                setEvaluationStatus("idle");
                setQueuedEvaluationResponse(undefined);
                setEvaluationError("");
              }}
              loading={evaluateMutation.isPending}
            />
            <Button
              type="primary"
              disabled={!canStartEvaluation}
              loading={evaluateMutation.isPending}
              onClick={() => evaluationJobId && evaluateMutation.mutate(evaluationJobId)}
            >
              开启 AI 判断
            </Button>
          </Space>
        }
      />
      {!isLoading && !candidate?.resumeText ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="该候选人暂无简历文本，AI 判断可能不充分"
        />
      ) : null}
      <ManualEvaluationStatusAlert
        status={evaluationStatus}
        response={queuedEvaluationResponse}
        error={evaluationError}
      />
      <div className="grid grid-3">
        <Card loading={isLoading} title="基础信息">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="城市">{candidate?.city ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="年限">{candidate?.yearsOfExperience ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="期望薪资">{candidate?.expectedSalary ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="电话">{candidate?.phone ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{candidate?.email ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="状态">{candidate?.status ?? "-"}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card title="最新 AI 判断" style={{ gridColumn: "span 2" }}>
          {latestEvaluation ? <EvaluationSummary evaluation={latestEvaluation} /> : <Typography.Text type="secondary">暂无判定</Typography.Text>}
        </Card>
      </div>
      <Card style={{ marginTop: 16 }}>
        <Tabs
          items={[
            {
              key: "resume",
              label: "简历",
              children: <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{candidate?.resumeText ?? "暂无简历文本"}</Typography.Paragraph>
            },
            {
              key: "applications",
              label: "流程记录",
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  {(candidate?.applications ?? []).map((application) => (
                    <Card key={application.id} size="small">
                      <Space>
                        <Tag>{application.stage}</Tag>
                        <Typography.Text>{application.job?.title}</Typography.Text>
                        <ScoreTag
                          level={application.evaluations?.[0]?.level}
                          score={application.evaluations?.[0]?.matchScore}
                        />
                      </Space>
                    </Card>
                  ))}
                </Space>
              )
            },
            {
              key: "evaluations",
              label: "AI 判定历史",
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  {(candidate?.evaluations ?? []).map((evaluation) => (
                    <Card key={evaluation.id} size="small">
                      <EvaluationSummary evaluation={evaluation} />
                    </Card>
                  ))}
                </Space>
              )
            }
          ]}
        />
      </Card>
      <Modal
        title="加入岗位"
        open={jobModalOpen}
        onCancel={() => setJobModalOpen(false)}
        onOk={() => addToJobMutation.mutate()}
        okButtonProps={{ disabled: !selectedJobId, loading: addToJobMutation.isPending }}
      >
        <Select options={jobOptions} style={{ width: "100%" }} placeholder="选择岗位" onChange={setSelectedJobId} />
      </Modal>
    </div>
  );
}

function ManualEvaluationStatusAlert({
  status,
  response,
  error
}: {
  status: "idle" | "evaluating" | "completed" | "failed";
  response?: ResumeEvaluationResponse;
  error: string;
}) {
  if (status === "evaluating") {
    return (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="AI判断中..."
        description="系统正在基于候选人简历和目标岗位判断是否进入下一阶段。"
      />
    );
  }

  if (status === "failed") {
    return (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="AI判断失败"
        description={error || "候选人资料未受影响，可重新开启 AI 判断。"}
      />
    );
  }

  if (status !== "completed" || !response?.result) return null;

  return (
    <Alert
      type="success"
      showIcon
      style={{ marginBottom: 16 }}
      message={`AI判断完成：${response.status}`}
      description={
        <Space direction="vertical" size={6}>
          <Space>
            <ScoreTag level={response.result.level} score={response.result.match_score} />
            <Tag>{response.result.recommendation}</Tag>
          </Space>
          <Typography.Text>{response.result.summary}</Typography.Text>
          {response.result.suggested_next_step ? (
            <Typography.Text>推荐下一步：{response.result.suggested_next_step}</Typography.Text>
          ) : null}
          {response.result.risks?.length ? <Typography.Text type="warning">风险点：{response.result.risks.join("；")}</Typography.Text> : null}
          {response.result.questions_to_confirm?.length ? (
            <Typography.Text type="secondary">电话确认问题：{response.result.questions_to_confirm.join("；")}</Typography.Text>
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

function EvaluationSummary({ evaluation }: { evaluation: CandidateEvaluation }) {
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Space>
        <ScoreTag level={evaluation.level} score={evaluation.matchScore} />
        <Tag>{evaluation.recommendation}</Tag>
      </Space>
      <Typography.Paragraph>{evaluation.summary}</Typography.Paragraph>
      {evaluation.suggestedNextStep ? (
        <div>
          <Typography.Text strong>推荐下一步</Typography.Text>
          <Typography.Paragraph>{evaluation.suggestedNextStep}</Typography.Paragraph>
        </div>
      ) : null}
      <div>
        <Typography.Text strong>推荐理由</Typography.Text>
        <ul>
          {(evaluation.reasons ?? []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <Typography.Text strong>风险点</Typography.Text>
        <ul>
          {(evaluation.risks ?? []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <Typography.Text strong>电话确认问题</Typography.Text>
        <ul>
          {(evaluation.questionsToConfirm ?? []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </Space>
  );
}
