import { NextResponse } from "next/server";
import { z } from "zod";
import { demoCatalog } from "@/core/catalog";
import { generateListingDraft } from "@/core/launch";
import { qwenConfig } from "@/lib/qwen";
import { planListingWithQwen } from "@/lib/qwen-listing";

export const runtime = "nodejs";

const requestSchema = z.object({
  productId: z.string().min(1).max(120),
  platform: z.enum(["amazon", "shopify", "tiktok-shop"]),
  market: z.enum(["DE", "US"]),
  useModel: z.boolean().default(true),
  model: z.string().min(1).max(80).optional(),
  product: z.object({
    id: z.string().min(1).max(120),
    sku: z.string().min(1).max(160),
    title: z.string().min(1).max(500),
    subtitle: z.string().max(500),
    color: z.string().max(80),
    price: z.number().nonnegative(),
    checkoutPrice: z.number().nonnegative(),
    currency: z.literal("USD"),
    stock: z.number().int().nonnegative(),
    category: z.string().min(1).max(240),
    material: z.string().max(500),
    waterResistant: z.boolean(),
    shipping: z.array(z.object({
      country: z.string().min(2).max(8),
      fee: z.number().nonnegative(),
      currency: z.literal("USD"),
      deliveryDays: z.number().int().positive().max(365),
      returnsDays: z.number().int().nonnegative().max(365),
    })).max(30),
    claims: z.array(z.object({
      id: z.string().min(1).max(120),
      text: z.string().min(1).max(500),
      kind: z.enum(["attribute", "marketing", "certification"]),
      evidenceIds: z.array(z.string().max(120)).max(30),
      supported: z.boolean(),
    })).max(80),
    reviews: z.array(z.object({
      id: z.string().min(1).max(120),
      author: z.string().max(160),
      content: z.string().max(2_000),
      trustedAsFact: z.boolean(),
    })).max(100),
    evidence: z.array(z.object({
      id: z.string().min(1).max(120),
      label: z.string().min(1).max(240),
      source: z.enum(["merchant", "image", "policy", "review", "runtime"]),
      trusted: z.boolean(),
      observedAt: z.string().max(80),
    })).max(100),
    version: z.number().int().positive(),
  }).optional(),
});

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 32 * 1024) {
      return NextResponse.json({ error: "上新任务请求超过 32 KB 限制。" }, { status: 413 });
    }
    const input = requestSchema.parse(await request.json());
    const product = demoCatalog.find((item) => item.id === input.productId)
      ?? (input.product?.id === input.productId ? input.product : undefined);
    if (!product) {
      return NextResponse.json({ error: "未找到上新商品。" }, { status: 404 });
    }
    const brief = {
      productId: product.id,
      platform: input.platform,
      market: input.market,
      language: input.market === "DE" ? "de-DE" as const : "en-US" as const,
      category: product.category,
    };
    const deterministicDraft = generateListingDraft(product, brief);
    const config = qwenConfig(input.model);

    if (!input.useModel || !config.configured) {
      return NextResponse.json({
        draft: deterministicDraft,
        model: config,
        warning: input.useModel && !config.configured
          ? "未配置 DASHSCOPE_API_KEY，已改用可信资料规则生成。"
          : null,
      });
    }

    try {
      const plan = await planListingWithQwen(deterministicDraft, config.model);
      return NextResponse.json({
        draft: generateListingDraft(product, brief, plan, config.model),
        model: config,
        warning: null,
      });
    } catch {
      return NextResponse.json({
        draft: deterministicDraft,
        model: config,
        warning: "Qwen 生成规划失败，已改用可信资料规则。",
      });
    }
  } catch {
    return NextResponse.json(
      {
        error: "商品上架内容 生成失败",
        detail: "上新任务参数不完整或格式有误。",
      },
      { status: 400 },
    );
  }
}
