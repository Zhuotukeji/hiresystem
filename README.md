# 招聘系统

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
APP_VERSION=$(git rev-parse --short HEAD) APP_BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) docker compose -f docker-compose.prod.yml up -d --build --force-recreate api web
```

生产环境建议：

- PostgreSQL 使用阿里云 RDS
- 简历附件使用 OSS
- ECS 安全组只开放 80/443/SSH
- `.env` 中配置真实 `DATABASE_URL` 和 `SUB2API_*`
- AI 默认模型为 `gpt-5.5`，生产环境在 `.env` 中配置 `SUB2API_MODEL=gpt-5.5`
- AI 默认使用 `SUB2API_REASONING_EFFORT=none`，更偏速度；如果网关不支持会自动降级到可用档位；`SUB2API_MAX_RETRIES=3` 可降低上游 502 抖动对页面的影响
- `/api/health` 会返回版本、构建时间、关键 AI 路由、AI 的 baseURL、model、reasoning effort、timeout、retry 和 API Key 配置状态，便于确认线上是否部署到最新镜像。面试套件修复生效时，应看到 `routes.interviewKits=/api/ai/interview-kits` 且 `features.interviewKitFallback=true`
- 排查线上接口错误时，可临时设置 `DEBUG_ERRORS=true` 并重建 API 容器；接口响应会带 `requestId/details/stack`，API 日志也会按 `requestId` 打印完整异常栈。排查完成后建议关闭。
- 简历判定通过后，初面套件改为后台生成，避免接口同步等待第二次 AI 调用
