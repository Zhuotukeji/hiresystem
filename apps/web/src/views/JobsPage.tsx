import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Table, Tabs, Tag, Typography, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiList } from "../api/client";
import { Job } from "../api/types";
import { AiJdAssistant } from "../components/AiJdAssistant";
import { buildDraftJobPayload, validateAiJdInput } from "../domain/aiJob";
import { getJobCreationConfirmCopy, JobCreationMode } from "../domain/jobCreation";
import { canDeleteResource } from "../domain/permissions";
import { useCurrentPermissions } from "../hooks/useCurrentUser";
import { PageHeader } from "../ui/PageHeader";

export function JobsPage() {
  const [open, setOpen] = useState(false);
  const [manualForm] = Form.useForm();
  const [aiForm] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permissions = useCurrentPermissions();
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.get<ApiList<Job>>("/jobs")
  });

  const createMutation = useMutation({
    mutationFn: (values: unknown) => api.post<Job>("/jobs", values),
    onSuccess: () => {
      message.success("岗位已创建");
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "创建失败")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/jobs/${id}`),
    onSuccess: () => {
      message.success("岗位已删除");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "删除失败")
  });

  const canDeleteJob = canDeleteResource(permissions.data, "JOB");

  function closeModal() {
    setOpen(false);
    manualForm.resetFields();
    aiForm.resetFields();
  }

  async function handleManualCreate(values: unknown) {
    const confirmed = await confirmJobCreation("manual", (values as { title?: string }).title);
    if (confirmed) {
      createMutation.mutate(values);
    }
  }

  async function prepareAiDraftJob(prompt: string) {
    const values = await aiForm.validateFields();
    const validation = validateAiJdInput(values, prompt);
    if (!validation.ok) {
      message.error(validation.message);
      throw new Error(validation.message);
    }
    const confirmed = await confirmJobCreation("ai", values.title);
    if (!confirmed) {
      throw new Error("已取消创建岗位");
    }
    const job = await api.post<Job>("/jobs", buildDraftJobPayload(values, prompt));
    return { jobId: job.id };
  }

  return (
    <div className="page">
      <PageHeader
        title="岗位工作台"
        desc="岗位画像、候选人流程、AI JD 和面试流转。"
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
            { title: "画像", render: (_, record) => (record.profile ? <Tag color="success">已配置</Tag> : <Tag>待配置</Tag>) },
            {
              title: "操作",
              render: (_, record) =>
                canDeleteJob ? (
                  <Popconfirm
                    title="确认删除该岗位？"
                    description="岗位下的应聘、面试、评估、JD 版本会一起删除。"
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
      <Modal title="新增岗位" open={open} onCancel={closeModal} footer={null} width={960}>
        <Tabs
          items={[
            {
              key: "manual",
              label: "手动创建",
              children: (
                <Form layout="vertical" form={manualForm} onFinish={handleManualCreate}>
                  <div className="grid grid-2">
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
                  </div>
                  <Form.Item label="JD" name="jd">
                    <Input.TextArea rows={5} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                    创建岗位
                  </Button>
                </Form>
              )
            },
            {
              key: "ai",
              label: "AI 生成 JD",
              children: (
                <>
                  <Typography.Paragraph type="secondary">
                    先填写岗位基础信息，再告诉 AI 业务背景、岗位使命和候选人要求。岗位名称会作为生成约束；确认后系统会创建岗位草稿，并把 AI 生成的 JD 和岗位画像卡保存到该岗位。
                  </Typography.Paragraph>
                  <Form layout="vertical" form={aiForm} initialValues={{ priority: "P1", headcount: 1 }}>
                    <div className="grid grid-3">
                      <Form.Item label="岗位名称" name="title" rules={[{ required: true }]}>
                        <Input placeholder="例如：HRBP / 增长运营 / Java 后端" />
                      </Form.Item>
                      <Form.Item label="部门" name="department">
                        <Input placeholder="技术部" />
                      </Form.Item>
                      <Form.Item label="城市" name="city">
                        <Input placeholder="上海" />
                      </Form.Item>
                      <Form.Item label="优先级" name="priority">
                        <Select options={["P0", "P1", "P2"].map((value) => ({ value, label: value }))} />
                      </Form.Item>
                      <Form.Item label="HC" name="headcount">
                        <InputNumber min={1} style={{ width: "100%" }} />
                      </Form.Item>
                      <Form.Item label="薪资下限" name="salaryMin">
                        <InputNumber min={0} style={{ width: "100%" }} />
                      </Form.Item>
                      <Form.Item label="薪资上限" name="salaryMax">
                        <InputNumber min={0} style={{ width: "100%" }} />
                      </Form.Item>
                    </div>
                  </Form>
                  <AiJdAssistant
                    cardTitle="告诉 AI 这个岗位要解决什么问题"
                    buttonText="AI 生成 JD 并创建岗位"
                    prepareJob={prepareAiDraftJob}
                    onSaved={({ jobId }) => {
                      closeModal();
                      queryClient.invalidateQueries({ queryKey: ["jobs"] });
                      navigate(`/jobs/${jobId}`);
                    }}
                  />
                </>
              )
            }
          ]}
        />
      </Modal>
    </div>
  );
}

function confirmJobCreation(mode: JobCreationMode, title?: string) {
  const copy = getJobCreationConfirmCopy(mode, title);
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      ...copy,
      okText: "确认创建",
      cancelText: "取消",
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}
