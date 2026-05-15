import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  message
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Application, Job } from "../api/types";
import { AiJdAssistant } from "../components/AiJdAssistant";
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
                  <Descriptions.Item label="状态">{job?.status}</Descriptions.Item>
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
  const updateStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.patch(`/applications/${id}`, { stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", jobId] })
  });
  const generateKit = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.post("/ai/interview-kits", { applicationId: id, stage }),
    onSuccess: () => {
      message.success("面试套件已生成");
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "生成失败")
  });
  const createInterview = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.post<{ id: string }>("/interviews", { applicationId: id, interviewRound: stage }),
    onSuccess: (interview) => message.success(`面试已创建：${interview.id}`)
  });

  return (
    <div className="grid">
      {pipelineStages.map((stage) => {
        const stageApps = applications.filter((item) => item.stage === stage);
        return (
          <Card key={stage} title={`${stageLabel(stage)} · ${stageApps.length}`}>
            <Space direction="vertical" style={{ width: "100%" }}>
              {stageApps.map((application) => (
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
                      <Select
                        size="small"
                        value={application.stage}
                        options={pipelineStages.map((value) => ({ value, label: stageLabel(value) }))}
                        onChange={(value) => updateStage.mutate({ id: application.id, stage: value })}
                        style={{ width: 160 }}
                      />
                      <Button size="small" onClick={() => generateKit.mutate({ id: application.id, stage: stageToKitStage(application.stage) })}>
                        生成面试套件
                      </Button>
                      <Button size="small" onClick={() => createInterview.mutate({ id: application.id, stage: stageToKitStage(application.stage) })}>
                        创建面试
                      </Button>
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>
        );
      })}
    </div>
  );
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
