import { Button, Card, Col, Empty, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { InterviewTask } from "../api/types";
import { interviewStageLabel, interviewStatusLabel } from "../domain/labels";
import { stageLabel } from "../domain/stages";
import { PageHeader } from "../ui/PageHeader";

type DashboardStats = {
  openJobs: number;
  candidates: number;
  targetCompanies: number;
  bossDependencyRate: number;
  feedbackPending: number;
  applicationsByStage: Array<{ stage: string; count: number }>;
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardStats>("/jobs/dashboard/stats")
  });
  const tasksQuery = useQuery({
    queryKey: ["interviews", "my-tasks"],
    queryFn: () => api.get<InterviewTask[]>("/interviews/my-tasks")
  });
  const interviewTasks = (tasksQuery.data ?? []).slice(0, 5);

  return (
    <div className="page">
      <PageHeader title="招聘驾驶舱" desc="关注渠道质量、关键岗位进展和流程阻塞。" />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8} lg={4}>
          <Card>
            <Statistic title="开放岗位" value={data?.openJobs ?? 0} loading={isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={8} lg={4}>
          <Card>
            <Statistic title="候选人总数" value={data?.candidates ?? 0} loading={isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={8} lg={4}>
          <Card>
            <Statistic title="目标公司" value={data?.targetCompanies ?? 0} loading={isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={8} lg={4}>
          <Card>
            <Statistic title="BOSS依赖率" suffix="%" value={data?.bossDependencyRate ?? 0} loading={isLoading} />
          </Card>
        </Col>
        <Col xs={24} md={8} lg={4}>
          <Card>
            <Statistic title="反馈超时" value={data?.feedbackPending ?? 0} loading={isLoading} />
          </Card>
        </Col>
      </Row>
      <Card
        title="我的面试待办"
        style={{ marginTop: 16 }}
        extra={<Tag color={interviewTasks.length ? "processing" : "default"}>{interviewTasks.length} 条待处理</Tag>}
      >
        <Table
          rowKey="interviewId"
          size="small"
          loading={tasksQuery.isLoading}
          dataSource={interviewTasks}
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待处理面试" /> }}
          columns={[
            {
              title: "候选人",
              render: (_, record) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text strong>{record.candidateName}</Typography.Text>
                  <Typography.Text type="secondary">
                    {[record.candidateCompany, record.candidateTitle].filter(Boolean).join(" · ") || "-"}
                  </Typography.Text>
                </Space>
              )
            },
            {
              title: "岗位",
              render: (_, record) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text>{record.jobTitle}</Typography.Text>
                  <Typography.Text type="secondary">{record.jobDepartment ?? "-"}</Typography.Text>
                </Space>
              )
            },
            { title: "轮次", dataIndex: "interviewRound", render: (value) => <Tag>{interviewStageLabel(value)}</Tag> },
            { title: "状态", dataIndex: "status", render: (value) => <Tag color="processing">{interviewStatusLabel(value)}</Tag> },
            { title: "计划时间", dataIndex: "scheduledAt", render: (value) => formatDateTime(value) },
            {
              title: "操作",
              render: (_, record) => (
                <Button type="primary" size="small" onClick={() => navigate(`/interviews/${record.interviewId}`)}>
                  进入面试工作台
                </Button>
              )
            }
          ]}
        />
      </Card>
      <Card title="招聘漏斗" style={{ marginTop: 16 }}>
        <Table
          rowKey="stage"
          loading={isLoading}
          dataSource={data?.applicationsByStage ?? []}
          pagination={false}
          columns={[
            { title: "阶段", dataIndex: "stage", render: (stage) => <Tag>{stageLabel(stage)}</Tag> },
            { title: "人数", dataIndex: "count" }
          ]}
        />
      </Card>
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "未排期";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未排期";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
