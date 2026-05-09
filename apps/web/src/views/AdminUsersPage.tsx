import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  message
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { RolePermission, User } from "../api/types";
import { isAdmin, permissionResourceList, resourceLabels, userRoleList } from "../domain/permissions";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { PageHeader } from "../ui/PageHeader";

type UserFormValues = {
  name: string;
  email: string;
  password?: string;
  role: string;
  isActive?: boolean;
};

type ResetPasswordValues = {
  password: string;
};

export function AdminUsersPage() {
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<RolePermission[]>([]);
  const [userForm] = Form.useForm<UserFormValues>();
  const [resetForm] = Form.useForm<ResetPasswordValues>();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
    enabled: isAdmin(currentUser.data)
  });

  const permissionsQuery = useQuery({
    queryKey: ["permissions", "role-permissions"],
    queryFn: () => api.get<{ permissions: RolePermission[] }>("/permissions/role-permissions"),
    enabled: isAdmin(currentUser.data)
  });

  useEffect(() => {
    if (permissionsQuery.data?.permissions) {
      setPermissionDraft(permissionsQuery.data.permissions);
    }
  }, [permissionsQuery.data?.permissions]);

  const saveUserMutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      if (editingUser?.id) {
        return api.patch<User>(`/users/${editingUser.id}`, {
          name: values.name,
          role: values.role,
          isActive: values.isActive
        });
      }
      return api.post<User>("/users", values);
    },
    onSuccess: () => {
      message.success(editingUser ? "账号已更新" : "账号已创建");
      closeUserModal();
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "账号保存失败")
  });

  const disableUserMutation = useMutation({
    mutationFn: (userId: string) => api.delete<User>(`/users/${userId}`),
    onSuccess: () => {
      message.success("账号已禁用");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "账号禁用失败")
  });

  const enableUserMutation = useMutation({
    mutationFn: (userId: string) => api.patch<User>(`/users/${userId}`, { isActive: true }),
    onSuccess: () => {
      message.success("账号已启用");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "账号启用失败")
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (values: ResetPasswordValues) => api.patch<User>(`/users/${resetUser?.id}/password`, values),
    onSuccess: () => {
      message.success("密码已重置");
      setResetUser(null);
      resetForm.resetFields();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "密码重置失败")
  });

  const savePermissionsMutation = useMutation({
    mutationFn: () =>
      api.put<{ permissions: RolePermission[] }>("/permissions/role-permissions", {
        permissions: permissionDraft.map(({ role, resource, action, allowed }) => ({
          role,
          resource,
          action,
          allowed
        }))
      }),
    onSuccess: (data) => {
      message.success("权限已保存");
      setPermissionDraft(data.permissions);
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "权限保存失败")
  });

  if (currentUser.isLoading) {
    return <div className="page">加载中...</div>;
  }

  if (!isAdmin(currentUser.data)) {
    return (
      <div className="page">
        <Result status="403" title="无权访问" subTitle="只有管理员可以进入系统管理。" />
      </div>
    );
  }

  function openCreateUser() {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({ role: "RECRUITER", isActive: true });
    setUserModalOpen(true);
  }

  function openEditUser(user: User) {
    setEditingUser(user);
    userForm.setFieldsValue({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    });
    setUserModalOpen(true);
  }

  function closeUserModal() {
    setUserModalOpen(false);
    setEditingUser(null);
    userForm.resetFields();
  }

  function findPermission(role: string, resource: RolePermission["resource"]) {
    return permissionDraft.find((item) => item.role === role && item.resource === resource && item.action === "DELETE");
  }

  function setPermission(role: string, resource: RolePermission["resource"], allowed: boolean) {
    setPermissionDraft((current) =>
      current.map((item) =>
        item.role === role && item.resource === resource && item.action === "DELETE" ? { ...item, allowed } : item
      )
    );
  }

  const currentUserId = currentUser.data?.id ?? currentUser.data?.sub;

  return (
    <div className="page">
      <PageHeader title="系统管理" desc="管理账号、角色和关键数据删除权限。" actions={<Button type="primary" onClick={openCreateUser}>新增账号</Button>} />

      <Tabs
        items={[
          {
            key: "users",
            label: "账号管理",
            children: (
              <Card>
                <Table
                  rowKey="id"
                  loading={usersQuery.isLoading}
                  dataSource={usersQuery.data ?? []}
                  columns={[
                    { title: "姓名", dataIndex: "name" },
                    { title: "邮箱", dataIndex: "email" },
                    { title: "角色", dataIndex: "role", render: renderRole },
                    {
                      title: "状态",
                      dataIndex: "isActive",
                      render: (value) => <Tag color={value ? "green" : "default"}>{value ? "启用" : "禁用"}</Tag>
                    },
                    {
                      title: "操作",
                      render: (_, record) => (
                        <Space>
                          <Button size="small" onClick={() => openEditUser(record)}>
                            编辑
                          </Button>
                          <Button
                            size="small"
                            onClick={() => {
                              setResetUser(record);
                              resetForm.resetFields();
                            }}
                          >
                            重置密码
                          </Button>
                          {record.isActive ? (
                            <Popconfirm
                              title="确认禁用该账号？"
                              okText="禁用"
                              cancelText="取消"
                              disabled={record.id === currentUserId}
                              onConfirm={() => record.id && disableUserMutation.mutate(record.id)}
                            >
                              <Button size="small" danger disabled={record.id === currentUserId}>
                                禁用
                              </Button>
                            </Popconfirm>
                          ) : (
                            <Button size="small" onClick={() => record.id && enableUserMutation.mutate(record.id)}>
                              启用
                            </Button>
                          )}
                        </Space>
                      )
                    }
                  ]}
                />
              </Card>
            )
          },
          {
            key: "permissions",
            label: "角色权限",
            children: (
              <Card
                extra={
                  <Button type="primary" loading={savePermissionsMutation.isPending} onClick={() => savePermissionsMutation.mutate()}>
                    保存权限
                  </Button>
                }
              >
                <Table
                  rowKey="role"
                  pagination={false}
                  loading={permissionsQuery.isLoading}
                  dataSource={userRoleList.map((role) => ({ role }))}
                  columns={[
                    { title: "角色", dataIndex: "role", render: renderRole },
                    ...permissionResourceList.map((resource) => ({
                      title: `删除${resourceLabels[resource]}`,
                      render: (_: unknown, record: { role: string }) => {
                        const permission = findPermission(record.role, resource);
                        return (
                          <Switch
                            checked={permission?.allowed ?? record.role === "ADMIN"}
                            disabled={permission?.locked ?? record.role === "ADMIN"}
                            onChange={(checked) => setPermission(record.role, resource, checked)}
                          />
                        );
                      }
                    }))
                  ]}
                />
              </Card>
            )
          }
        ]}
      />

      <Modal
        title={editingUser ? "编辑账号" : "新增账号"}
        open={userModalOpen}
        onCancel={closeUserModal}
        onOk={() => userForm.submit()}
        confirmLoading={saveUserMutation.isPending}
      >
        <Form layout="vertical" form={userForm} onFinish={(values) => saveUserMutation.mutate(values)}>
          <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ required: !editingUser, type: "email" }]}>
            <Input disabled={Boolean(editingUser)} />
          </Form.Item>
          {!editingUser ? (
            <Form.Item label="初始密码" name="password" rules={[{ required: true, min: 8 }]}>
              <Input.Password />
            </Form.Item>
          ) : null}
          <Form.Item label="角色" name="role" rules={[{ required: true }]}>
            <Select options={userRoleList.map((role) => ({ value: role, label: renderRoleText(role) }))} />
          </Form.Item>
          {editingUser ? (
            <Form.Item label="启用状态" name="isActive" valuePropName="checked">
              <Switch disabled={editingUser.id === currentUserId} />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>

      <Modal
        title={`重置密码：${resetUser?.name ?? ""}`}
        open={Boolean(resetUser)}
        onCancel={() => setResetUser(null)}
        onOk={() => resetForm.submit()}
        confirmLoading={resetPasswordMutation.isPending}
      >
        <Form layout="vertical" form={resetForm} onFinish={(values) => resetPasswordMutation.mutate(values)}>
          <Form.Item label="新密码" name="password" rules={[{ required: true, min: 8 }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function renderRole(role: string) {
  return <Tag color={role === "ADMIN" ? "red" : role === "HR_LEAD" ? "blue" : "default"}>{renderRoleText(role)}</Tag>;
}

function renderRoleText(role: string) {
  const labels: Record<string, string> = {
    ADMIN: "管理员",
    HR_LEAD: "招聘负责人",
    RECRUITER: "招聘专员",
    HIRING_MANAGER: "用人经理",
    INTERVIEWER: "面试官",
    EXECUTIVE: "管理层"
  };
  return labels[role] ?? role;
}
