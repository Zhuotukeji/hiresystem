# Hiresystem

面向 50-100 人互联网创业公司的招聘系统，首版聚焦人才库、目标公司库、岗位画像、AI JD、AI 简历判定、面试套件流转和招聘看板。

## Tech Stack

- Web: React + Vite + TypeScript + Ant Design + TanStack Query
- API: NestJS + Prisma + PostgreSQL
- AI: OpenAI-compatible Sub2API
- Deploy: Alibaba Cloud ECS + Docker Compose + RDS PostgreSQL + OSS

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

默认管理员账号由 seed 创建：

- Email: `admin@hiresystem.local`
- Password: `Admin123!`

## Security

不要提交真实 `.env`。`SUB2API_API_KEY`、数据库密码和 OSS 密钥必须放在本地环境变量、ECS 环境变量或 GitHub Secrets 中。

## Production

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

生产环境建议：

- PostgreSQL 使用阿里云 RDS
- 简历附件使用 OSS
- ECS 安全组只开放 80/443/SSH
- `.env` 中配置真实 `DATABASE_URL` 和 `SUB2API_*`
