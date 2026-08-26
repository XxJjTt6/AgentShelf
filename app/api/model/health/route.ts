import { NextResponse } from "next/server";
import { qwenConfig } from "@/lib/qwen";

export async function GET() {
  const config = qwenConfig();
  return NextResponse.json({
    configured: config.configured,
    model: config.model,
    models: config.models,
    provider: "Alibaba Cloud Model Studio",
  });
}
