import { timingSafeEqual } from "node:crypto";
import { createHmac } from "node:crypto";

const protectedTools = new Set(["commerce.create_cart", "commerce.checkout"]);
const requiredScopes: Record<string, string> = {
  "catalog.search_products": "catalog:read",
  "catalog.get_product": "catalog:read",
  "commerce.quote_shipping": "commerce:quote",
  "commerce.create_cart": "commerce:write",
  "commerce.checkout": "commerce:write",
};

export interface McpAuthDecision {
  status: "allowed" | "unauthorized";
  reason: string;
}

function sameSecret(provided: string, expected: string) {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

function decodeBase64Json(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function verifyJwt(token: string, secret: string, resource: string | undefined, scope: string | undefined) {
  const [encodedHeader, encodedPayload, signature, extra] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature || extra) return false;
  const header = decodeBase64Json(encodedHeader);
  const payload = decodeBase64Json(encodedPayload);
  if (header?.alg !== "HS256" || header.typ !== "JWT" || !payload) return false;
  const expected = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  if (!sameSecret(signature, expected)) return false;
  if (typeof payload.exp === "number" && payload.exp <= Math.floor(Date.now() / 1_000)) return false;
  if (resource && !(payload.aud === resource || (Array.isArray(payload.aud) && payload.aud.includes(resource)))) return false;
  if (scope) {
    const granted = typeof payload.scope === "string" ? payload.scope.split(/\s+/) : [];
    if (!granted.includes(scope)) return false;
  }
  return true;
}

export function authorizeMcpTool(
  toolName: string,
  authorizationHeader: string | null,
  expectedToken = process.env.MCP_BEARER_TOKEN,
  resource?: string,
): McpAuthDecision {
  // Local judging stays convenient by default; production can opt into auth for side-effecting tools.
  if (!process.env.MCP_REQUIRE_AUTH || !protectedTools.has(toolName)) {
    return { status: "allowed", reason: "sandbox or read-only tool" };
  }
  if (!authorizationHeader?.startsWith("Bearer ") || (!expectedToken && !process.env.MCP_JWT_SECRET)) {
    return { status: "unauthorized", reason: "Bearer token required for protected MCP tool" };
  }
  const expectedResource = process.env.MCP_RESOURCE_URL;
  if (expectedResource && resource !== expectedResource) {
    return { status: "unauthorized", reason: "Resource indicator does not match this MCP server" };
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();
  const jwtSecret = process.env.MCP_JWT_SECRET;
  const valid = jwtSecret
    ? verifyJwt(token, jwtSecret, expectedResource, requiredScopes[toolName])
    : sameSecret(token, expectedToken ?? "");
  return valid
    ? { status: "allowed", reason: "Bearer token accepted" }
    : { status: "unauthorized", reason: "Bearer token rejected" };
}
