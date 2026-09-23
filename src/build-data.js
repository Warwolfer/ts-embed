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

// Game data comes from the ts-game-data submodule, shared with ts-builder and
// ts-discord-bot. The three logic files below stay vendored and frozen: the
// embed's code format is deliberately its own, and the old startup fetch
// silently overwrote it from the builder on every restart.
//
// Nothing is downloaded any more. The embed no longer needs terrarp.com to be
// reachable to start, and can no longer serve a stale fallback nobody notices.
const GAME_DATA = path.join(__dirname, "..", "vendor", "game-data");
const VENDOR = path.join(__dirname, "..", "vendor");

// Order matters: the data must exist before the codecs that read it.
const LOCAL_FILES = [
  path.join(GAME_DATA, "safecharacters.js"),
  path.join(GAME_DATA, "masteries.js"),
  path.join(GAME_DATA, "expertise.js"),
  path.join(GAME_DATA, "actions.js"),
  path.join(VENDOR, "build-encoder.js"),
  path.join(VENDOR, "calculations.js"),
  path.join(VENDOR, "embedcode.js"),
];

function runScript(src, label) {
  // Wrap in IIFE so top-level `const`/`let` don't bleed between scripts.
  // eslint-disable-next-line no-new-func
  new Function("window", "require", `"use strict";\n${src}`)(global.window, require);
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

function loadAll() {
  // Reset window data slots so a re-load is clean.
  delete global.window.masteries;
  delete global.window.expertise;
  delete global.window.actionlist;
  delete global.window.BuildEncoder;
  delete global.window.CharacterCalculations;
  delete global.window.EmbedCode;
  delete global.window.charlist;

  for (const file of LOCAL_FILES) {
    if (!fs.existsSync(file)) {
      throw new Error(
        `build-data: ${path.relative(path.join(__dirname, ".."), file)} is missing. ` +
          "Run: git submodule update --init --recursive"
      );
    }
    runScript(fs.readFileSync(file, "utf8"), path.basename(file));
  }

  masteries    = global.window.masteries;
  expertise    = global.window.expertise;
  actionlist   = global.window.actionlist;
  BuildEncoder = global.window.BuildEncoder;
  calc         = global.window.CharacterCalculations;
  EmbedCode    = global.window.EmbedCode;

  if (!masteries || !expertise || !actionlist)
    throw new Error("build-data: data arrays missing after script eval");
}

// Load at require time. Reading from disk needs no await, and every consumer
// (src/model.js, the test suite) uses decode() without calling init() first.
loadAll();

// Kept async, and kept exported, because server.js awaits it before listening.
async function init() {
  loadAll();
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
