import { NextResponse } from "next/server";
import { checkout, checkoutRequestSchema } from "@/core/commerce-sandbox";
import { commerceErrorResponse } from "@/lib/commerce-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = checkoutRequestSchema.parse(await request.json());
    return NextResponse.json(checkout(body));
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
