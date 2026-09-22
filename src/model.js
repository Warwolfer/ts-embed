"use strict";
const bd = require("./build-data.js");
const { masteryRingColor, expertiseRingColor } = require("./palette.js");

const byLookup = (list) => {
  const map = new Map();
  for (const o of list) map.set(o.lookup, o);
  return map;
};

let _M, _E, _A;
function getMaps() {
  if (!_M) {
    _M = byLookup(bd.masteries);
    _E = byLookup(bd.expertise);
    _A = byLookup(bd.actionlist);
  }
  return { M: _M, E: _E, A: _A };
}

const EXCLUDED = new Set(["attack", "rush"]); // universal actions
const abbr = (name) =>
  name
    .replace(/^Power /, "P. ")
    .replace(/^Ultra /, "U. ")
    .replace(/^Special /, "Sp. ");

// Canonical cache key from only the fields that affect the image — ignores
// character data (name/title/notes/thread/banner/avatar/ng) and the encoding,
// so a full code and a stripped short code for the same build share one entry.
function imageKey(d) {
  return JSON.stringify([
    d.chosenMasteries,
    d.chosenMasteriesRanks,
    d.chosenExpertise,
    d.chosenExpertiseRanks,
    d.armorType,
    d.armorRank,
    d.accessoryType,
    d.accessoryRank,
    d.weaponRank,
    d.chosenActions,
  ]);
}

function buildFromData(d) {
  const { M, E, A } = getMaps();

  const masteries = d.chosenMasteries.map((lookup, i) => {
    const o = M.get(lookup) || {};
    return {
      name: o.name || lookup,
      image: o.image || "",
      ring: masteryRingColor(o.primaryRole),
      rank: bd.getRankLabel(d.chosenMasteriesRanks[i]),
    };
  });

  const expertise = (d.chosenExpertise || []).map((lookup, i) => {
    const o = E.get(lookup) || {};
    const type = o.types && o.types[0];
    return {
      name: o.name || lookup,
      image: o.image || "",
      ring: expertiseRingColor(type),
      rank: bd.getRankLabel(d.chosenExpertiseRanks[i]),
    };
  });

  const s = bd.calc.calculateSaves(d, bd.masteries);
  const fmt = (n) => (n >= 0 ? "+" + n : String(n));
  const saves = [
    { key: "Fort", value: fmt(s.fortitude) },
    { key: "RFLX", value: fmt(s.reflex) },
    { key: "Will", value: fmt(s.will) },
  ];

  const gear = [
    { key: "WR", type: null, rank: bd.getRankLabel(d.weaponRank) },
    { key: "AR", type: d.armorType || null, rank: bd.getRankLabel(d.armorRank) },
    { key: "ACC", type: null, rank: bd.getRankLabel(d.accessoryRank) },
  ];

  const actions = (d.chosenActions || [])
    .filter((lookup) => !EXCLUDED.has(lookup))
    .map((lookup) => {
      const o = A.get(lookup) || {};
      return { name: abbr(o.name || lookup), color: o.color || "#555555" };
    });

  return { masteries, expertise, saves, gear, actions };
}

// Decode once; return the render model, a char-data-independent cache key, and
// the canonical short code (base64url) this build should live at.
function buildRender(code) {
  const d = bd.decode(code); // throws InvalidBuildError on bad input
  return { model: buildFromData(d), key: imageKey(d), canonical: bd.canonicalCode(d) };
}

// Kept for tests / callers that just want the model.
function buildModel(code) {
  return buildFromData(bd.decode(code));
}

module.exports = { buildModel, buildRender, InvalidBuildError: bd.InvalidBuildError };
