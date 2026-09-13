import { describe, expect, it } from "vitest";
import { runAgentEval } from "./agent-evals";

describe("agent evaluation", () => {
  it("checks the baseline block and repaired confirmation separately", () => {
    const result = runAgentEval();
    expect(result.baseline.checks.confirmationGate).toBe(true);
    expect(result.repaired.checks.confirmationGate).toBe(true);
    expect(result.repaired.passed).toBe(true);
  });

  it("publishes policy-layer coverage beyond prompt injection", () => {
    const result = runAgentEval();
    expect(result.advancedThreatCoverage).toHaveLength(5);
    expect(result.advancedThreatCoverage.map((item) => item.category)).toEqual([
      "tool-misuse",
      "excessive-agency",
      "inter-agent",
      "resource-overload",
      "memory-poisoning",
    ]);
  });
});
