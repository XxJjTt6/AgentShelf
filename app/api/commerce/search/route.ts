import { NextResponse } from "next/server";
import { searchProducts, searchQuerySchema } from "@/core/commerce-sandbox";
import { commerceErrorResponse } from "@/lib/commerce-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = searchQuerySchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      destination: url.searchParams.get("destination") ?? undefined,
      budget: url.searchParams.get("budget") ?? undefined,
    });
    return NextResponse.json(searchProducts(query));
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
