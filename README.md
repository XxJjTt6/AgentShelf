<div align="center">

# AgentShelf

### AI 商品上新质检与安全发布平台

把跨境商品上新从“生成一段 Listing”升级为“整理事实、生成内容、规则检查、红队测试、修复复测、人工确认”的可追溯发布流程。

[![许可证](https://img.shields.io/badge/license-Apache--2.0-2ea44f?style=flat-square&logo=apache)](./LICENSE) [![单元测试](https://img.shields.io/badge/tests-55%20passed-2ea44f?style=flat-square&logo=vitest)](./package.json) [![端到端测试](https://img.shields.io/badge/e2e-10%20passed-2ea44f?style=flat-square&logo=playwright)](./tests/e2e) [![在线体验](https://img.shields.io/badge/demo-online-1769e0?style=flat-square&logo=googlechrome)](http://47.93.220.66:8082/)

[在线体验](http://47.93.220.66:8082/)

</div>

---

![AgentShelf 商品上新工作台](./docs/screenshots/desktop-solution-overview.png)

## 项目简介

跨境卖家上新时，商品事实往往分散在 CSV、图片、认证资料和平台政策中；同一商品还要适配不同平台、市场、语言、价格、库存与配送条件。普通 AI 工具可以生成文案，却不能稳定回答三个问题：**卖点来自哪里、商业状态是否仍然正确、购物 Agent 会不会被错误信息或恶意内容误导。**

AgentShelf 以版本化 `Product Passport` 为商品事实源，生成带证据的本地化 Listing，并在发布前核对平台规则、卖点来源、价格、库存、运费、配送和用户确认。风险被发现时，系统阻止模拟交易；修复会生成新版本，并在相同任务和故障下复测。

## 界面预览

| 商品资料与上新 | 风险检测与修复 |
| --- | --- |
| ![商品资料编译](./docs/screenshots/desktop-compiler.png) | ![受控风险阻断](./docs/screenshots/desktop-failed.png) |
| ![上新任务](./docs/screenshots/desktop-mission-run.png) | ![修复后复测](./docs/screenshots/desktop-repaired.png) |

| 平台协议沙箱 | 故障库 |
| --- | --- |
| ![协议适配与模拟结账](./docs/screenshots/desktop-protocol-sandbox.png) | ![故障库](./docs/screenshots/desktop-fault-library.png) |

## 核心能力

| 能力 | 说明 |
| --- | --- |
| Product Passport | 保存商品事实、来源、冲突、未知项和版本 |
| 多平台 Listing | 支持 Amazon、Shopify、TikTok Shop，以及德国和美国市场 |
| 发布前检查 | 检查事实来源、平台字段、价格、库存、配送和退货规则 |
| Agent 红队测试 | 覆盖间接指令注入、事实污染、商业状态和跨境政策风险 |
| 修复与复测 | 在隔离副本中修复，生成版本差异并用同一任务复测 |
| 人工确认 | 结账和发布导出属于高风险操作，不能由商品内容或 Agent 自行授权 |

## 一次演示会发生什么

```text
CSV / 图片 / 政策资料
  -> Product Passport（来源、冲突、未知项、版本）
  -> 本地化 Listing（平台 / 市场 / 语言）
  -> 平台规则与卖点来源检查
  -> 买家任务 + 受控故障红队测试
  -> 交易阻止 / 新版本修复 / 同条件复测
  -> 人工确认 -> Listing、Feed、报告与批准记录导出
```

## 为什么不是普通 Listing 生成器

| 普通上新工具 | AgentShelf |
| --- | --- |
| 输出标题、卖点与描述 | 输出 Listing，并绑定每条卖点的事实来源 |
| 假定输入资料正确 | 保留原始资料、冲突、未知项和版本 |
| 主要检查文本格式 | 同时核对平台规则、价格、库存、运费与配送 |
| 很少验证购物 Agent 行为 | 用任务库和受控故障检查“看对、选对、买对” |
| 修复后难以证明风险消失 | 修复生成新版本，并用相同条件复测 |
| 自动化结果可能直接影响业务 | 人工确认是发布和模拟结账的最后闸门 |

## Agent 技术架构

```text
目录 Agent -> 上架 Agent -> 风险 Agent -> 发布 Agent
      |            |            |            |
      +------------ Agent Harness -------------+
                       |
       Guardrail / MCP / A2A / Trace / Eval
                       |
              人工确认与商业沙箱
```

### Multi-Agent 编排

- **目录 Agent**读取商品事实和来源，保留冲突与未知项。
- **上架 Agent**生成平台和市场对应的 Listing 草稿，并绑定证据。
- **风险 Agent**执行事实、注入、商业状态和跨境规则检查。
- **发布 Agent**只能在人工确认后导出发布文件。

这是固定角色和确定性策略的编排，不是无限递归的通用自主规划 Agent。

### Harness 与 Guardrail

Agent Harness 使用能力白名单、步骤预算和发布闸门限制工具权限。工具级 Guardrail 在调用前后检查参数、商品版本、价格、库存、用户确认和返回结果；未确认结账、导出或超出调用预算时直接阻断。

### MCP、A2A 与 Trace

项目提供以下接口：

| 接口 | 作用 |
| --- | --- |
| `/api/mcp` | JSON-RPC 工具列表和工具调用 |
| `/.well-known/agent-card.json` | 对外声明 Agent 身份、技能和交互能力 |
| `/.well-known/oauth-protected-resource/api/mcp` | MCP 资源、scope 和 Bearer 元数据 |
| `/api/trace` | 输出工作流、Agent、工具和 Guardrail Trace |
| `/api/evals` | 检查阻断、人工确认、证据绑定和 Trace 完整性 |
| `/api/health` | 输出版本、能力和沙箱状态 |

状态变更工具支持可选 Bearer / HS256 JWT、资源指示器、scope、请求体限制和调用限流。

## 在线体验

打开 [http://47.93.220.66:8082/](http://47.93.220.66:8082/)。无需账号，所有商业操作都在沙箱中模拟，`payment=not_captured`。

推荐路径：

1. 在商品档案中载入示例资料并查看来源。
2. 在上新任务中选择平台、市场和语言。
3. 查看 Listing、来源映射和平台检查。
4. 在红队测试中查看受控风险和阻断结果。
5. 生成修复并复测同一任务。
6. 在发布文件中完成人工确认并查看证据导出。

## 本地运行

需要 Node.js 24+ 与 npm 11+。

```bash
npm ci
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1 --port 3010
```

打开 `http://127.0.0.1:3010/`。未配置模型密钥时，商品资料、Listing、规则检查、红队测试、修复复测和商业沙箱仍可演示。

## Docker 部署

```bash
docker compose up -d --build
```

容器对外监听 `8082`，内部监听 `3010`。部署后运行：

```bash
./scripts/verify-deployment.sh http://127.0.0.1:8082
```

远程部署脚本：

```bash
DEPLOY_HOST=your-server DEPLOY_USER=your-user ./scripts/deploy-remote.sh
```

脚本不会上传 `.env.local`，真实密钥应通过服务器 Secret 或受限环境文件提供。

## 测试与质量检查

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

当前本地验证包含 55 项单元测试、10 项端到端测试、生产构建、Docker 容器探活和关键 Agent 接口检查。npm 官方 registry 审计未发现已知漏洞。

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
