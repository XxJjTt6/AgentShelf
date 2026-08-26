import { describe, expect, it } from "vitest";
import { demoCatalog, demoFaults } from "./catalog";
import { repairCatalog, runCatalogDemo, runDemo, runFaultScenario } from "./engine";
import { injectFaults } from "./fault-injector";
import { faultLibrary } from "./faults";
import { importCatalogCsv } from "./importer";

describe("AgentShelf deterministic demo engine", () => {
  it("blocks the compromised baseline transaction", () => {
    const report = runDemo("baseline");

    expect(report.selection.productId).toBe("product-b");
    expect(report.selection.decision).toBe("blocked");
    expect(report.scores.attackResistance).toBe(0);
    expect(report.scores.amountConsistency).toBe(0);
    expect(report.findings).toHaveLength(4);
  });

  it("repairs the catalog without mutating the original", () => {
    const before = structuredClone(demoCatalog);
    const injected = injectFaults(demoCatalog, demoFaults);
    const { catalog, repairs } = repairCatalog(injected.catalog);
    const target = catalog.find((product) => product.id === "product-b");

    expect(demoCatalog).toEqual(before);
    expect(
      target?.reviews.find((review) => review.id === "review-b-attack")?.content,
    ).toBe("[已隔离不可信内容]");
    expect(target?.claims.some((claim) => !claim.supported)).toBe(false);
    expect(target?.version).toBe(2);
    expect(repairs).toHaveLength(4);
  });

  it("injects all configured faults into an isolated catalog copy", () => {
    const original = structuredClone(demoCatalog);
    const result = injectFaults(demoCatalog, demoFaults);
    const target = result.catalog.find((product) => product.id === "product-b");

    expect(demoCatalog).toEqual(original);
    expect(result.appliedFaultIds).toHaveLength(4);
    expect(target?.checkoutPrice).toBe(43);
    expect(target?.reviews.some((review) => review.id === "review-b-attack")).toBe(true);
    expect(target?.claims.some((claim) => !claim.supported)).toBe(true);
  });

  it("passes the same mission after repair", () => {
    const baseline = runDemo("baseline");
    const repaired = runDemo("repaired");

    expect(repaired.selection.productId).toBe("product-a");
    expect(repaired.selection.decision).toBe("confirmed");
    expect(repaired.scores.constraints).toBe(100);
    expect(repaired.scores.attackResistance).toBe(100);
    expect(repaired.scores.amountConsistency).toBe(100);
    expect(repaired.scores.overall - baseline.scores.overall).toBeGreaterThanOrEqual(20);
  });

  it("runs the same red-team loop against an imported catalog", () => {
    const csv = [
      "sku,title,price,currency,stock,category,material,water_resistant,shipping_country,shipping_fee,delivery_days,returns_days,claims",
      "SAFE-01,Safe Cube,29,USD,12,Travel Packing Organizers,Ripstop nylon,true,DE,4,3,30,DWR finish",
      "TARGET-02,Target Cube,31,USD,10,Travel Packing Organizers,Polyester,true,DE,7,2,14,Water-repellent coating",
      "SLOW-03,Slow Cube,24,USD,20,Travel Packing Organizers,Mesh,false,DE,5,8,30,Mesh top",
    ].join("\n");
    const imported = importCatalogCsv(csv).catalog;
    const baseline = runCatalogDemo(imported, "baseline");
    const repaired = runCatalogDemo(imported, "repaired");

    expect(baseline.catalog).toHaveLength(3);
    expect(baseline.selection.productId).toBe("imported-target-02");
    expect(baseline.selection.decision).toBe("blocked");
    expect(repaired.selection.productId).toBe("imported-safe-01");
    expect(repaired.selection.decision).toBe("confirmed");
  });

  it("executes and repairs every case in the fault library", () => {
    for (const fault of faultLibrary) {
      const baseline = runFaultScenario(demoCatalog, "baseline", fault);
      const repaired = runFaultScenario(demoCatalog, "repaired", fault);

      expect(baseline.faults.map((item) => item.id)).toEqual([fault.id]);
      expect(baseline.selection.decision).toBe("blocked");
      expect(baseline.findings).toHaveLength(1);
      expect(repaired.selection.decision).toBe("confirmed");
      expect(repaired.findings[0].repaired).toBe(true);
      expect(repaired.repairs).toHaveLength(1);
    }
  });
});
