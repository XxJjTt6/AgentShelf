import { describe, expect, it } from "vitest";
import { demoCatalog } from "./catalog";
import { applyListingDraft, generateListingDraft, type LaunchBrief } from "./launch";

const defaultBrief: LaunchBrief = {
  productId: "product-a",
  platform: "amazon",
  market: "DE",
  language: "de-DE",
  category: "Travel Packing Organizers",
};

describe("evidence-backed launch listing", () => {
  it("generates a localized listing whose claims retain trusted evidence", () => {
    const draft = generateListingDraft(demoCatalog[0], defaultBrief);

    expect(draft.status).toBe("ready");
    expect(draft.title).toContain("AtlasLite");
    expect(draft.claims.length).toBeGreaterThan(0);
    expect(draft.claims.every((claim) => claim.verified && claim.evidenceLabels.length > 0)).toBe(true);
    expect(draft.checks.every((check) => check.passed)).toBe(true);
  });

  it("blocks a market without shipping support", () => {
    const draft = generateListingDraft(demoCatalog[3], defaultBrief);

    expect(draft.status).toBe("blocked");
    expect(draft.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "market-shipping", passed: false }),
        expect.objectContaining({ id: "inventory", passed: false }),
      ]),
    );
  });

  it("creates a new catalog version without mutating the source", () => {
    const before = structuredClone(demoCatalog);
    const draft = generateListingDraft(demoCatalog[0], defaultBrief);
    const output = applyListingDraft(demoCatalog, draft);

    expect(output[0].version).toBe(demoCatalog[0].version + 1);
    expect(output[0].title).toBe(draft.title);
    expect(demoCatalog).toEqual(before);
  });

  it("uses only evidence-backed claims when applying a Qwen listing plan", () => {
    const draft = generateListingDraft(
      demoCatalog[0],
      defaultBrief,
      {
        titleClaimId: "claim-a-2",
        claimOrder: ["invented-claim", "claim-a-2", "claim-a-1"],
        descriptionTone: "concise",
        searchTermOrder: [3, 99, 0],
      },
      "qwen3.8-max",
    );

    expect(draft.title).toContain("Drei Größen");
    expect(draft.bullets[0]).toContain("Drei Größen");
    expect(draft.searchTerms[0]).toBe("atlaslite");
    expect(draft.searchTerms).not.toContain(undefined);
    expect(draft.generation).toMatchObject({ mode: "qwen-assisted", model: "qwen3.8-max" });
    expect(draft.claims.every((claim) => claim.id !== "invented-claim")).toBe(true);
  });

  it("applies platform-specific content rules before red-team testing", () => {
    const draft = generateListingDraft(
      { ...demoCatalog[0], title: "#Deal AtlasLite" },
      { ...defaultBrief, platform: "tiktok-shop" },
    );

    expect(draft.status).toBe("blocked");
    expect(draft.checks).toContainEqual(expect.objectContaining({
      id: "platform-format",
      passed: false,
      severity: "blocking",
    }));
  });
});
