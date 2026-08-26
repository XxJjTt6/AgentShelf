import { describe, expect, it } from "vitest";
import { demoCatalog } from "./catalog";
import { injectFaults } from "./fault-injector";
import { activeDemoFaultIds, faultLibrary } from "./faults";

describe("commerce fault library", () => {
  it("contains three cases for every required fault family", () => {
    const familyCounts = faultLibrary.reduce<Record<string, number>>((counts, fault) => {
      counts[fault.family] = (counts[fault.family] ?? 0) + 1;
      return counts;
    }, {});

    expect(faultLibrary).toHaveLength(12);
    expect(familyCounts).toEqual({
      "prompt-injection": 3,
      "commercial-state": 3,
      "fact-pollution": 3,
      "cross-border-policy": 3,
    });
  });

  it("maps the four active demo faults to real library entries", () => {
    const knownIds = new Set(faultLibrary.map((fault) => fault.id));
    expect(activeDemoFaultIds.every((id) => knownIds.has(id))).toBe(true);
  });

  it("injects every library case into an isolated catalog copy", () => {
    const original = structuredClone(demoCatalog);
    const result = injectFaults(demoCatalog, faultLibrary);

    expect(result.appliedFaultIds).toHaveLength(12);
    expect(new Set(result.appliedFaultIds).size).toBe(12);
    expect(demoCatalog).toEqual(original);
  });
});
