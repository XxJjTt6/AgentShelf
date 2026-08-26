import { describe, expect, it } from "vitest";
import { demoCatalog } from "./catalog";
import { runMissionRegression } from "./regression";

describe("mission regression suite", () => {
  it("executes all 30 missions instead of showing a hard-coded coverage count", () => {
    const report = runMissionRegression(demoCatalog, "repaired");

    expect(report.total).toBe(30);
    expect(report.cases).toHaveLength(30);
    expect(report.suites.reduce((total, suite) => total + suite.total, 0)).toBe(30);
    expect(report.cases.every((item) => item.missionId && item.title)).toBe(true);
  });

  it("separates baseline failures from repaired passes", () => {
    const baseline = runMissionRegression(demoCatalog, "baseline");
    const repaired = runMissionRegression(demoCatalog, "repaired");

    expect(baseline.passed).toBeLessThan(baseline.total);
    expect(repaired.passed).toBe(repaired.total);
    expect(repaired.averageScore).toBeGreaterThan(baseline.averageScore);
  });
});
