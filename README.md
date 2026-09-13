<div align="center">

# AgentShelf

### 面向跨境电商的 Agent 商品上新质检与安全发布平台

将商品资料整理、Listing 生成、事实核验、红队测试、修复复测和人工确认串成一条可追溯的发布流程。

[在线体验](http://47.93.220.66:8082/)

</div>

## 项目简介

AgentShelf 面向需要在 Amazon、Shopify 和 TikTok Shop 上新的跨境团队。系统把 CSV、商品图片和政策资料整理为带来源的 Product Passport，再生成面向不同平台、市场和语言的商品 Listing。

与普通文案生成器不同，AgentShelf 会在发布前检查卖点来源、平台字段、价格、库存、运费、配送和用户确认，并通过受控风险场景验证购物 Agent 是否会被不可信内容误导。所有交易均在沙箱中模拟，不会产生真实支付。

## 在线体验

<http://47.93.220.66:8082/>

无需账号。建议按“商品档案 → 上新任务 → 红队测试 → 修复复测 → 发布文件”的顺序体验。

## 核心能力

- **Product Passport**：统一保存商品事实、来源、冲突、未知项和版本。
- **多平台上新**：支持 Amazon、Shopify、TikTok Shop，以及德国和美国市场。
- **证据绑定 Listing**：每条卖点关联来源，未验证的认证和承诺不会进入发布内容。
- **发布前检查**：检查平台字段、语言、价格、库存、运费、配送和退货规则。
- **Agent 红队测试**：覆盖间接指令注入、事实污染、商业状态和跨境政策风险。
- **修复与复测**：在隔离副本中修复，生成新版本和结构化差异，再用相同任务复测。
- **工具安全边界**：购物车、结账和导出工具分级；高风险操作必须人工确认。
- **可审计 Agent 运行**：提供 Harness、Guardrail、Trace、Eval 和风险覆盖矩阵。

## 系统架构

```text
商品资料 / CSV / 图片 / 政策
              |
              v
       Product Passport
              |
   目录 Agent -> 上架 Agent
              |
       风险 Agent / Guardrail
              |
    修复复测 -> 人工确认 -> 导出
              |
       Commerce Sandbox
```

Agent 工作流采用固定角色和确定性策略，不是无限递归的通用自主规划。模型用于非结构化理解和结构建议，金额、库存、配送、版本和发布权限由规则与 Harness 决定。

## Agent 接口

| 能力 | 地址 | 说明 |
| --- | --- | --- |
| MCP 工具 | `/api/mcp` | JSON-RPC 工具列表和工具调用 |
| A2A Agent Card | `/.well-known/agent-card.json` | Agent 身份、技能和交互能力 |
| MCP 资源元数据 | `/.well-known/oauth-protected-resource/api/mcp` | 资源、scope 和 Bearer 方式 |
| Agent Trace | `/api/trace?mode=baseline` | 工作流、Agent、工具和 Guardrail 运行记录 |
| Agent Eval | `/api/evals` | 阻断、确认、证据和 Trace 评测 |
| 健康检查 | `/api/health` | 版本、能力和沙箱状态 |

状态变更工具支持可选的 Bearer / HS256 JWT 校验、资源指示器、scope、请求体限制和调用限流。默认配置保持本地演示免登录；生产环境应设置 `MCP_REQUIRE_AUTH=1`、`MCP_JWT_SECRET` 和 `MCP_RESOURCE_URL`。

## 本地运行

### 环境要求

- Node.js 24+
- npm 11+
- 可选：阿里云百炼 API Key

### 安装和启动

```bash
npm ci
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1 --port 3010
```

打开 <http://127.0.0.1:3010/>。未配置模型密钥时，确定性规则流程仍可完整演示。

## Docker 部署

```bash
docker compose up -d --build
```

容器对外监听 `8082`，内部监听 `3010`。健康检查访问 `/api/health`。

部署后可以运行：

```bash
./scripts/verify-deployment.sh http://127.0.0.1:8082
```

远程部署脚本需要先提供 SSH 环境变量：

```bash
DEPLOY_HOST=your-server DEPLOY_USER=your-user ./scripts/deploy-remote.sh
```

脚本不会上传 `.env.local`，真实密钥应通过服务器 Secret 或受限环境文件提供。

## 测试与质量检查

```bash
npm test
npm run lint
npm run build
```

当前本地验证包含 55 项单元测试、10 项端到端测试、生产构建、Docker 容器探活和关键 Agent 接口检查。

## 目录结构

```text
app/                         Next.js 页面和 Route Handlers
app/api/mcp/                 MCP JSON-RPC 工具入口
app/.well-known/             Agent Card 和资源授权元数据
src/core/                    Product Passport、Agent、Harness、Guardrail、Trace、Eval、沙箱
src/lib/                     Qwen 和商业接口适配
public/                      演示用商品资料和图片
scripts/                     部署后接口探活和远程部署脚本
Dockerfile                  standalone 生产镜像
docker-compose.yml          单实例部署配置
```

## 安全边界和限制

- 商品、价格、库存、配送和支付均为演示数据或沙箱状态。
- 不接入真实 Amazon、Shopify 或 TikTok Shop 发布 API。
- 结账始终为确认式模拟结账，`payment=not_captured`。
- 预设故障用于工程覆盖，不代表未知攻击检出率。
- 当前没有真实卖家试点数据，不声称已验证 ROI、转化率或效率提升比例。
- 多实例生产部署仍需要共享限流、持久化存储、完整 OAuth 2.1、日志脱敏和监控。

## 许可证

本项目采用 Apache License 2.0，详见 [LICENSE](./LICENSE)。
