"use strict";
const path = require("path");
const fs = require("fs");

// Minimal browser shim — must exist before any vendored file runs.
global.window = global.window || {};
if (typeof global.btoa !== "function")
  global.btoa = (s) => Buffer.from(s, "binary").toString("base64");
if (typeof global.atob !== "function")
  global.atob = (s) => Buffer.from(s, "base64").toString("binary");
global.window.location = global.window.location || { pathname: "/build/" };
global.window.navigator = global.window.navigator || { userAgent: "node" };

const BASE = "https://terrarp.com/build";
const REMOTE_FILES = [
  { url: `${BASE}/resource/safecharacters.js`, vendor: "safecharacters.js" },
  { url: `${BASE}/resource/masteries.js`,      vendor: "masteries.js" },
  { url: `${BASE}/resource/expertise.js`,      vendor: "expertise.js" },
  { url: `${BASE}/resource/actions.js`,        vendor: "actions.js" },
  { url: `${BASE}/shared/build-encoder.js`,    vendor: "build-encoder.js" },
  { url: `${BASE}/shared/calculations.js`,     vendor: "calculations.js" },
  { url: `${BASE}/shared/embedcode.js`,        vendor: "embedcode.js" },
];

function runScript(src, label) {
  // Wrap in IIFE so top-level `const`/`let` don't bleed between scripts.
  // eslint-disable-next-line no-new-func
  new Function("window", "require", `"use strict";\n${src}`)(global.window, require);
}

async function fetchOrFallback({ url, vendor }) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const src = await res.text();
    console.log(`[build-data] loaded ${url}`);
    return src;
  } catch (err) {
    const fallback = path.join(__dirname, "..", "vendor", vendor);
    if (fs.existsSync(fallback)) {
      console.warn(`[build-data] fetch failed for ${url} (${err.message}), using vendor fallback`);
      return fs.readFileSync(fallback, "utf8");
    }
    throw new Error(`fetch failed and no vendor fallback for ${vendor}: ${err.message}`);
  }
}

// Populated by init().
let masteries, expertise, actionlist, calc, EmbedCode, BuildEncoder;

const RANK_LABELS = ["E", "D", "C", "B", "A", "S"];
function getRankLabel(rank) {
  if (typeof rank !== "number" || rank < 0 || rank >= RANK_LABELS.length) return "E";
  return RANK_LABELS[rank];
}

class InvalidBuildError extends Error {
  constructor(message) {
    super(message || "invalid build code");
    this.name = "InvalidBuildError";
  }
}

async function init() {
  // Fetch all scripts (in parallel), then run them in dependency order.
  const sources = await Promise.all(REMOTE_FILES.map(fetchOrFallback));

  // Reset window data slots so re-init is clean.
  delete global.window.masteries;
  delete global.window.expertise;
  delete global.window.actionlist;
  delete global.window.BuildEncoder;
  delete global.window.CharacterCalculations;
  delete global.window.EmbedCode;
  delete global.window.charlist;

  for (let i = 0; i < REMOTE_FILES.length; i++) {
    runScript(sources[i], REMOTE_FILES[i].vendor);
  }

  masteries    = global.window.masteries;
  expertise    = global.window.expertise;
  actionlist   = global.window.actionlist;
  BuildEncoder = global.window.BuildEncoder;
  calc         = global.window.CharacterCalculations;
  EmbedCode    = global.window.EmbedCode;

  if (!masteries || !expertise || !actionlist)
    throw new Error("build-data init: data arrays missing after script eval");
}

function getRefs() {
  return { masteries, expertise, actionlist };
}

function decode(code) {
  if (typeof code !== "string" || code.length === 0)
    throw new InvalidBuildError("empty code");

  const refs = getRefs();

  if (EmbedCode && EmbedCode.isEmbedCode(code)) {
    try {
      const d = EmbedCode.decode(code, refs);
      if (!Array.isArray(d.chosenMasteries)) throw new Error("no masteries");
      return d;
    } catch (e) {
      throw new InvalidBuildError(e.message);
    }
  }

  let normalized = code.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  let result;
  try {
    result = BuildEncoder.decodeBuildString(normalized);
  } catch (e) {
    throw new InvalidBuildError(e.message);
  }
  if (!result || result.success === false || !Array.isArray(result.chosenMasteries))
    throw new InvalidBuildError("could not decode build");
  return result;
}

function canonicalCode(data) {
  return EmbedCode.encode(data, getRefs());
}

module.exports = {
  init,
  decode,
  canonicalCode,
  get masteries()  { return masteries; },
  get expertise()  { return expertise; },
  get actionlist() { return actionlist; },
  get calc()       { return calc; },
  getRankLabel,
  InvalidBuildError,
};
