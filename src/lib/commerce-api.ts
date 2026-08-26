import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CommerceSandboxError } from "@/core/commerce-sandbox";

export function commerceErrorResponse(error: unknown) {
  if (error instanceof CommerceSandboxError) {
    return NextResponse.json(
      { error: error.code, detail: error.message, sandbox: true },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", detail: "请求参数不符合商品接口要求。", issues: error.issues },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: "SANDBOX_ERROR", detail: error instanceof Error ? error.message : "模拟交易环境调用失败。" },
    { status: 500 },
  );
}
