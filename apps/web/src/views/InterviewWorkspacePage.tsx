import { Button, Card, Form, Input, Rate, Select, Space, Tag, Typography, message } from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { Candidate, Interview, InterviewKit, Job } from "../api/types";
import { PageHeader } from "../ui/PageHeader";

type Workspace = {
  interview: Interview;
  candidate: Candidate;
  job: Job;
  interviewKit?: InterviewKit;
  latestHandoff?: {
    candidateSummary: string;
    whyAdvance: string[];
    remainingRisks: string[];
    nextInterviewFocus: string[];
    previousFeedbackSummary?: string;
  };
  previousFeedback: Array<{ conclusion: string; evidence: string }>;
};

export function InterviewWorkspacePage() {
  const { id } = useParams();
  const [form] = Form.useForm();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["interview-workspace", id],
    queryFn: () => api.get<Workspace>(`/interviews/${id}/workspace`),
    enabled: Boolean(id)
  });
  const submit = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      api.post(`/interviews/${id}/feedback`, {
        conclusion: values.conclusion,
        evidence: values.evidence,
        strengths: split(values.strengths),
        weaknesses: split(values.weaknesses),
        scores: {
          technical_depth: values.technicalDepth,
          project_complexity: values.projectComplexity,
          business_understanding: values.businessUnderstanding,
          communication: values.communication
        }
      }),
    onSuccess: () => {
      message.success("面试反馈已提交");
      refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "提交失败")
  });

  const kit = data?.interviewKit;
  return (
    <div className="page">
      <PageHeader
        title="面试官工作台"
        desc={`${data?.candidate?.name ?? "候选人"} · ${data?.job?.title ?? "目标岗位"} · ${data?.interview?.interviewRound ?? ""}`}
      />
      <div className="grid grid-2">
        <Card loading={isLoading} title="本轮面试套件">
          {kit ? (
            <Space direction="vertical" style={{ width: "100%" }}>
              <Typography.Paragraph>{kit.goal}</Typography.Paragraph>
              <Tag>{kit.stage}</Tag>
              <QuestionBlock title="必问问题" questions={kit.mustAskQuestions} />
              <QuestionBlock title="简历风险验证" questions={kit.resumeBasedQuestions} />
              <QuestionBlock title="场景/案例题" questions={kit.caseQuestions} />
              <SignalBlock title="好答案信号" items={kit.goodSignals} />
              <SignalBlock title="风险信号" items={kit.badSignals} />
            </Space>
          ) : (
            <Typography.Text type="secondary">暂无面试套件，请在岗位 pipeline 中生成。</Typography.Text>
          )}
        </Card>
        <Card loading={isLoading} title="阶段流转信息">
          {data?.latestHandoff ? (
            <Space direction="vertical">
              <Typography.Paragraph>{data.latestHandoff.candidateSummary}</Typography.Paragraph>
              <SignalBlock title="为什么推进" items={data.latestHandoff.whyAdvance} />
              <SignalBlock title="剩余风险" items={data.latestHandoff.remainingRisks} />
              <SignalBlock title="本轮重点" items={data.latestHandoff.nextInterviewFocus} />
            </Space>
          ) : (
            <Typography.Text type="secondary">暂无阶段流转包。</Typography.Text>
          )}
        </Card>
      </div>
      <Card title="提交评分卡" style={{ marginTop: 16 }}>
        <Form layout="vertical" form={form} onFinish={(values) => submit.mutate(values)}>
          <div className="grid grid-2">
            <Form.Item label="技术深度" name="technicalDepth" rules={[{ required: true }]}>
              <Rate />
            </Form.Item>
            <Form.Item label="项目复杂度" name="projectComplexity" rules={[{ required: true }]}>
              <Rate />
            </Form.Item>
            <Form.Item label="业务理解" name="businessUnderstanding" rules={[{ required: true }]}>
              <Rate />
            </Form.Item>
            <Form.Item label="沟通表达" name="communication" rules={[{ required: true }]}>
              <Rate />
            </Form.Item>
          </div>
          <Form.Item label="结论" name="conclusion" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "strong_hire", label: "强烈建议录用" },
                { value: "hire", label: "建议录用" },
                { value: "weak_hire", label: "勉强可进下一轮" },
                { value: "no_hire", label: "不建议" },
                { value: "strong_no_hire", label: "强烈不建议" }
              ]}
            />
          </Form.Item>
          <Form.Item label="证据" name="evidence" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="必须写具体证据，例如候选人如何拆解问题、如何解释项目贡献。" />
          </Form.Item>
          <Form.Item label="优势" name="strengths">
            <Input placeholder="逗号分隔" />
          </Form.Item>
          <Form.Item label="顾虑" name="weaknesses">
            <Input placeholder="逗号分隔" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submit.isPending}>
            提交反馈
          </Button>
        </Form>
      </Card>
    </div>
  );
}

function QuestionBlock({ title, questions }: { title: string; questions?: Array<{ question: string; evaluation_points?: string[]; purpose?: string }> }) {
  return (
    <div>
      <Typography.Text strong>{title}</Typography.Text>
      <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
        {(questions ?? []).map((item) => (
          <Card key={item.question} size="small">
            <Typography.Text>{item.question}</Typography.Text>
            {item.purpose ? <div className="muted">{item.purpose}</div> : null}
            <Space wrap style={{ marginTop: 8 }}>
              {(item.evaluation_points ?? []).map((point) => (
                <Tag key={point}>{point}</Tag>
              ))}
            </Space>
          </Card>
        ))}
      </Space>
    </div>
  );
}

function SignalBlock({ title, items }: { title: string; items?: string[] }) {
  return (
    <div>
      <Typography.Text strong>{title}</Typography.Text>
      <ul>
        {(items ?? []).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function split(value: unknown) {
  if (typeof value !== "string") return [];
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
