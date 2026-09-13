import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "agentshelf",
    version: process.env.APP_VERSION ?? "0.2.0",
    commit: process.env.APP_COMMIT ?? "local",
    capabilities: ["mcp", "a2a-agent-card", "agent-trace", "agent-eval"],
    sandboxOnly: true,
    checkedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
