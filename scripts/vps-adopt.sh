#!/usr/bin/env bash
# scripts/vps-adopt.sh — ONCE: make ~/ts-embed on the VPS a clean git checkout
# of master (ts-builder Phase 8b, K189). After this, `bash deploy.sh` works.
#
# Sent over SSH by `bash deploy.sh --adopt` (scripts/deploy.js), after the
# same local checks as a deploy, and run as `bash -s -- <sha>`:
#   1. refuse unless <sha> is 40 hex, ~/ts-embed and its .env exist, and no
#      ~/ts-embed-next or ~/ts-embed-old is left from an earlier attempt;
#   2. clone master into ~/ts-embed-next, check it is <sha>, the submodules,
#      copy the live .env across, pnpm install, node --test;
#   3. swap: ~/ts-embed -> ~/ts-embed-old, ~/ts-embed-next -> ~/ts-embed;
#   4. pm2 startOrReload through ecosystem.config.js, then /health;
#   5. on a failed health check: ~/ts-embed -> ~/ts-embed-next-failed,
#      ~/ts-embed-old -> ~/ts-embed, and reload the old one.
# It deletes nothing: the old folder stays as ~/ts-embed-old until the owner
# removes it by hand. pm2 is told only about this app, by name.
set -euo pipefail

fail() { echo "vps-adopt: $*" >&2; exit 1; }

SHA="${1:-}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail "the commit must be a 40-character lowercase hex SHA"

REPO="git@github.com:Warwolfer/ts-embed.git"
LIVE="$HOME/ts-embed"
NEXT="$HOME/ts-embed-next"
OLD="$HOME/ts-embed-old"
HEALTH="http://127.0.0.1:4567/health"

# A non-interactive SSH login gets the system Node 17 and no pnpm.
# shellcheck disable=SC1091
source "$HOME/.nvm/nvm.sh"
export PATH="$HOME/.local/share/pnpm/bin:$PATH"

[ -d "$LIVE" ] || fail "$LIVE does not exist"
[ -f "$LIVE/.env" ] || fail "$LIVE/.env does not exist; ts-embed needs it"
[ ! -e "$NEXT" ] || fail "$NEXT is left from an earlier attempt; move it away first"
[ ! -e "$OLD" ] || fail "$OLD is left from an earlier switch; move it away first"

echo "== clone"
git clone -b master "$REPO" "$NEXT"
cd "$NEXT"
[ "$(git rev-parse HEAD)" = "$SHA" ] || fail "the clone is at $(git rev-parse HEAD), not $SHA; $LIVE is untouched"
echo "== submodules"
git submodule update --init --recursive
echo "== .env"
cp -p "$LIVE/.env" "$NEXT/.env"
echo "== install"
pnpm install --frozen-lockfile
echo "== node --test"
node --test

echo "== swap"
cd "$HOME"
mv "$LIVE" "$OLD"
mv "$NEXT" "$LIVE"
cd "$LIVE"
pm2 startOrReload ecosystem.config.js --update-env

echo "== health"
for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS --max-time 3 "$HEALTH" 2>/dev/null | grep -q '"status":"ok"'; then
        echo "== live: $SHA (the old folder is $OLD)"
        exit 0
    fi
    sleep 0.5
done

echo "== the health check failed; putting the old folder back" >&2
cd "$HOME"
mv "$LIVE" "$NEXT-failed"
mv "$OLD" "$LIVE"
cd "$LIVE"
pm2 startOrReload ecosystem.config.js --update-env
fail "rolled back to the old folder; the new one is in $NEXT-failed"
