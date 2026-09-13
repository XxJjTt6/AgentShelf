import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/mcp/route";
import { GET as getAgentCard } from "../../app/.well-known/agent-card.json/route";

describe("MCP commerce endpoint", () => {
  it("advertises namespaced tools", async () => {
    const response = await POST(new Request("http://localhost/api/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      headers: { "content-type": "application/json" },
    }));
    const body = await response.json();
    expect(body.result.structuredContent.tools.map((tool: { name: string }) => tool.name)).toContain("commerce.checkout");
  });

  it("returns a blocked structured result when checkout lacks confirmation", async () => {
    const cartResponse = await POST(new Request("http://localhost/api/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "commerce.create_cart", arguments: { productId: "product-a", destination: "DE" } } }),
      headers: { "content-type": "application/json" },
    }));
    const cart = await cartResponse.json();
    const checkoutResponse = await POST(new Request("http://localhost/api/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "commerce.checkout", arguments: { checkoutToken: cart.result.structuredContent.checkoutToken, confirmation: false } } }),
      headers: { "content-type": "application/json" },
    }));
    const checkoutBody = await checkoutResponse.json();
    expect(checkoutBody.result.structuredContent.status).toBe("blocked");
    expect(checkoutBody.result.structuredContent.guardrail.status).toBe("blocked");
  });

  it("serves an A2A-style Agent Card", async () => {
    const response = await getAgentCard();
    const body = await response.json();
    expect(body.name).toBe("AgentShelf Preflight Agent");
  });

  it("rejects an oversized MCP request before parsing or tool execution", async () => {
    const response = await POST(new Request("http://localhost/api/mcp", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json", "content-length": "600000" },
    }));
    expect(response.status).toBe(413);
  });
});
