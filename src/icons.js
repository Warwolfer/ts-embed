"use strict";
const fs = require("fs");
const path = require("path");

const cache = new Map(); // url -> data URI
const ICONS_DIR = path.join(__dirname, "..", "assets", "icons");
let fetches = 0;
let localHits = 0;

// Map a terrarp icon URL to a bundled local file, e.g.
// https://terrarp.com/db/mastery/w-power.png -> assets/icons/mastery/w-power.png
function localPathFor(url) {
  const m = url.match(/\/db\/(mastery|expertise|action)\/([^/?#]+)/);
  if (!m) return null;
  return path.join(ICONS_DIR, m[1], m[2]);
}

async function getIconDataUri(url) {
  if (!url || typeof url !== "string") return null;
  if (cache.has(url)) return cache.get(url);

  // Prefer the bundled local icon (no network dependency).
  const local = localPathFor(url);
  if (local && fs.existsSync(local)) {
    const buf = fs.readFileSync(local);
    const uri = "data:image/png;base64," + buf.toString("base64");
    cache.set(url, uri);
    localHits += 1;
    return uri;
  }

  // Fallback: fetch remotely (used only for icons not bundled locally).
  fetches += 1;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    return null;
  }
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const uri = "data:image/png;base64," + buf.toString("base64");
  cache.set(url, uri);
  return uri;
}

module.exports = {
  getIconDataUri,
  _stats: () => ({ fetches, localHits, size: cache.size }),
};
