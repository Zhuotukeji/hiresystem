import { Button, Card, Space, Table, Tag, Typography, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, ApiList } from "../api/client";
import { Application } from "../api/types";
import { PageHeader } from "../ui/PageHeader";
import { ScoreTag } from "../ui/ScoreTag";

export function ManagerReviewPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["manager-review"],
    queryFn: () => api.get<ApiList<Application>>("/applications?stage=MANAGER_REVIEW")
  });
  const update = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.patch(`/applications/${id}`, { stage }),
    onSuccess: () => {
      message.success("快审结果已保存");
      queryClient.invalidateQueries({ queryKey: ["manager-review"] });
    }
  });

  return (
    <div className="page">
      <PageHeader title="用人经理快审" desc="30 秒判断黄色候选人：值得聊、不合适、放人才池。" />
      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items ?? []}
          columns={[
            {
              title: "候选人",
              render: (_, record) => (
                <Space direction="vertical" size={0}>
                  <Link to={`/candidates/${record.candidateId}`}>{record.candidate?.name}</Link>
                  <Typography.Text type="secondary">{record.candidate?.currentCompanyName} · {record.candidate?.currentTitle}</Typography.Text>
                </Space>
              )
            },
            { title: "岗位", render: (_, record) => <Link to={`/jobs/${record.jobId}`}>{record.job?.title}</Link> },
            {
              title: "AI 判断",
              render: (_, record) => {
                const latest = record.evaluations?.[0];
                return <ScoreTag level={latest?.level} score={latest?.matchScore} />;
              }
            },
            {
              title: "风险点",
              render: (_, record) => (
                <Space direction="vertical">
                  {(record.evaluations?.[0]?.risks ?? []).slice(0, 3).map((risk) => (
                    <Tag key={risk}>{risk}</Tag>
                  ))}
                </Space>
              )
            },
            {
              title: "操作",
              render: (_, record) => (
                <Space wrap>
                  <Button size="small" type="primary" onClick={() => update.mutate({ id: record.id, stage: "HR_SCREEN" })}>
                    值得聊
                  </Button>
                  <Button size="small" onClick={() => update.mutate({ id: record.id, stage: "TALENT_POOL" })}>
                    放人才池
                  </Button>
                  <Button size="small" danger onClick={() => update.mutate({ id: record.id, stage: "REJECTED" })}>
                    不合适
                  </Button>
                </Space>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
}
