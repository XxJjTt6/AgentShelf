import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { demoCatalog } from "./catalog";
import type { ProductPassport } from "./types";
import { checkToolGuardrail } from "./tool-guardrails";

const sandboxSecret = process.env.COMMERCE_SANDBOX_SECRET ?? "agentshelf-sandbox-only-v1";

export const searchQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  destination: z.string().trim().toUpperCase().length(2).default("DE"),
  budget: z.coerce.number().positive().max(100_000).optional(),
});

export const productQuerySchema = z.object({
  destination: z.string().trim().toUpperCase().length(2).default("DE"),
});

export const shippingQuerySchema = z.object({
  productId: z.string().trim().min(1).max(120),
  destination: z.string().trim().toUpperCase().length(2).default("DE"),
});

export const cartRequestSchema = z.object({
  productId: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(10).default(1),
  destination: z.string().trim().toUpperCase().length(2).default("DE"),
});

export const checkoutRequestSchema = z.object({
  checkoutToken: z.string().min(20).max(4_096),
  confirmation: z.boolean().default(false),
});

interface CheckoutPayload {
  productId: string;
  quantity: number;
  destination: string;
  unitPrice: number;
  shippingFee: number;
  total: number;
  currency: "USD";
  catalogVersion: number;
  expiresAt: string;
}

function findProduct(productId: string) {
  const product = demoCatalog.find((item) => item.id === productId || item.sku === productId);
  if (!product) throw new CommerceSandboxError("PRODUCT_NOT_FOUND", "商品不存在。", 404);
  return product;
}

function shippingFor(product: ProductPassport, destination: string) {
  return product.shipping.find((rule) => rule.country === destination);
}

function productSummary(product: ProductPassport, destination: string) {
  const shipping = shippingFor(product, destination);
  const supportedClaims = product.claims.filter((claim) => claim.supported);
  return {
    id: product.id,
    sku: product.sku,
    title: product.title,
    category: product.category,
    price: { amount: product.price, currency: product.currency },
    availability: product.stock > 0 ? "in_stock" : "out_of_stock",
    stock: product.stock,
    destination,
    shippable: Boolean(shipping),
    landedTotal: shipping ? product.price + shipping.fee : null,
    deliveryDays: shipping?.deliveryDays ?? null,
    attributes: {
      material: product.material,
      waterResistant: product.waterResistant,
    },
    claims: supportedClaims.map((claim) => ({
      text: claim.text,
      evidenceIds: claim.evidenceIds,
    })),
    passportVersion: product.version,
  };
}

function encodeToken(payload: CheckoutPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", sandboxSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function decodeToken(token: string): CheckoutPayload {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) {
    throw new CommerceSandboxError("INVALID_CHECKOUT_TOKEN", "结账令牌格式无效。", 400);
  }

  const expected = createHmac("sha256", sandboxSecret).update(encoded).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    throw new CommerceSandboxError("INVALID_CHECKOUT_TOKEN", "结账令牌签名无效。", 400);
  }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new CommerceSandboxError("INVALID_CHECKOUT_TOKEN", "结账令牌签名无效。", 400);
  }

  try {
    return z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      destination: z.string().length(2),
      unitPrice: z.number().nonnegative(),
      shippingFee: z.number().nonnegative(),
      total: z.number().nonnegative(),
      currency: z.literal("USD"),
      catalogVersion: z.number().int().positive(),
      expiresAt: z.string().datetime(),
    }).parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  } catch {
    throw new CommerceSandboxError("INVALID_CHECKOUT_TOKEN", "结账令牌内容无效。", 400);
  }
}

export class CommerceSandboxError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function searchProducts(input: z.infer<typeof searchQuerySchema>) {
  const normalized = searchQuerySchema.parse(input);
  const terms = normalized.q.toLowerCase().split(/\s+/).filter(Boolean);
  const products = demoCatalog
    .map((product) => productSummary(product, normalized.destination))
    .filter((product) => {
      const searchable = `${product.title} ${product.sku} ${product.category}`.toLowerCase();
      const queryMatch = terms.length === 0 || terms.every((term) => searchable.includes(term));
      const budgetMatch = normalized.budget === undefined || (
        product.landedTotal !== null && product.landedTotal <= normalized.budget
      );
      return queryMatch && budgetMatch && product.availability === "in_stock" && product.shippable;
    })
    .sort((left, right) => (left.landedTotal ?? Infinity) - (right.landedTotal ?? Infinity));

  return {
    protocol: "AgentShelf Commerce Sandbox/0.1",
    query: normalized,
    count: products.length,
    products,
  };
}

export function getProduct(productId: string, destination = "DE") {
  const normalized = productQuerySchema.parse({ destination });
  const product = findProduct(productId);
  return {
    protocol: "AgentShelf Commerce Sandbox/0.1",
    product: productSummary(product, normalized.destination),
    evidence: product.evidence,
    trustBoundary: {
      reviews: "untrusted_observation",
      merchantEvidence: "verified_source",
      runtimeCommerceState: "authoritative_at_checkout",
    },
  };
}

export function quoteShipping(input: z.infer<typeof shippingQuerySchema>) {
  const normalized = shippingQuerySchema.parse(input);
  const product = findProduct(normalized.productId);
  const shipping = shippingFor(product, normalized.destination);
  if (!shipping) {
    throw new CommerceSandboxError("DESTINATION_NOT_SUPPORTED", "商品不支持该目的国配送。", 422);
  }
  if (product.stock <= 0) {
    throw new CommerceSandboxError("OUT_OF_STOCK", "商品当前无库存。", 409);
  }
  return {
    quoteId: `ship-${product.id}-${normalized.destination}-v${product.version}`,
    productId: product.id,
    destination: normalized.destination,
    eligible: true,
    fee: { amount: shipping.fee, currency: shipping.currency },
    deliveryDays: shipping.deliveryDays,
    returnsDays: shipping.returnsDays,
    observedAt: new Date().toISOString(),
  };
}

export function createCart(
  input: z.infer<typeof cartRequestSchema>,
  now = new Date(),
) {
  const normalized = cartRequestSchema.parse(input);
  const product = findProduct(normalized.productId);
  const shipping = shippingFor(product, normalized.destination);
  if (!shipping) {
    throw new CommerceSandboxError("DESTINATION_NOT_SUPPORTED", "商品不支持该目的国配送。", 422);
  }
  if (product.stock < normalized.quantity) {
    throw new CommerceSandboxError("INSUFFICIENT_STOCK", "商品库存不足。", 409);
  }

  const subtotal = product.checkoutPrice * normalized.quantity;
  const total = subtotal + shipping.fee;
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1_000).toISOString();
  const payload: CheckoutPayload = {
    productId: product.id,
    quantity: normalized.quantity,
    destination: normalized.destination,
    unitPrice: product.checkoutPrice,
    shippingFee: shipping.fee,
    total,
    currency: product.currency,
    catalogVersion: product.version,
    expiresAt,
  };

  return {
    cartId: `cart-${product.id}-v${product.version}`,
    lines: [{
      productId: product.id,
      sku: product.sku,
      title: product.title,
      quantity: normalized.quantity,
      unitPrice: product.checkoutPrice,
    }],
    destination: normalized.destination,
    totals: {
      subtotal,
      shipping: shipping.fee,
      total,
      currency: product.currency,
    },
    requiresConfirmation: true,
    guardrail: checkToolGuardrail("create_cart"),
    checkoutToken: encodeToken(payload),
    expiresAt,
  };
}

export function checkout(
  input: z.infer<typeof checkoutRequestSchema>,
  now = new Date(),
) {
  const normalized = checkoutRequestSchema.parse(input);
  const payload = decodeToken(normalized.checkoutToken);
  if (Date.parse(payload.expiresAt) <= now.getTime()) {
    throw new CommerceSandboxError("CHECKOUT_TOKEN_EXPIRED", "结账令牌已过期。", 410);
  }
  if (!normalized.confirmation) {
    const guardrail = checkToolGuardrail("checkout", normalized);
    return {
      status: "blocked" as const,
      code: "CONFIRMATION_REQUIRED",
      message: "商品内容不能代替用户授权，必须取得显式确认。",
      amount: { value: payload.total, currency: payload.currency },
      guardrail,
    };
  }

  const product = findProduct(payload.productId);
  const shipping = shippingFor(product, payload.destination);
  const currentTotal = product.checkoutPrice * payload.quantity + (shipping?.fee ?? 0);
  const stateMatches = Boolean(
    shipping &&
      product.stock >= payload.quantity &&
      product.version === payload.catalogVersion &&
      Math.abs(currentTotal - payload.total) < 0.001,
  );
  if (!stateMatches) {
    throw new CommerceSandboxError(
      "COMMERCIAL_STATE_CHANGED",
      "价格、库存、运费或商品版本已变化，请重新生成购物车。",
      409,
    );
  }

  return {
    status: "confirmed" as const,
    orderId: `mock-order-${product.sku}-v${product.version}`,
    payment: "not_captured",
    amount: { value: payload.total, currency: payload.currency },
    destination: payload.destination,
    safety: "sandbox_only",
    guardrail: checkToolGuardrail("checkout", normalized),
  };
}
