# ts-embed

Stateless image server that renders a TerraSphere build code into a compact,
transparent WebP for forum `[IMG]` embedding ("Design 4" layout).

## Run

```bash
pnpm install
cp .env.example .env   # set PORT / PUBLIC_BASE_URL
pnpm start             # or: pm2 start ecosystem.config.js
```

`pnpm test` runs the suite (`node --test`).

## Endpoint

```
GET /embed/{code}.webp
```

- `{code}` is the base64 build code (the segment after `#import.` in a build
  URL), URL-encoded.
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
`Special `→`Sp. `. No character name or avatar (the server never fetches
user-supplied URLs — only mastery/expertise icon PNGs keyed by lookup).

## Caching

Fully stateless — nothing is written to disk. A bounded in-memory LRU
(+ in-flight dedupe) absorbs bursts; the `immutable` header lets the forum's
image proxy / CDN / browser hold the copies. A given code always renders the
same image, so a cache miss just costs one ~50ms render.

## Vendoring

`vendor/` holds byte-copies of the decode + data files from `ts-builder`
(`resource/masteries.js`, `expertise.js`, `actions.js`, `safecharacters.js`,
`shared/build-encoder.js`, `calculations.js`). **Re-copy them when they change
upstream** — see `vendor/SOURCE.md`.

## Stack

Fastify · satori (HTML→SVG) · @resvg/resvg-js (SVG→PNG) · sharp (PNG→WebP).
Bundled font: Inter (OFL) in `assets/`.
