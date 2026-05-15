# 阿里云 ECS 部署说明

## 1. 资源建议

- ECS：2 vCPU / 4 GB 起步，Ubuntu 22.04 LTS。
- RDS PostgreSQL：PostgreSQL 16，开启自动备份。
- OSS：用于后续简历附件存储。
- 安全组：开放 22、80、443；数据库仅允许 ECS 内网访问。
- 入口：使用机器已有 nginx，不再启动 Caddy。

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
cp deploy/production.env.example .env
chmod 600 .env
```

编辑 `.env`，必须配置：

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://<user>:<password>@<rds-host>:5433/<db>?schema=public
JWT_SECRET=<strong-random-secret>
SUB2API_BASE_URL=https://ai.midongtech.com/v1
SUB2API_API_KEY=<server-secret>
SUB2API_MODEL=gpt-5.5
```

不要把 `.env` 提交到 GitHub。

## 4. 构建和启动

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f api
```

如果线上 AI 报 `Invalid API key`，优先检查 ECS 当前 `.env` 和容器内环境变量：

```bash
grep -n '^SUB2API_' .env
docker compose -f docker-compose.prod.yml exec api sh -lc 'echo "model=$SUB2API_MODEL"; test -n "$SUB2API_API_KEY" && echo "api_key=configured" || echo "api_key=missing"'
curl http://127.0.0.1:3001/api/health
```

修改 `.env` 后需要重建/重启 API 容器让新密钥生效：

```bash
docker compose -f docker-compose.prod.yml up -d --build --force-recreate api
```

生产 compose 不再占用 80/443：

- API：`127.0.0.1:3001`
- Web：`127.0.0.1:5173`

首次上线后进入 API 容器执行 seed：

```bash
docker compose -f docker-compose.prod.yml exec api pnpm prisma:seed
```

## 5. nginx 入口

把 `deploy/nginx-hiresystem.conf` 合并到机器已有 nginx 配置，或按你的域名改 `server_name` 后启用：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

核心代理关系：

- `/api/` -> `http://127.0.0.1:3001/api/`
- `/` -> `http://127.0.0.1:5173`

## 6. 验收

```bash
curl http://127.0.0.1:3001/api/health
curl http://<domain-or-ecs-ip>/api/health
```

浏览器访问：

```text
http://<domain-or-ecs-ip>
```

默认账号：

- `admin@hiresystem.local`
- `Admin123!`

上线后请立即修改管理员密码，并将默认密码从 seed 逻辑中替换为一次性初始化流程。
