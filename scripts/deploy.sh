#!/usr/bin/env bash
# Build and deploy to https://shoryuken.me/bjj/ on the ursula server. Also publishes the .txt
# Book files under books/ to https://shoryuken.me/books/<name>.txt, so they can be opened and
# saved on a phone, then picked from Import Book file in the app.
# Usage: scripts/deploy.sh            (builds, then rsyncs dist/ and books/*.txt to the server)
#        scripts/deploy.sh --no-build (rsync an existing dist/, still syncs books/*.txt)
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${DEPLOY_HOST:-root@185.163.204.17}"
DEST="${DEPLOY_DEST:-/var/www/shoryuken.me/bjj/}"
BOOKS_DEST="${DEPLOY_BOOKS_DEST:-/var/www/shoryuken.me/books/}"

if [[ "${1:-}" != "--no-build" ]]; then
  npm run build
fi

rsync -az --delete --chown=root:root --chmod=D755,F644 dist/ "$HOST:$DEST"
echo "Deployed to https://shoryuken.me/bjj/"

ssh "$HOST" "mkdir -p $BOOKS_DEST"
rsync -az --chown=root:root --chmod=F644 --include='*.txt' --exclude='*' books/ "$HOST:$BOOKS_DEST"
echo "Published Book files to https://shoryuken.me/books/"
