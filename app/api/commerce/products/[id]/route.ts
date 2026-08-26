import { NextResponse } from "next/server";
import { getProduct, productQuerySchema } from "@/core/commerce-sandbox";
import { commerceErrorResponse } from "@/lib/commerce-api";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const url = new URL(request.url);
    const { id } = await context.params;
    const query = productQuerySchema.parse({
      destination: url.searchParams.get("destination") ?? undefined,
    });
    return NextResponse.json(getProduct(id, query.destination));
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
