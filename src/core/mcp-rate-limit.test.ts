import { describe, expect, it } from "vitest";
import { checkMcpRateLimit } from "./mcp-rate-limit";

describe("MCP rate limit", () => {
  it("blocks repeated calls within a bounded window", () => {
    const first = checkMcpRateLimit("rate-test", 1_000, 2);
    const second = checkMcpRateLimit("rate-test", 2_000, 2);
    const third = checkMcpRateLimit("rate-test", 3_000, 2);
    expect(first.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
  });

  it("starts a fresh window after one minute", () => {
    expect(checkMcpRateLimit("rate-reset", 1_000, 1).allowed).toBe(true);
    expect(checkMcpRateLimit("rate-reset", 61_000, 1).allowed).toBe(true);
  });
});
