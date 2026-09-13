import { describe, expect, it } from "vitest";
import { GET } from "../../app/.well-known/oauth-protected-resource/api/mcp/route";

describe("MCP protected resource metadata", () => {
  it("publishes scoped bearer metadata for the MCP resource", async () => {
    const response = await GET(new Request("http://localhost/.well-known/oauth-protected-resource/api/mcp"));
    const body = await response.json();
    expect(body.resource).toContain("/api/mcp");
    expect(body.scopes_supported).toContain("commerce:write");
  });
});
