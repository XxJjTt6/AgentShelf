import { NextResponse } from "next/server";
import { z } from "zod";
import { generateModelAudit, qwenConfig } from "@/lib/qwen";

export const runtime = "nodejs";

const scoreSchema = z.number().min(0).max(100);
const requestSchema = z.object({
  useModel: z.boolean().default(true),
  model: z.string().min(1).max(80).optional(),
  report: z.object({
    mode: z.enum(["baseline", "repaired"]),
    mission: z.object({
      id: z.string().max(120),
      title: z.string().max(200),
      request: z.string().max(2_000),
      destinationCountry: z.string().max(8),
      destinationCity: z.string().max(120),
      budget: z.number().nonnegative(),
      currency: z.literal("USD"),
      maxDeliveryDays: z.number().int().positive(),
      requiredAttributes: z.array(z.string().max(120)).max(30),
      forbiddenClaims: z.array(z.string().max(160)).max(30),
      confirmationRequired: z.boolean(),
    }),
    selection: z.object({
      productId: z.string().nullable(),
      subtotal: z.number().nonnegative(),
      shippingFee: z.number().nonnegative(),
      checkoutTotal: z.number().nonnegative(),
      displayedTotal: z.number().nonnegative(),
      currency: z.literal("USD"),
      decision: z.enum(["blocked", "confirmed", "no-match"]),
      reason: z.string().max(1_000),
    }),
    scores: z.object({
      discovery: scoreSchema,
      constraints: scoreSchema,
      faithfulness: scoreSchema,
      attackResistance: scoreSchema,
      amountConsistency: scoreSchema,
      completion: scoreSchema,
      overall: scoreSchema,
    }),
    findings: z.array(
      z.object({
        failureClass: z.enum(["看不见", "看错", "选错", "买错"]),
        severity: z.enum(["critical", "high", "medium", "low"]),
        title: z.string().max(240),
        detail: z.string().max(1_000),
        evidence: z.string().max(1_000),
        repaired: z.boolean(),
      }),
    ).max(100),
    events: z.array(
      z.object({
        title: z.string().max(240),
        detail: z.string().max(1_000),
        status: z.enum(["success", "risk", "blocked", "info"]),
        source: z.string().max(240),
      }),
    ).max(200),
  }),
});

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 512 * 1024) {
      return NextResponse.json({ error: "审计报告超过 512 KB 限制。" }, { status: 413 });
    }
    const input = requestSchema.parse(await request.json());
    const config = qwenConfig(input.model);
    if (!input.useModel) {
      return NextResponse.json({ audit: null, model: config });
    }
    if (!config.configured) {
      return NextResponse.json({
        audit: null,
        model: config,
        warning: "未配置 DASHSCOPE_API_KEY，已保留固定规则检查结果。",
      });
    }
    const audit = await generateModelAudit(input.report, config.model);
    return NextResponse.json({ audit, model: config });
  } catch {
    return NextResponse.json(
      {
        error: "运行语义复核失败",
        detail: "Qwen 复核暂不可用，请检查模型配置后重试。",
      },
      { status: 400 },
    );
  }
}
