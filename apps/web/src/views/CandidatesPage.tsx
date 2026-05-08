import { Button, Card, Form, Input, InputNumber, Modal, Space, Table, Tag, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiList } from "../api/client";
import { Candidate } from "../api/types";
import { PageHeader } from "../ui/PageHeader";
import { ScoreTag } from "../ui/ScoreTag";

export function CandidatesPage() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => api.get<ApiList<Candidate>>("/candidates")
  });
  const createMutation = useMutation({
    mutationFn: (values: unknown) => api.post("/candidates", values),
    onSuccess: () => {
      message.success("候选人已创建");
      setOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "创建失败")
  });

  return (
    <div className="page">
      <PageHeader
        title="候选人库"
        desc="统一沉淀 BOSS、目标公司、内推和主动 sourcing 候选人。"
        actions={
          <Button type="primary" onClick={() => setOpen(true)}>
            新增候选人
          </Button>
        }
      />
      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items ?? []}
          columns={[
            { title: "姓名", dataIndex: "name", render: (text, record) => <Link to={`/candidates/${record.id}`}>{text}</Link> },
            { title: "当前公司", dataIndex: "currentCompanyName" },
            { title: "职位", dataIndex: "currentTitle" },
            { title: "城市", dataIndex: "city" },
            { title: "年限", dataIndex: "yearsOfExperience" },
            { title: "状态", dataIndex: "status" },
            {
              title: "最新判断",
              render: (_, record) => {
                const latest = record.evaluations?.[0];
                return <ScoreTag level={latest?.level} score={latest?.matchScore} />;
              }
            },
            {
              title: "标签",
              render: (_, record) => (
                <Space wrap>
                  {(record.tags ?? []).slice(0, 4).map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>
              )
            }
          ]}
        />
      </Card>
      <Modal title="新增候选人" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} width={720}>
        <Form
          layout="vertical"
          form={form}
          onFinish={(values) =>
            createMutation.mutate({
              ...values,
              tags: split(values.tags)
            })
          }
        >
          <div className="grid grid-2">
            <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="城市" name="city">
              <Input />
            </Form.Item>
            <Form.Item label="当前公司" name="currentCompanyName">
              <Input />
            </Form.Item>
            <Form.Item label="当前职位" name="currentTitle">
              <Input />
            </Form.Item>
            <Form.Item label="工作年限" name="yearsOfExperience">
              <InputNumber min={0} max={50} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label="期望薪资" name="expectedSalary">
              <Input />
            </Form.Item>
            <Form.Item label="手机号" name="phone">
              <Input />
            </Form.Item>
            <Form.Item label="邮箱" name="email">
              <Input />
            </Form.Item>
          </div>
          <Form.Item label="标签" name="tags">
            <Input placeholder="Java, 交易系统, 目标公司" />
          </Form.Item>
          <Form.Item label="简历文本" name="resumeText">
            <Input.TextArea rows={8} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function split(value?: string) {
  return value
    ? value
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
