import { expect, test, type Page } from "@playwright/test";

const surfaces = [
  { nav: /^方案总览/, heading: "跨境商品上新的 智能体 安全发布平台" },
  { nav: /^上新任务/, heading: "创建可追溯的上新任务" },
  { nav: /^红队测试$/, heading: "柏林限时旅行收纳采购" },
  { nav: /^商品档案/, heading: "整理商品档案" },
  { nav: /^任务库/, heading: "买家测试任务" },
  { nav: /^故障库/, heading: "商品与交易故障库" },
  { nav: /^协议适配/, heading: "协议适配测试" },
] as const;

async function expectStableLayout(page: Page) {
  const audit = await page.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll<HTMLElement>(".tool-panel"))
      .filter((element) => element.offsetParent !== null)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
    const overlaps: Array<[number, number]> = [];
    for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
        const left = boxes[leftIndex];
        const right = boxes[rightIndex];
        const horizontal = Math.min(left.right, right.right) - Math.max(left.left, right.left);
        const vertical = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
        if (horizontal > 1 && vertical > 1) overlaps.push([leftIndex, rightIndex]);
      }
    }
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overlaps,
    };
  });

  expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth);
  expect(audit.overlaps).toEqual([]);
}

test("all seven workspaces remain non-overlapping across desktop, tablet, and mobile", async ({ page }) => {
  const viewports = [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    for (const surface of surfaces) {
      await page.locator(".nav-list").getByRole("button", { name: surface.nav }).click();
      await expect(page.getByRole("heading", { name: surface.heading })).toBeVisible();
      await expectStableLayout(page);
    }
  }
});
