import { describe, expect, it } from "vitest";
import { checkToolGuardrail } from "./tool-guardrails";

describe("tool guardrails", () => {
  it("blocks checkout before any financial side effect without confirmation", () => {
    const decision = checkToolGuardrail("checkout", { confirmation: false });
    expect(decision).toMatchObject({ status: "blocked", risk: "financial" });
  });

  it("allows checkout only after explicit confirmation", () => {
    expect(checkToolGuardrail("checkout", { confirmation: true }).status).toBe("allowed");
  });

  it("keeps listing export behind the same human approval boundary", () => {
    expect(checkToolGuardrail("export_listing").status).toBe("blocked");
    expect(checkToolGuardrail("export_listing", { confirmation: true }).status).toBe("allowed");
  });
});
