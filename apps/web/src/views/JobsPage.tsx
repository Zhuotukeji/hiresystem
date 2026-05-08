import { Button, Card, Form, Input, InputNumber, Modal, Select, Table, Tag, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiList } from "../api/client";
import { Job } from "../api/types";
import { PageHeader } from "../ui/PageHeader";

export function JobsPage() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.get<ApiList<Job>>("/jobs")
  });
  const createMutation = useMutation({
    mutationFn: (values: unknown) => api.post("/jobs", values),
    onSuccess: () => {
      message.success("岗位已创建");
      setOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    }
  });

  return (
    <div className="page">
      <PageHeader
        title="岗位工作台"
        desc="岗位画像、候选人 pipeline、AI JD 和面试流转。"
        actions={
          <Button type="primary" onClick={() => setOpen(true)}>
            新增岗位
          </Button>
        }
      />
      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items ?? []}
          columns={[
            { title: "岗位", dataIndex: "title", render: (text, record) => <Link to={`/jobs/${record.id}`}>{text}</Link> },
            { title: "部门", dataIndex: "department" },
            { title: "城市", dataIndex: "city" },
            { title: "优先级", dataIndex: "priority", render: (value) => <Tag color={value === "P0" ? "red" : "blue"}>{value}</Tag> },
            { title: "状态", dataIndex: "status" },
            { title: "HC", dataIndex: "headcount" },
            { title: "候选人", render: (_, record) => record._count?.applications ?? 0 },
            { title: "画像", render: (_, record) => (record.profile ? <Tag color="success">已配置</Tag> : <Tag>待配置</Tag>) }
          ]}
        />
      </Card>
      <Modal title="新增岗位" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form layout="vertical" form={form} onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item label="岗位名称" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="部门" name="department">
            <Input />
          </Form.Item>
          <Form.Item label="城市" name="city">
            <Input />
          </Form.Item>
          <Form.Item label="优先级" name="priority" initialValue="P1">
            <Select options={["P0", "P1", "P2"].map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item label="HC" name="headcount" initialValue={1}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="薪资下限" name="salaryMin">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="薪资上限" name="salaryMax">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="JD" name="jd">
            <Input.TextArea rows={5} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
