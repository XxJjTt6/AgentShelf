import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    name: "AgentShelf Preflight Agent",
    description: "跨境商品发布前的事实、平台规则和交易安全检查 Agent。",
    version: "0.2.0",
    documentationUrl: "http://47.93.220.66:8082/",
    supportedInterfaces: [{ url: "/api/mcp", protocolBinding: "JSONRPC", protocolVersion: "2025-06-18" }],
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["application/json", "text/csv"],
    defaultOutputModes: ["application/json"],
    skills: [
      { id: "compile_product_passport", name: "商品事实整理", description: "读取商品来源、冲突、未知项和版本。", tags: ["catalog", "provenance"] },
      { id: "validate_listing", name: "上架内容检查", description: "检查平台字段、卖点证据、市场和语言。", tags: ["listing", "validation"] },
      { id: "run_red_team_preflight", name: "发布前红队检查", description: "检查间接指令、事实污染和商业状态风险。", tags: ["security", "red-team"] },
      { id: "verify_commerce_state", name: "交易状态核验", description: "核对价格、库存、配送和用户确认。", tags: ["commerce", "safety"] },
    ],
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    securityRequirements: [{ bearerAuth: [] }],
    securityNotes: [
      "commerce.checkout 必须携带用户显式 confirmation=true。",
      "所有交易仅在沙箱执行，payment=not_captured。",
    ],
  });
}
