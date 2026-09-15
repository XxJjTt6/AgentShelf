import { expect, test } from "@playwright/test";

test("solution overview explains the business value and opens the working flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /方案总览/ }).click();

  await expect(page.getByRole("heading", { name: "跨境商品上新的 智能体 安全发布平台" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "从资料到安全发布" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Qwen 与固定规则协作" })).toBeVisible();
  await expect(page.getByLabel("已实现的验证能力").getByText("30", { exact: true })).toBeVisible();
  await expect(page.getByText("业务价值", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/desktop-solution-overview.png", fullPage: true });

  await page.getByRole("button", { name: "创建上新任务" }).click();
  await expect(page.getByRole("heading", { name: "创建可追溯的上新任务" })).toBeVisible();
});

test("用户可以选择模型，并在刷新后保留选择", async ({ page }) => {
  let requestedModel: string | undefined;
  await page.route("**/api/audit", async (route) => {
    requestedModel = route.request().postDataJSON()?.model;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ audit: null, warning: null }),
    });
  });

  await page.goto("/");
  const modelSelector = page.getByLabel("选择 AI 模型");
  await expect(modelSelector).toHaveValue(/qwen/);
  await modelSelector.selectOption("qwen-plus");
  await page.locator(".nav-list").getByRole("button", { name: "红队测试", exact: true }).click();
  await page.getByRole("button", { name: "开始红队测试" }).click();
  await expect.poll(() => requestedModel).toBe("qwen-plus");

  await page.reload();
  await expect(page.getByLabel("选择 AI 模型")).toHaveValue("qwen-plus");
});

test("launch task generates an evidence-backed listing and sends it to red-team testing", async ({ page }) => {
  await page.goto("/");
  await page.locator(".nav-list").getByRole("button", { name: /上新任务/ }).click();

  await expect(page.getByRole("heading", { name: "创建可追溯的上新任务" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Amazon 草稿" })).toBeVisible();
  await expect(page.getByText("每条商品卖点都能找到来源")).toBeVisible();
  await expect(page.getByText("可以测试")).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/desktop-memphis-launch.png", fullPage: true });

  await page.getByLabel("使用 Qwen 优化 商品上架内容 结构").uncheck();
  await page.getByRole("button", { name: "重新生成 商品上架内容" }).click();
  // 等生成请求真正结束（按钮从"正在生成"恢复），再继续后续操作，避免过期响应竞态
  await expect(page.getByRole("button", { name: "重新生成 商品上架内容" })).toBeEnabled();
  await expect(page.getByText("按可信资料生成")).toBeVisible();

  await page.getByLabel("销售平台").selectOption("shopify");
  await page.getByLabel("目标市场").selectOption("US");
  await expect(page.getByRole("heading", { name: "Shopify 草稿" })).toBeVisible();
  await expect(page.getByLabel("输出语言")).toHaveValue("英语 (en-US)");

  await page.getByRole("button", { name: "进入红队测试" }).click();
  await expect(page.getByRole("heading", { name: "纽约 到手价验证" })).toBeVisible();
  await expect(page.getByText(/AtlasLite Travel Packing Organizer Set/)).toBeVisible();

  await page.getByLabel("启用 Qwen 复核").uncheck();
  await page.getByRole("button", { name: "开始红队测试" }).click();
  await expect(page.getByText("交易已阻止")).toBeVisible();
  await page.getByRole("button", { name: "生成修复并复测" }).click();
  await expect(page.getByText("模拟交易已确认")).toBeVisible();

  await page.getByRole("tab", { name: "发布文件" }).click();
  await expect(page.getByText("Shopify / 美国", { exact: true })).toBeVisible();
  await expect(page.getByText("10 个")).toBeVisible();
  await expect(page.getByText("mission-regression-report.json", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "技术检查通过，等待人工确认" })).toBeVisible();
  await page.getByLabel("我已核对商品内容与目标市场").check();
  await page.getByLabel("我已确认价格、库存和配送状态").check();
  await expect(page.getByRole("heading", { name: "修复版本已通过发布检查" })).toBeVisible();
  await expect(page.getByText("release-approval.json", { exact: true })).toBeVisible();
  await expect(page.getByText("11 个")).toBeVisible();
  const listingDownload = page.waitForEvent("download");
  await page.getByTitle("下载 shopify-us-listing.json").click();
  expect((await listingDownload).suggestedFilename()).toBe("shopify-us-listing.json");
});

test("desktop demo completes the attack, repair, and retest loop", async ({ page }) => {
  await page.goto("/");
  await page.locator(".nav-list").getByRole("button", { name: "红队测试", exact: true }).click();
  await expect(page.getByRole("heading", { name: "柏林限时旅行收纳采购" })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始红队测试" })).toBeVisible();

  await page.getByLabel("启用 Qwen 复核").uncheck();
  await page.getByRole("button", { name: "开始红队测试" }).click();
  const failedResult = page.locator(".transaction-result");
  await expect(failedResult.getByText("交易已阻止")).toBeVisible();
  await expect(failedResult.getByText("$43.00", { exact: true })).toBeVisible();

  await page.screenshot({ path: "test-results/screenshots/desktop-failed.png", fullPage: true });

  await page.getByRole("button", { name: "生成修复并复测" }).click();
  const repairedResult = page.locator(".transaction-result");
  await expect(repairedResult.getByText("模拟交易已确认")).toBeVisible();
  await expect(repairedResult.getByText("$33.00", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: /问题与修复/ }).click();
  await expect(page.getByText("4 个已修复")).toBeVisible();
  await expect(page.getByText("passport-v2.json")).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/desktop-repaired.png", fullPage: true });

  await page.getByRole("tab", { name: "发布文件" }).click();
  await page.getByLabel("我已核对商品内容与目标市场").check();
  await page.getByLabel("我已确认价格、库存和配送状态").check();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTitle("下载 red-team-report.json").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("red-team-report.json");
});

test("mobile layout keeps the primary run controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator(".nav-list").getByRole("button", { name: "红队测试", exact: true }).click();
  const runButton = page.getByRole("button", { name: "开始红队测试" });
  await expect(runButton).toBeVisible();
  await expect(page.getByRole("heading", { name: "柏林限时旅行收纳采购" })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/mobile-ready.png", fullPage: true });

  await page.getByRole("button", { name: /协议适配/ }).click();
  await expect(page.getByRole("button", { name: "开始协议测试" })).toBeVisible();
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  await page.screenshot({ path: "test-results/screenshots/mobile-protocol-ready.png", fullPage: true });
});

test("catalog compiler imports CSV, policy, and product imagery", async ({ page }) => {
  await page.goto("/");
  await page.locator(".nav-list").getByRole("button", { name: /商品档案/ }).click();
  await expect(page.getByRole("heading", { name: "整理商品档案" })).toBeVisible();

  await page.getByRole("button", { name: "载入示例材料" }).click();
  await expect(page.getByText("sample-catalog.csv")).toBeVisible();
  await expect(page.getByText("sample-policy.txt")).toBeVisible();
  await expect(page.getByText("1 张图片")).toBeVisible();

  await page.getByLabel("启用 Qwen 图文资料识别").uncheck();
  await page.getByRole("button", { name: "生成 商品档案" }).click();

  await expect(page.getByText("3 个可用")).toBeVisible();
  await expect(page.getByText("ATLAS-CUBE-3-TEAL")).toBeVisible();
  await expect(page.getByText("原始资料已保留")).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/desktop-compiler.png", fullPage: true });

  await page.getByRole("button", { name: "进入上新任务" }).click();
  await expect(page.getByRole("heading", { name: "创建可追溯的上新任务" })).toBeVisible();
  await expect(page.getByText("3 条", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Amazon 草稿" })).toBeVisible();
  await page.getByLabel("使用 Qwen 优化 商品上架内容 结构").uncheck();
  await page.getByRole("button", { name: "重新生成 商品上架内容" }).click();
  // 等生成请求真正结束（按钮从"正在生成"恢复），再继续后续操作，避免过期响应竞态
  await expect(page.getByRole("button", { name: "重新生成 商品上架内容" })).toBeEnabled();
  await expect(page.getByText("按可信资料生成")).toBeVisible();
  await page.getByRole("button", { name: "进入红队测试" }).click();
  await expect(page.getByText("Amazon / 德国上新")).toBeVisible();
  await page.getByLabel("启用 Qwen 复核").uncheck();
  await page.getByRole("button", { name: "开始红队测试" }).click();
  await expect(page.getByText("交易已阻止")).toBeVisible();
});

test("mission library exposes 30 cases and launches a selected mission", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /任务库/ }).click();
  await expect(page.getByRole("heading", { name: "买家测试任务" })).toBeVisible();
  await expect(page.getByText("30 / 30")).toBeVisible();

  await page.getByLabel("搜索任务").fill("纽约");
  await page.getByRole("button", { name: /纽约 到手价验证/ }).click();
  await page.getByRole("button", { name: /开始测试/ }).click();

  await expect(page.getByRole("heading", { name: "纽约 到手价验证" })).toBeVisible();
  await expect(page.getByText("美国 / 纽约")).toBeVisible();
  await page.getByLabel("启用 Qwen 复核").uncheck();
  await page.getByRole("button", { name: "开始红队测试" }).click();
  await expect(page.getByText("交易已阻止")).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/desktop-mission-run.png", fullPage: true });
});

test("fault library exposes four controlled families and payload details", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /故障库/ }).click();

  await expect(page.getByRole("heading", { name: "商品与交易故障库" })).toBeVisible();
  await expect(page.getByText("4 类 / 12 个案例")).toBeVisible();
  await page.getByRole("tab", { name: "商品信息冲突 3" }).click();
  await expect(page.getByText("3 个", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /图片与文本尺寸冲突/ }).click();
  await expect(page.getByRole("heading", { name: "图片与文本尺寸冲突" })).toBeVisible();
  await expect(page.getByText("listing.width=30cm; image_label.width=26cm")).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/desktop-fault-library.png", fullPage: true });

  await page.getByRole("button", { name: "用这个故障开始红队测试" }).click();
  await expect(page.getByText("故障场景 / fault-fact-002")).toBeVisible();
  await expect(page.getByRole("tab", { name: /问题与修复 1/ })).toBeVisible();
  await page.getByLabel("启用 Qwen 复核").uncheck();
  await page.getByRole("button", { name: "开始红队测试" }).click();
  await expect(page.getByText("交易已阻止")).toBeVisible();
  await page.getByRole("button", { name: "生成修复并复测" }).click();
  await expect(page.getByText("模拟交易已确认")).toBeVisible();
});

test("protocol sandbox runs live commerce endpoints through the confirmation gate", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /协议适配/ }).click();

  await expect(page.getByRole("heading", { name: "协议适配测试" })).toBeVisible();
  await expect(page.getByText("5 个实时 API")).toBeVisible();
  await page.getByRole("button", { name: "开始协议测试" }).click();

  await expect(page.getByRole("dialog", { name: "人工确认模拟结账" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("轮到你了：人工确认")).toBeVisible();
  await page.getByRole("button", { name: "我确认，完成模拟结账" }).click();

  const waterfall = page.locator(".protocol-step-list");
  await expect(page.locator(".protocol-response-panel pre")).toContainText(
    '"status": "confirmed"',
    { timeout: 20_000 },
  );
  await expect(waterfall.locator(".protocol-step.pass")).toHaveCount(5);
  await expect(waterfall.locator(".protocol-step.blocked")).toHaveCount(1);
  await expect(page.locator(".protocol-response-panel pre")).toContainText('"payment": "not_captured"');
  await page.screenshot({ path: "test-results/screenshots/desktop-protocol-sandbox.png", fullPage: true });
});
