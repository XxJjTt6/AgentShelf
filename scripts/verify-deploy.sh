#!/usr/bin/env bash
# AgentShelf 部署核验脚本
# 用法: ./scripts/verify-deploy.sh http://47.93.220.66:8082
# 逐条验证评委阅读说明与技术验证摘要中承诺的端点，全部通过才退出 0。

set -u

BASE_URL="${1:-http://127.0.0.1:3010}"
BASE_URL="${BASE_URL%/}"
PASS=0
FAIL=0

check() {
  local label="$1"
  local method="$2"
  local path="$3"
  local expected="$4"   # 期望 HTTP 状态码
  local grep_for="${5:-}" # 可选：响应体中必须包含的字符串
  local request_body="${6:-}"
  if [ -z "$request_body" ]; then request_body='{}'; fi
  local body_file
  body_file="$(mktemp)"
  local status

  if [ "$method" = "POST" ]; then
    status="$(curl -s -o "$body_file" -w "%{http_code}" -X POST \
      -H "Content-Type: application/json" \
      --data "$request_body" \
      "$BASE_URL$path")"
  else
    status="$(curl -s -o "$body_file" -w "%{http_code}" "$BASE_URL$path")"
  fi

  local ok=1
  if [ "$status" != "$expected" ]; then ok=0; fi
  if [ -n "$grep_for" ] && ! grep -q "$grep_for" "$body_file"; then ok=0; fi

  if [ "$ok" = "1" ]; then
    printf 'PASS  %-42s %s %s -> %s\n' "$label" "$method" "$path" "$status"
    PASS=$((PASS + 1))
  else
    printf 'FAIL  %-42s %s %s -> %s (期望 %s%s)\n' "$label" "$method" "$path" "$status" "$expected" \
      "${grep_for:+，且响应包含 \"$grep_for\"}"
    FAIL=$((FAIL + 1))
  fi
  rm -f "$body_file"
}

echo "== AgentShelf 部署核验：$BASE_URL =="
echo

# 页面
check "控制台首页" GET "/" 200 "AgentShelf"

# 健康与模型
check "服务健康检查(版本/能力)" GET "/api/health" 200 "agentshelf"
check "模型配置探活" GET "/api/model/health" 200 "provider"

# Agent 安全核验端点（评委阅读说明承诺项）
check "A2A Agent Card" GET "/.well-known/agent-card.json" 200 ""
check "OAuth 受保护资源元数据" GET "/.well-known/oauth-protected-resource/api/mcp" 200 ""
check "Agent Trace 导出" GET "/api/trace" 200 ""
check "Agent Eval 导出" GET "/api/evals" 200 ""
check "MCP 工具入口(tools/list)" POST "/api/mcp" 200 "commerce.checkout" \
  '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 商业沙箱 API
check "商品搜索" GET "/api/commerce/search?q=Atlas&destination=DE&budget=35" 200 "products"
check "示例 CSV 素材" GET "/sample-catalog.csv" 200 "sku"

echo
echo "== 结果：$PASS 项通过，$FAIL 项失败 =="
if [ "$FAIL" -gt 0 ]; then
  echo "有端点与提交材料的承诺不一致：请确认公网部署的是最新构建（重新构建镜像并重启后重试）。"
  exit 1
fi
echo "全部端点与提交材料一致，可以放心交给评委核验。"
