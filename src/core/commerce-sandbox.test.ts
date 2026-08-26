import { describe, expect, it } from "vitest";
import {
  checkout,
  CommerceSandboxError,
  createCart,
  getProduct,
  quoteShipping,
  searchProducts,
} from "./commerce-sandbox";

const now = new Date("2026-08-18T12:00:00.000Z");

describe("commerce protocol sandbox", () => {
  it("searches only shippable in-stock products under the landed budget", () => {
    const result = searchProducts({ q: "", destination: "DE", budget: 35 });

    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products.every((product) => product.shippable)).toBe(true);
    expect(result.products.every((product) => (product.landedTotal ?? Infinity) <= 35)).toBe(true);
    expect(result.products.some((product) => product.id === "product-d")).toBe(false);
  });

  it("returns evidence and explicit trust zones with the product passport", () => {
    const result = getProduct("product-a", "DE");

    expect(result.product.passportVersion).toBe(1);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.trustBoundary.reviews).toBe("untrusted_observation");
  });

  it("quotes destination-specific shipping", () => {
    const result = quoteShipping({ productId: "product-a", destination: "DE" });

    expect(result.eligible).toBe(true);
    expect(result.fee.amount).toBe(4);
    expect(result.deliveryDays).toBe(3);
  });

  it("requires confirmation before completing a mock checkout", () => {
    const cart = createCart({ productId: "product-a", quantity: 1, destination: "DE" }, now);
    const blocked = checkout(
      { checkoutToken: cart.checkoutToken, confirmation: false },
      new Date("2026-08-18T12:01:00.000Z"),
    );
    const confirmed = checkout(
      { checkoutToken: cart.checkoutToken, confirmation: true },
      new Date("2026-08-18T12:01:00.000Z"),
    );

    expect(blocked.status).toBe("blocked");
    expect(blocked.code).toBe("CONFIRMATION_REQUIRED");
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.payment).toBe("not_captured");
    expect(confirmed.amount.value).toBe(33);
  });

  it("rejects token tampering", () => {
    const cart = createCart({ productId: "product-a", quantity: 1, destination: "DE" }, now);
    const tampered = `${cart.checkoutToken.slice(0, -1)}x`;

    expect(() => checkout({ checkoutToken: tampered, confirmation: true }, now)).toThrow(
      CommerceSandboxError,
    );
  });
});
