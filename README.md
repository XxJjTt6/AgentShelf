# AgentShelf

AgentShelf 是面向跨境卖家和电商 ISV 的 AI 商品安全上新平台。项目只选择比赛“AI 智能上新”命题，完成商品资料整理、本地化 Listing、发布前检查、Agent 红队测试、修复复测和人工确认发布的完整流程。

它不只检查“文案写得好不好”，还验证商品进入 AI 购物流程后，Agent 能不能看对、选对和买对。

## 已实现能力

- 导入商品 CSV、TXT/Markdown 政策文件和最多 4 张商品图片。
- 生成带来源、版本、冲突和未知项的 Product Passport。
- 支持 Amazon、Shopify、TikTok Shop 以及德国、美国目标市场。
- 生成德语或英语 Listing，包含标题、卖点、描述和 Search Terms。
- 保存每条卖点的可信来源，并执行平台发布前检查。
- 提供 30 个买家测试任务，覆盖预算与币种、跨境配送、商品事实与认证、退货与授权。
- 提供 12 个受控故障案例，覆盖指令注入、商业状态、商品事实和跨境政策。
- 重现搜索、选择、加购和模拟结账轨迹，异常时阻止交易。
- 生成非破坏性修复版本，并用同一任务和故障复测。
- 发布前强制人工确认商品内容、目标市场、价格、库存和配送状态。
- 提供 5 个可调用的商业沙箱 API，以及 UCP、ACP、MCP 能力映射。
- 导出 Listing、平台导入表、Product Passport、Product Feed、Schema.org JSON-LD、UCP Manifest、检查报告和红队测试报告。
- 支持桌面、平板和手机界面。

## 七个工作区

1. **方案总览**：说明业务问题、五步闭环、AI 分工、已实现能力和评审价值。
2. **上新任务**：选择商品、销售平台、目标市场、语言和品类，生成 Listing。
3. **商品档案**：把 CSV、政策和图片整理为 Product Passport。
4. **红队测试**：运行买家任务和故障，展示交易阻止、修复和复测。
5. **任务库**：查看、筛选并运行 30 个买家测试任务。
6. **故障库**：查看并运行 4 类 12 个受控故障案例。
7. **协议适配**：测试商业 API 和 UCP、ACP、MCP 能力映射。

## AI 与固定规则如何分工

Qwen 用于：

- 识别商品图片和政策资料中的信息。
- 优化 Listing 的卖点和关键词结构。
- 对红队运行结果进行语义复核。

固定规则用于：

- 校验 Product Passport 和模型结构化输出。
- 核对预算、价格、库存、运费、配送范围和商品版本。
- 执行平台格式、卖点来源和高风险表述检查。
- 决定交易是否阻止、是否需要人工确认。

模型只能提出结构化建议，不能直接覆盖原始商品事实，也不能直接发布或支付。未配置 Qwen API Key 时，系统会保留完整的固定规则流程。

## 本地运行

环境要求：Node.js 24 或兼容版本、npm 11 或兼容版本。

```bash
npm install
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1 --port 3010
```

浏览器访问 `http://127.0.0.1:3010/`。

## 可选模型配置

```dotenv
DASHSCOPE_API_KEY=your-api-key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen3.8-max
COMMERCE_SANDBOX_SECRET=replace-with-a-random-sandbox-secret
```

密钥只写入 `.env.local`。该文件已被 `.gitignore` 排除，不要把 API Key 写入源码、测试、截图或提交记录。

## 商业沙箱 API

```text
GET  /api/commerce/search?q=Atlas&destination=DE&budget=35
GET  /api/commerce/products/product-a?destination=DE
GET  /api/commerce/shipping?productId=product-a&destination=DE
POST /api/commerce/cart
POST /api/commerce/checkout
```

购物车返回带 HMAC 签名、十分钟有效的 `checkoutToken`。第一次未确认结账会返回 `CONFIRMATION_REQUIRED`；只有显式确认且价格、库存、运费、商品版本均未变化时才返回 `confirmed`。演示始终保持 `payment=not_captured`，不会触发真实支付。

## 推荐演示路径

1. 打开“方案总览”，用 30 秒说明问题、流程和 AI 分工。
2. 在“商品档案”载入 CSV、政策和图片，生成 Product Passport。
3. 在“上新任务”选择平台和市场，展示 Listing、卖点来源和发布前检查。
4. 进入“红队测试”，运行原始版本并展示“交易已阻止”。
5. 点击“生成修复并复测”，展示新版本通过同一场景。
6. 在“发布文件”完成两项人工确认并下载测试证据。
7. 在“协议适配”运行 5 个商业 API 和确认式模拟结账。

## 验证

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

当前验证基线为 30 个 Vitest 单元测试和 9 个 Playwright 端到端场景。浏览器测试还会在 1440px、1024px、390px 三种视口检查七个工作区是否发生横向溢出或面板覆盖。

## 目录

```text
app/
  api/catalog/compile/      商品资料整理 API
  api/launch/generate/      Listing 生成 API
  api/audit/                Qwen 语义复核 API
  api/commerce/             商业沙箱 API
  api/model/health/         模型配置状态
  page.tsx                  操作台入口

src/
  components/               前端工作区
  core/importer.ts          导入校验和 Product Passport 生成
  core/launch.ts            Listing、平台规则和卖点来源
  core/missions.ts          30 个买家任务
  core/faults.ts            12 个受控故障
  core/fault-injector.ts    数据副本故障注入
  core/engine.ts            运行、评分、阻止和修复
  core/regression.ts        批量测试与统计
  core/release.ts           发布文件生成
  core/commerce-sandbox.ts  签名购物车和确认式模拟结账
  lib/qwen*.ts              阿里云百炼适配与结构化约束

submission/                 完整参赛提交材料包
tests/e2e/                  浏览器端到端测试
```

完整参赛材料已整理为 [PDF 评审版](./submission/final/pdf/AgentShelf_完整参赛提交材料.pdf) 和 [Word 可编辑版](./submission/final/word/AgentShelf_完整参赛提交材料.docx)，包含初赛文案、技术方案、业务价值、架构图、测试报告、视频脚本和提交清单。

## 安全边界

- 只执行模拟结账，不调用真实支付。
- 故障只注入商品数据副本，不修改原始记录。
- 评论、网页文本和图片 OCR 默认是不可信数据。
- 固定规则负责预算、日期、库存、运费、金额和工具权限。
- 模型输出不能直接覆盖商品事实，修复必须生成新版本。
- 自动检查通过后仍需人工确认。

## 参考资料

- [阿里云百炼模型列表](https://help.aliyun.com/zh/model-studio/model-list-text-generation/)
- [Qwen API 的 OpenAI 兼容方式](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)
- [Universal Commerce Protocol](https://ucp.dev/)
- [Agentic Commerce Protocol](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
