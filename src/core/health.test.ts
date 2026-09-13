import { describe, expect, it } from "vitest";
import { GET } from "../../app/api/health/route";

describe("health endpoint", () => {
  it("returns a no-store readiness response without secrets", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("ok");
    expect(body.capabilities).toContain("mcp");
    expect(JSON.stringify(body)).not.toContain("DASHSCOPE_API_KEY");
  });
});
