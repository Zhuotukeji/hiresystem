import { Button, Card, Form, Input, Modal, Popconfirm, Space, Table, Tag, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiList } from "../api/client";
import { TargetCompany } from "../api/types";
import { canDeleteResource } from "../domain/permissions";
import { useCurrentPermissions } from "../hooks/useCurrentUser";
import { PageHeader } from "../ui/PageHeader";

export function CompaniesPage() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const permissions = useCurrentPermissions();
  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api.get<ApiList<TargetCompany>>("/target-companies")
  });

  const createMutation = useMutation({
    mutationFn: (values: unknown) => api.post("/target-companies", values),
    onSuccess: () => {
      message.success("目标公司已创建");
      setOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "创建失败")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/target-companies/${id}`),
    onSuccess: () => {
      message.success("目标公司已删除");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "删除失败")
  });

  const canDeleteCompany = canDeleteResource(permissions.data, "TARGET_COMPANY");

  return (
    <div className="page">
      <PageHeader
        title="目标公司库"
        desc="沉淀竞品、标杆公司和高质量人才来源。"
        actions={
          <Button type="primary" onClick={() => setOpen(true)}>
            新增公司
          </Button>
        }
      />
      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items ?? []}
          columns={[
            { title: "公司", dataIndex: "name" },
            { title: "类型", dataIndex: "companyType" },
            { title: "行业", dataIndex: "industry" },
            { title: "城市", dataIndex: "city" },
            { title: "评级", dataIndex: "talentQualityLevel", render: (value) => <Tag>{value ?? "未评级"}</Tag> },
            { title: "优先级", dataIndex: "sourcingPriority" },
            { title: "候选人", render: (_, record) => record._count?.candidates ?? 0 },
            {
              title: "标签",
              render: (_, record) => (
                <Space wrap>
                  {[...(record.businessTags ?? []), ...(record.techTags ?? [])].slice(0, 4).map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>
              )
            },
            {
              title: "操作",
              render: (_, record) =>
                canDeleteCompany ? (
                  <Popconfirm
                    title="确认删除该目标公司？"
                    description="候选人的当前公司关联会被置空，公司记录会删除。"
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
      <Modal title="新增目标公司" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form
          layout="vertical"
          form={form}
          onFinish={(values) =>
            createMutation.mutate({
              ...values,
              businessTags: split(values.businessTags),
              techTags: split(values.techTags),
              targetRoles: split(values.targetRoles)
            })
          }
        >
          <Form.Item label="公司名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="类型" name="companyType">
            <Input placeholder="competitor / benchmark / similar_stage" />
          </Form.Item>
          <Form.Item label="行业" name="industry">
            <Input />
          </Form.Item>
          <Form.Item label="城市" name="city">
            <Input />
          </Form.Item>
          <Form.Item label="人才质量评级" name="talentQualityLevel">
            <Input placeholder="A / B / C" />
          </Form.Item>
          <Form.Item label="业务标签" name="businessTags">
            <Input placeholder="用逗号分隔" />
          </Form.Item>
          <Form.Item label="技术标签" name="techTags">
            <Input placeholder="用逗号分隔" />
          </Form.Item>
          <Form.Item label="适合岗位" name="targetRoles">
            <Input placeholder="用逗号分隔" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function split(value?: string) {
  return value
    ? value
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
