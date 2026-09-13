import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authorizeMcpTool } from "./mcp-auth";

describe("MCP authorization boundary", () => {
  it("keeps local sandbox tools convenient when auth is not enabled", () => {
    delete process.env.MCP_REQUIRE_AUTH;
    expect(authorizeMcpTool("commerce.checkout", null, "secret").status).toBe("allowed");
  });

  it("requires a bearer token for protected tools when enabled", () => {
    process.env.MCP_REQUIRE_AUTH = "1";
    expect(authorizeMcpTool("commerce.checkout", null, "secret").status).toBe("unauthorized");
    expect(authorizeMcpTool("commerce.checkout", "Bearer wrong", "secret").status).toBe("unauthorized");
    expect(authorizeMcpTool("commerce.checkout", "Bearer secret", "secret").status).toBe("allowed");
    delete process.env.MCP_REQUIRE_AUTH;
  });

  it("does not require auth for read-only tools", () => {
    process.env.MCP_REQUIRE_AUTH = "1";
    expect(authorizeMcpTool("catalog.get_product", null, "secret").status).toBe("allowed");
    delete process.env.MCP_REQUIRE_AUTH;
  });

  it("binds protected calls to the configured resource indicator", () => {
    process.env.MCP_REQUIRE_AUTH = "1";
    process.env.MCP_RESOURCE_URL = "https://demo.example/api/mcp";
    expect(authorizeMcpTool("commerce.checkout", "Bearer secret", "secret", "https://other.example/api/mcp").status).toBe("unauthorized");
    expect(authorizeMcpTool("commerce.checkout", "Bearer secret", "secret", "https://demo.example/api/mcp").status).toBe("allowed");
    delete process.env.MCP_REQUIRE_AUTH;
    delete process.env.MCP_RESOURCE_URL;
  });

  it("verifies an HS256 JWT audience, scope and expiry when configured", () => {
    const secret = "jwt-secret";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      aud: "https://demo.example/api/mcp",
      scope: "commerce:write",
      exp: Math.floor(Date.now() / 1_000) + 60,
    })).toString("base64url");
    const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    const token = `${header}.${payload}.${signature}`;
    process.env.MCP_REQUIRE_AUTH = "1";
    process.env.MCP_JWT_SECRET = secret;
    process.env.MCP_RESOURCE_URL = "https://demo.example/api/mcp";
    expect(authorizeMcpTool("commerce.checkout", `Bearer ${token}`, undefined, "https://demo.example/api/mcp").status).toBe("allowed");
    expect(authorizeMcpTool("commerce.checkout", `Bearer ${token}`, undefined, "https://other.example/api/mcp").status).toBe("unauthorized");
    delete process.env.MCP_REQUIRE_AUTH;
    delete process.env.MCP_JWT_SECRET;
    delete process.env.MCP_RESOURCE_URL;
  });
});
