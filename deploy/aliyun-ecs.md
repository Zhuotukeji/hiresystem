# 阿里云 ECS 部署说明

## 1. 资源建议

- ECS：2 vCPU / 4 GB 起步，Ubuntu 22.04 LTS
- RDS PostgreSQL：PostgreSQL 16，开启自动备份
- OSS：用于后续简历附件存储
- 安全组：开放 22、80、443，数据库仅允许 ECS 内网访问

## 2. ECS 初始化

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker compose version
```

## 3. 拉取代码

```bash
git clone https://github.com/Zhuotukeji/hiresystem.git
cd hiresystem
cp .env.example .env
```

编辑 `.env`，必须配置：

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@<rds-host>:5432/<db>?schema=public
JWT_SECRET=<strong-random-secret>
SUB2API_BASE_URL=https://ai.midongtech.com/v1
SUB2API_API_KEY=<server-secret>
SUB2API_MODEL=<model-name>
```

不要把 `.env` 提交到 GitHub。

## 4. 构建和启动

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f api
```

API 容器启动时会执行 `prisma migrate deploy`。首次上线后进入 API 容器执行 seed：

```bash
docker compose -f docker-compose.prod.yml exec api pnpm prisma:seed
```

## 5. 验收

```bash
curl http://<ecs-ip>/api/health
```

浏览器访问：

```text
http://<ecs-ip>
```

默认账号：

- `admin@hiresystem.local`
- `Admin123!`

上线后请立即修改管理员密码，并将默认密码从 seed 逻辑中替换为一次性初始化流程。
