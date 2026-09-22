"use strict";
require("dotenv").config();
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Fastify = require("fastify");
const bd = require("./src/build-data.js");
const { buildRender, InvalidBuildError } = require("./src/model.js");
const { renderWebp } = require("./src/render.js");
const { getOrRender } = require("./src/lru.js");

const IMMUTABLE = "public, max-age=31536000, immutable";
let invalidImg = null;
function invalidImage() {
  if (!invalidImg) {
    invalidImg = fs.readFileSync(path.join(__dirname, "assets", "invalid.webp"));
  }
  return invalidImg;
}

let noShowImg = null;
function noShowImage() {
  if (!noShowImg) {
    noShowImg = fs.readFileSync(path.join(__dirname, "assets", "noshow.webp"));
  }
  return noShowImg;
}

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const truthy = (v) => v === "1" || v === "true";

function buildServer() {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

  // Wildcard (not ":code.webp") so percent-encoded base64 (/, +, =) in the code
  // survives routing. Parse the raw URL path ourselves.
  app.get("/embed/*", async (req, reply) => {
    const pathOnly = (req.raw.url || "").split("?")[0];
    let raw = pathOnly.slice("/embed/".length);
    if (raw.endsWith(".webp")) raw = raw.slice(0, -".webp".length);
    const mono    = truthy(req.query.mono);
    const flat    = truthy(req.query.flat);
    const gold    = truthy(req.query.gold);
    const center  = truthy(req.query.center);
    const compact_mastery = truthy(req.query.compact_mastery);
    // on-by-default: absence or any value other than "0" means on
    const mastery   = req.query.mastery   !== "0";
    const expertise = req.query.expertise !== "0";
    const saves     = req.query.saves     !== "0";
    const equipment = req.query.equipment !== "0";
    const actions   = req.query.actions   !== "0";

    if (typeof raw !== "string" || raw.length === 0 || raw.length > 4096) {
      reply
        .header("Content-Type", "image/webp")
        .header("Cache-Control", "no-store");
      return reply.send(invalidImage());
    }

    // All content sections hidden → serve static joke image
    if (!mastery && !expertise && !saves && !equipment && !actions) {
      reply.header("Content-Type", "image/webp").header("Cache-Control", "public, max-age=86400");
      return reply.send(noShowImage());
    }

    const code = decodeURIComponent(raw);
    const flagKey =
      "|mono="    + (mono    ? "1" : "0") +
      "|flat="    + (flat    ? "1" : "0") +
      "|gold="    + (gold    ? "1" : "0") +
      "|center="  + (center  ? "1" : "0") +
      "|cm="      + (compact_mastery ? "1" : "0") +
      "|m="       + (mastery   ? "1" : "0") +
      "|ex="      + (expertise ? "1" : "0") +
      "|sv="      + (saves     ? "1" : "0") +
      "|eq="      + (equipment ? "1" : "0") +
      "|ac="      + (actions   ? "1" : "0");

    try {
      // Decode up front so the cache key ignores character data + encoding:
      // full and short codes for the same build share one cache entry.
      const { model, key: imgKey, canonical } = buildRender(code); // throws InvalidBuildError

      // Redirect any non-canonical code (full / padded / base64) to the short
      // canonical URL so the address bar + downstream caches converge on it.
      const incoming = raw.replace(/=+$/, ""); // compare ignoring padding
      if (incoming !== canonical) {
        const qs = req.raw.url.split("?")[1] || "";
        const dest = `/embed/${canonical}.webp${qs ? "?" + qs : ""}`;
        reply.header("Cache-Control", "public, max-age=31536000").code(301);
        return reply.redirect(dest);
      }

      const key = sha(imgKey + flagKey);
      const buf = await getOrRender(key, () => renderWebp(model, {
        mono, flat, gold, center, compact_mastery, mastery, expertise, saves, equipment, actions,
      }));
      reply
        .header("Content-Type", "image/webp")
        .header("Cache-Control", IMMUTABLE);
      return reply.send(buf);
    } catch (err) {
      if (!(err instanceof InvalidBuildError)) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
      reply
        .header("Content-Type", "image/webp")
        .header("Cache-Control", "no-store");
      return reply.send(invalidImage());
    }
  });

  return app;
}

async function start() {
  await bd.init();
  const app = buildServer();
  const port = Number(process.env.PORT) || 8080;
  await app.listen({ port, host: "0.0.0.0" });
  // eslint-disable-next-line no-console
  console.log(`ts-embed listening on :${port}`);
}

if (require.main === module) start();

module.exports = { buildServer };
