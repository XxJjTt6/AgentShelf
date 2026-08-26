import { NextResponse } from "next/server";
import { cartRequestSchema, createCart } from "@/core/commerce-sandbox";
import { commerceErrorResponse } from "@/lib/commerce-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = cartRequestSchema.parse(await request.json());
    return NextResponse.json(createCart(body), { status: 201 });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
