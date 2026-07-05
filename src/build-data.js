"use strict";
const path = require("path");

// The vendored browser files assign onto `window` and use btoa/atob.
// Provide a minimal shim BEFORE requiring them.
global.window = global.window || {};
if (typeof global.btoa !== "function") {
  global.btoa = (s) => Buffer.from(s, "binary").toString("base64");
}
if (typeof global.atob !== "function") {
  global.atob = (s) => Buffer.from(s, "base64").toString("binary");
}
// build-encoder reads window.location.pathname in some paths; stub it.
global.window.location = global.window.location || { pathname: "/build/" };
global.window.navigator = global.window.navigator || { userAgent: "node" };

const V = (f) => path.join(__dirname, "..", "vendor", f);
require(V("safecharacters.js")); // window.charlist
require(V("masteries.js")); // window.masteries
require(V("expertise.js")); // window.expertise
require(V("actions.js")); // window.actionlist
require(V("build-encoder.js")); // window.BuildEncoder
require(V("calculations.js")); // window.CharacterCalculations

const BuildEncoder = global.window.BuildEncoder;
const masteries = global.window.masteries;
const expertise = global.window.expertise;
const actionlist = global.window.actionlist;
const calc = global.window.CharacterCalculations;

const RANK_LABELS = ["E", "D", "C", "B", "A", "S"];
function getRankLabel(rank) {
  if (typeof rank !== "number" || rank < 0 || rank >= RANK_LABELS.length) {
    return "E";
  }
  return RANK_LABELS[rank];
}

class InvalidBuildError extends Error {
  constructor(message) {
    super(message || "invalid build code");
    this.name = "InvalidBuildError";
  }
}

// decodeBuildString returns the data object directly on success, or
// { success:false, error } on failure. Normalize to "data object or throw".
function decode(code) {
  if (typeof code !== "string" || code.length === 0) {
    throw new InvalidBuildError("empty code");
  }
  // Accept base64url (from the embed client) as well as standard base64.
  // Converting is a no-op for standard base64 (it has no - or _, and is padded).
  let normalized = code.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  let result;
  try {
    result = BuildEncoder.decodeBuildString(normalized);
  } catch (e) {
    throw new InvalidBuildError(e.message);
  }
  if (
    !result ||
    result.success === false ||
    !Array.isArray(result.chosenMasteries)
  ) {
    throw new InvalidBuildError("could not decode build");
  }
  return result;
}

module.exports = {
  decode,
  masteries,
  expertise,
  actionlist,
  calc,
  getRankLabel,
  InvalidBuildError,
};
