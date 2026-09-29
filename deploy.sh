#!/usr/bin/env bash
# deploy.sh — check here, then deploy ts-embed on the VPS over SSH.
#   bash deploy.sh             # deploy
#   bash deploy.sh --dry-run   # every local check, nothing remote
# All of it is scripts/deploy.js (tested by test/deploy.test.js).
set -euo pipefail
cd "$(dirname "$0")"
exec node scripts/deploy.js "$@"
