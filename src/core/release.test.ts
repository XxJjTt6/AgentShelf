import { describe, expect, it } from "vitest";
import { demoCatalog } from "./catalog";
import { runDemo } from "./engine";
import { generateListingDraft } from "./launch";
import { buildReleaseArtifacts } from "./release";

describe("launch release package", () => {
  it("exports the localized listing, platform preflight, and evidence ledger", () => {
    const draft = generateListingDraft(demoCatalog[0], {
      productId: demoCatalog[0].id,
      platform: "shopify",
      market: "US",
      language: "en-US",
      category: demoCatalog[0].category,
    });
    const artifacts = buildReleaseArtifacts(runDemo("repaired"), draft);
    const names = artifacts.map((artifact) => artifact.name);

    expect(names).toEqual(expect.arrayContaining([
      "shopify-us-listing.json",
      "shopify-us-listing.csv",
      "shopify-us-preflight-report.json",
      "shopify-us-claim-evidence.json",
      "red-team-report.json",
    ]));

    const listing = JSON.parse(
      artifacts.find((artifact) => artifact.name === "shopify-us-listing.json")?.body ?? "{}",
    );
    const evidence = JSON.parse(
      artifacts.find((artifact) => artifact.name === "shopify-us-claim-evidence.json")?.body ?? "{}",
    );
    expect(listing.locale).toBe("en-US");
    expect(listing.outputVersion).toBe(draft.outputVersion);
    expect(evidence.claims.every((claim: { verified: boolean }) => claim.verified)).toBe(true);
  });

  it("keeps generic release files for tasks that did not start from a listing draft", () => {
    const artifacts = buildReleaseArtifacts(runDemo("repaired"));

    expect(artifacts).toHaveLength(5);
    expect(artifacts.some((artifact) => artifact.name.endsWith("-listing.json"))).toBe(false);
  });

  it("adds a traceable approval record only after both human checks are confirmed", () => {
    const report = runDemo("repaired");
    const artifacts = buildReleaseArtifacts(report, null, {
      contentConfirmed: true,
      commerceStateConfirmed: true,
      confirmedAt: "2026-08-19T08:00:00.000Z",
    });
    const approval = JSON.parse(
      artifacts.find((artifact) => artifact.name === "release-approval.json")?.body ?? "{}",
    );

    expect(approval).toMatchObject({
      runId: report.id,
      contentConfirmed: true,
      commerceStateConfirmed: true,
      confirmedAt: "2026-08-19T08:00:00.000Z",
    });
  });

  it("neutralizes spreadsheet formulas in exported listing cells", () => {
    const draft = generateListingDraft({ ...demoCatalog[0], title: "=2+2 AtlasLite" }, {
      productId: demoCatalog[0].id,
      platform: "amazon",
      market: "DE",
      language: "de-DE",
      category: demoCatalog[0].category,
    });
    const artifact = buildReleaseArtifacts(runDemo("repaired"), draft)
      .find((item) => item.name === "amazon-de-listing.csv");

    expect(artifact?.body).toContain("'=2+2");
  });
});
