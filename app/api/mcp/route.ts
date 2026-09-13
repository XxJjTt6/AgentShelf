import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeMcpTool } from "@/core/mcp-auth";
import { checkMcpRateLimit } from "@/core/mcp-rate-limit";
import {
  checkout,
  checkoutRequestSchema,
  createCart,
  cartRequestSchema,
  getProduct,
  productQuerySchema,
  quoteShipping,
  searchProducts,
  searchQuerySchema,
  shippingQuerySchema,
} from "@/core/commerce-sandbox";

export const runtime = "nodejs";

const SERVER_INFO = {
  name: "agentshelf-commerce-sandbox",
  version: "0.2.0",
};

const TOOLS = [
  {
    name: "catalog.search_products",
    description: "按商品事实、目的国和到手预算搜索可配送商品。只读。",
    inputSchema: { type: "object", properties: { q: { type: "string" }, destination: { type: "string" }, budget: { type: "number" } } },
  },
  {
    name: "catalog.get_product",
    description: "读取商品 Product Passport、来源和信任边界。只读。",
    inputSchema: { type: "object", required: ["productId"], properties: { productId: { type: "string" }, destination: { type: "string" } } },
  },
  {
    name: "commerce.quote_shipping",
    description: "读取目的国配送报价和退货规则。只读。",
    inputSchema: { type: "object", required: ["productId"], properties: { productId: { type: "string" }, destination: { type: "string" } } },
  },
  {
    name: "commerce.create_cart",
    description: "创建带商品版本和过期时间的签名购物车。不会扣款。",
    inputSchema: { type: "object", required: ["productId"], properties: { productId: { type: "string" }, quantity: { type: "integer", minimum: 1 }, destination: { type: "string" } } },
  },
  {
    name: "commerce.checkout",
    description: "确认式模拟结账。必须提供用户显式 confirmation=true；payment 永远为 not_captured。",
    inputSchema: { type: "object", required: ["checkoutToken", "confirmation"], properties: { checkoutToken: { type: "string" }, confirmation: { type: "boolean" } } },
  },
] as const;

function jsonRpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });
}

function toolResult(id: unknown, result: unknown) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    },
  });
}

export async function POST(request: Request) {
  const maxBodyBytes = Number(process.env.MCP_MAX_BODY_BYTES ?? 512_000);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBodyBytes) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32013, message: "MCP request body too large" } },
      { status: 413 },
    );
  }
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-client";
  const rateLimit = checkMcpRateLimit(clientKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32029, message: "MCP request rate limit exceeded" } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds), "X-RateLimit-Remaining": "0" } },
    );
  }
  let body: { id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "Invalid JSON");
  }
  const id = body.id ?? null;
  const params = body.params ?? {};

  if (body.method === "initialize") {
    return toolResult(id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: "工具调用受商品版本、信任边界和人工确认策略约束。",
    });
  }
  if (body.method === "notifications/initialized") {
    return new NextResponse(null, { status: 202 });
  }
  if (body.method === "tools/list") return toolResult(id, { tools: TOOLS });
  if (body.method !== "tools/call") return jsonRpcError(id, -32601, "Method not found");

  const name = typeof params.name === "string" ? params.name : "";
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  const auth = authorizeMcpTool(name, request.headers.get("authorization"), undefined, typeof params.resource === "string" ? params.resource : undefined);
  if (auth.status === "unauthorized") {
    return NextResponse.json(
      { jsonrpc: "2.0", id, error: { code: -32001, message: auth.reason } },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="agentshelf-mcp"' } },
    );
  }
  try {
    switch (name) {
      case "catalog.search_products":
        return toolResult(id, searchProducts(searchQuerySchema.parse(args)));
      case "catalog.get_product": {
        const input = z.object({ productId: z.string().trim().min(1).max(120), destination: productQuerySchema.shape.destination }).parse({
          productId: args.productId,
          destination: args.destination,
        });
        return toolResult(id, getProduct(input.productId, input.destination));
      }
      case "commerce.quote_shipping":
        return toolResult(id, quoteShipping(shippingQuerySchema.parse(args)));
      case "commerce.create_cart":
        return toolResult(id, createCart(cartRequestSchema.parse(args)));
      case "commerce.checkout":
        return toolResult(id, checkout(checkoutRequestSchema.parse(args)));
      default:
        return jsonRpcError(id, -32602, `Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool call failed";
    return jsonRpcError(id, -32602, message);
  }
}

export async function GET() {
  return NextResponse.json({ ...SERVER_INFO, transport: "streamable-http", tools: TOOLS.map((tool) => tool.name) });
}
