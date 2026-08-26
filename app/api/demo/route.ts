import { NextResponse } from "next/server";
import { z } from "zod";
import { runDemo } from "@/core/engine";
import { generateModelAudit, qwenConfig } from "@/lib/qwen";

export const runtime = "nodejs";

const requestSchema = z.object({
  mode: z.enum(["baseline", "repaired"]),
  useModel: z.boolean().default(false),
  model: z.string().min(1).max(80).optional(),
});

export async function GET() {
  return NextResponse.json({
    baseline: runDemo("baseline"),
    repaired: runDemo("repaired"),
    model: qwenConfig(),
  });
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const report = runDemo(body.mode);
    const config = qwenConfig(body.model);

    if (!body.useModel) {
      return NextResponse.json({ report, audit: null, model: config });
    }

    if (!config.configured) {
      return NextResponse.json(
        {
          report,
          audit: null,
          model: config,
          warning: "未配置 DASHSCOPE_API_KEY，已使用固定规则检查结果。",
        },
        { status: 200 },
      );
    }

    const audit = await generateModelAudit(report, config.model);
    return NextResponse.json({ report, audit, model: config });
  } catch {
    return NextResponse.json(
      { error: "运行红队测试失败", detail: "请检查任务参数或模型配置后重试。" },
      { status: 400 },
    );
  }
}
