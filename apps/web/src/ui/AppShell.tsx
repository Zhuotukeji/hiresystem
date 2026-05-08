import { Layout, Menu, Button, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Building2, ClipboardList, Gauge, LogOut, Search, UserRoundCheck, UsersRound } from "lucide-react";
import { clearToken } from "../api/client";

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: "/", icon: <Gauge size={18} />, label: "招聘驾驶舱" },
  { key: "/candidates", icon: <UsersRound size={18} />, label: "候选人库" },
  { key: "/companies", icon: <Building2 size={18} />, label: "目标公司库" },
  { key: "/jobs", icon: <ClipboardList size={18} />, label: "岗位工作台" },
  { key: "/manager-review", icon: <UserRoundCheck size={18} />, label: "用人经理快审" },
  { key: "/jobs?mode=sourcing", icon: <Search size={18} />, label: "Sourcing" }
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedKey =
    menuItems.find((item) => item.key !== "/" && location.pathname.startsWith(item.key.split("?")[0]))?.key ?? "/";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={224}>
        <div style={{ height: 64, display: "flex", alignItems: "center", padding: "0 20px" }}>
          <Typography.Text style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Hiresystem</Typography.Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={(item) => navigate(item.key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 20px"
          }}
        >
          <Typography.Text strong>人才雷达与招聘效率系统</Typography.Text>
          <Button
            icon={<LogOut size={16} />}
            onClick={() => {
              clearToken();
              navigate("/login");
            }}
          >
            退出
          </Button>
        </Header>
        <Content>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
