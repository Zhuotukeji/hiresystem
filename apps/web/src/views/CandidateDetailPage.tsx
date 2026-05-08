import { Button, Card, Descriptions, Form, Modal, Select, Space, Tabs, Tag, Typography, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiList } from "../api/client";
import { Candidate, CandidateEvaluation, Job } from "../api/types";
import { PageHeader } from "../ui/PageHeader";
import { ScoreTag } from "../ui/ScoreTag";

export function CandidateDetailPage() {
  const { id } = useParams();
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const queryClient = useQueryClient();

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => api.get<Candidate>(`/candidates/${id}`),
    enabled: Boolean(id)
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
    mutationFn: (jobId: string) => api.post("/ai/resume-evaluations", { candidateId: id, jobId }),
    onSuccess: () => {
      message.success("AI 简历判定已完成");
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "AI 判定失败")
  });

  return (
    <div className="page">
      <PageHeader
        title={candidate?.name ?? "候选人详情"}
        desc={`${candidate?.currentCompanyName ?? "未知公司"} · ${candidate?.currentTitle ?? "未知职位"}`}
        actions={
          <Space>
            <Button onClick={() => setJobModalOpen(true)}>加入岗位</Button>
            <Select
              placeholder="选择岗位后AI判定"
              options={jobOptions}
              style={{ width: 260 }}
              onChange={(value) => evaluateMutation.mutate(value)}
              loading={evaluateMutation.isPending}
            />
          </Space>
        }
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

function EvaluationSummary({ evaluation }: { evaluation: CandidateEvaluation }) {
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Space>
        <ScoreTag level={evaluation.level} score={evaluation.matchScore} />
        <Tag>{evaluation.recommendation}</Tag>
      </Space>
      <Typography.Paragraph>{evaluation.summary}</Typography.Paragraph>
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
