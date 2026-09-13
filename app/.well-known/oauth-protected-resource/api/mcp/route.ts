import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const resource = process.env.MCP_RESOURCE_URL ?? new URL("/api/mcp", request.url).toString();
  return NextResponse.json({
    resource,
    authorization_servers: process.env.MCP_AUTHORIZATION_SERVER ? [process.env.MCP_AUTHORIZATION_SERVER] : [],
    scopes_supported: ["catalog:read", "commerce:quote", "commerce:write"],
    bearer_methods_supported: ["header"],
  });
}
