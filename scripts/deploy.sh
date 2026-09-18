#!/usr/bin/env bash
# Build and deploy to https://shoryuken.me/bjj/ on the ursula server.
# Usage: scripts/deploy.sh            (builds, then rsyncs dist/ to the server)
#        scripts/deploy.sh --no-build (rsync an existing dist/)
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${DEPLOY_HOST:-root@185.163.204.17}"
DEST="${DEPLOY_DEST:-/var/www/shoryuken.me/bjj/}"

if [[ "${1:-}" != "--no-build" ]]; then
  npm run build
fi

rsync -az --delete --chown=root:root --chmod=D755,F644 dist/ "$HOST:$DEST"
echo "Deployed to https://shoryuken.me/bjj/"
