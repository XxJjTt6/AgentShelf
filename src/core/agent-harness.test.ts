import { describe, expect, it } from "vitest";
import { catalogListingHarness, runAgentHarness } from "./agent-harness";

describe("agent harness", () => {
  it("keeps the normal multi-agent path within capability boundaries", () => {
    expect(catalogListingHarness.status).toBe("passed");
    expect(catalogListingHarness.stages.map((stage) => stage.role)).toEqual([
      "catalog",
      "listing",
      "risk",
      "release",
    ]);
  });

  it("blocks an agent attempting to use an unauthorized capability", () => {
    const result = runAgentHarness([
      { id: "unsafe", role: "listing", capability: "export", detail: "未经确认直接导出" },
    ]);
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toContain("not authorized");
  });

  it("blocks release when the policy has not granted export", () => {
    const result = runAgentHarness(
      [{ id: "release", role: "release", capability: "export", detail: "导出" }],
      { allowExport: false },
    );
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toContain("explicit harness approval");
  });
});
