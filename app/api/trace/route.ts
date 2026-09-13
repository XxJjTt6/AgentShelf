import { NextResponse } from "next/server";
import { runDemo } from "@/core/engine";
import { buildAgentTrace } from "@/core/agent-trace";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode") === "repaired" ? "repaired" : "baseline";
  return NextResponse.json(buildAgentTrace(runDemo(mode)));
}
