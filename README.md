# ts-embed

Stateless image server that renders a TerraSphere build code into a compact,
transparent WebP for forum `[IMG]` embedding ("Design 4" layout).

## Run

```bash
git submodule update --init --recursive   # populate vendor/game-data/
pnpm install
cp .env.example .env   # set PORT / PUBLIC_BASE_URL
pnpm start             # or: pm2 start ecosystem.config.js
```

`pnpm test` runs the suite (`node --test`).

## Deploy

From this PC (Git Bash), on `master`, clean and pushed:

```bash
bash deploy.sh --adopt    # ONCE, first: make ~/ts-embed on the VPS a clean git checkout
bash deploy.sh --dry-run  # every local check; prints the SSH command, runs nothing remote
bash deploy.sh            # deploy
```

`deploy.sh` (all of it in `scripts/deploy.js`) checks here (no uncommitted
change, `master` equal to `origin/master`, the submodule at its pointer,
`node --test`), then over SSH records the VPS checkout's commit, fast-forwards
it to the checked one and runs `scripts/vps-deploy.js` there: submodules,
`pnpm install --frozen-lockfile`, `node --test`, `pm2 startOrReload
ecosystem.config.js`, and `GET /health`. Any failure after the pull resets the
VPS checkout to the previous commit and reloads it; a VPS checkout with a hand
edit is refused and never reset. `--adopt` (`scripts/vps-adopt.sh`) clones
next to the old folder, copies its `.env`, tests, swaps the two and checks
`/health`, putting the old folder back on failure; it deletes nothing.

**The submodule matters on every pull.** A plain `git pull` moves the
submodule pointer but does **not** populate `vendor/game-data/`; if that
directory is missing or stale, `require("./src/build-data")` throws at startup
and pm2 restarts forever. The deploy runs `git submodule update --init
--recursive` every time.

To deploy all three services together, or bump the game data in all three,
see `ts-game-data`'s README (`deploy-all.sh`, `bump-game-data.sh`).

## Endpoint

```
GET /embed/{code}.webp
```

- `{code}` is an **embedcode**: `~` + base64url of a bit-packed payload
  (masteries+ranks, expertise+ranks, equipment, actions) — a dedicated
  embed-only format (see `vendor/embedcode.js`), ~35 chars, NOT the builder's
  build code. Legacy builder codes (base64/base64url of the compact string,
  full or stripped) are still accepted and **301-redirect** to the canonical
  `~` embedcode.
- Returns `image/webp` with `Cache-Control: public, max-age=31536000, immutable`.
- Invalid/undecodable code → the `assets/invalid.webp` placeholder with
  `Cache-Control: no-store`, still HTTP 200 (so the forum shows something).
- `GET /health` → `{ "status": "ok" }`.

### Query flags (default off, each cached independently)

| Flag | Effect |
|------|--------|
| `mono=1` | Ranks + save/gear numbers rendered plain white. |
| `gold=1` | Ranks + save/gear numbers rendered `#edab2d` (beats `mono`). |
| `flat=1` | Action pills without the type-colored bottom border. |

## What the image shows

Mastery icons (role-colored ring + rank badge), expertise icons (type-colored
ring + rank), saves + gear pills (armor shows its type), and action pills
(bottom border in the action's type color). Universal actions (`attack`,
`rush`) are omitted; action names abbreviate `Power `→`P. `, `Ultra `→`U. `,
`Special `→`Sp. `. No character name or avatar.

## Icons

Mastery/expertise icons are **bundled locally** in `assets/icons/{mastery,expertise}/`
(basenames match the terrarp URLs, e.g. `w-power.png`, `s-music.png`).
`src/icons.js` maps each `mastery.image` / `expertise.image` URL to the local
file; a remote fetch is only a fallback for anything not bundled. terrarp's CDN
returns 415 to non-browser clients, so runtime fetching is unreliable — keep the
bundle current. To refresh (e.g. new masteries added upstream): open
`https://terrarp.com/build` in a browser, fetch each icon same-origin, and drop
the PNGs into `assets/icons/` (basename = the icon's URL filename).

## Caching

Fully stateless — nothing is written to disk. A bounded in-memory LRU
(+ in-flight dedupe) absorbs bursts; the `immutable` header lets the forum's
image proxy / CDN / browser hold the copies. A given code always renders the
same image, so a cache miss just costs one ~50ms render.

## Vendoring

`vendor/game-data/` is a git submodule of `ts-game-data`, the one copy of the
game data, shared with `ts-builder` and `ts-discord-bot`. `vendor/` also holds
three decode files copied from `ts-builder` and deliberately frozen — see
`vendor/SOURCE.md`. Nothing is fetched over the network at startup any more.

### Changing the game data

Do not edit anything under `vendor/game-data/` in this repo — it is a
read-only checkout of `ts-game-data`. To change masteries, actions, expertise
or the other data files:

1. Edit them in the `ts-game-data` repo, commit and push there.
2. Back in this repo: `git submodule update --remote`, run `pnpm test`, then
   commit the bumped submodule pointer.
3. Deploy as usual (`git pull` then `git submodule update --init --recursive`
   before restarting pm2 — see "Run" above).

## Stack

Fastify · satori (HTML→SVG) · @resvg/resvg-js (SVG→PNG) · sharp (PNG→WebP).
Bundled font: Inter (OFL) in `assets/`.
