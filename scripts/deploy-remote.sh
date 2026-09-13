#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST, for example 47.93.220.66}"
: "${DEPLOY_USER:?Set DEPLOY_USER}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/agentshelf}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ssh_cmd=(ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST")

echo "Preparing $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH"
"${ssh_cmd[@]}" "mkdir -p '$DEPLOY_PATH'"
rsync -az --exclude '.env.local' --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  "$repo_root/" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
"${ssh_cmd[@]}" "cd '$DEPLOY_PATH' && docker compose up -d --build"
"$repo_root/scripts/verify-deployment.sh" "http://$DEPLOY_HOST:8082"
