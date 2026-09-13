import { NextResponse } from "next/server";
import { runAgentEval } from "@/core/agent-evals";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(runAgentEval());
}
