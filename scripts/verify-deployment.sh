#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3010}"
BASE_URL="${BASE_URL%/}"

check() {
  local label="$1" url="$2"
  local status
  status="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 "$url")"
  [[ "$status" == "200" ]] || { echo "$label failed: HTTP $status" >&2; exit 1; }
  echo "$label OK: HTTP $status"
}

check "health" "$BASE_URL/api/health"
check "agent-card" "$BASE_URL/.well-known/agent-card.json"
check "protected-resource-metadata" "$BASE_URL/.well-known/oauth-protected-resource/api/mcp"
check "trace" "$BASE_URL/api/trace?mode=baseline"
check "evals" "$BASE_URL/api/evals"

tools_json="$(curl -fsS --max-time 10 -X POST "$BASE_URL/api/mcp" -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')"
grep -q 'commerce.checkout' <<<"$tools_json" || { echo "mcp tools/list missing commerce.checkout" >&2; exit 1; }
echo "mcp tools/list OK"
