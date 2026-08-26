import { NextResponse } from "next/server";
import { quoteShipping, shippingQuerySchema } from "@/core/commerce-sandbox";
import { commerceErrorResponse } from "@/lib/commerce-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = shippingQuerySchema.parse({
      productId: url.searchParams.get("productId") ?? undefined,
      destination: url.searchParams.get("destination") ?? undefined,
    });
    return NextResponse.json(quoteShipping(query));
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
