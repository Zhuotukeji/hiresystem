import { Card, Col, Row, Statistic, Table, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
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
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardStats>("/jobs/dashboard/stats")
  });

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
      <Card title="招聘漏斗" style={{ marginTop: 16 }}>
        <Table
          rowKey="stage"
          loading={isLoading}
          dataSource={data?.applicationsByStage ?? []}
          pagination={false}
          columns={[
            { title: "阶段", dataIndex: "stage", render: (stage) => <Tag>{stage}</Tag> },
            { title: "人数", dataIndex: "count" }
          ]}
        />
      </Card>
    </div>
  );
}
