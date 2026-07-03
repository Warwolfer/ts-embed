"use strict";
const bd = require("./build-data.js");
const { masteryRingColor, expertiseRingColor } = require("./palette.js");

const byLookup = (list) => {
  const map = new Map();
  for (const o of list) map.set(o.lookup, o);
  return map;
};
const M = byLookup(bd.masteries);
const E = byLookup(bd.expertise);
const A = byLookup(bd.actionlist);

const EXCLUDED = new Set(["attack", "rush"]); // universal actions
const abbr = (name) =>
  name
    .replace(/^Power /, "P. ")
    .replace(/^Ultra /, "U. ")
    .replace(/^Special /, "Sp. ");

function buildModel(code) {
  const d = bd.decode(code); // throws InvalidBuildError on bad input

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
    { key: "Ref", value: fmt(s.reflex) },
    { key: "Will", value: fmt(s.will) },
  ];

  const gear = [
    { key: "WPN", type: null, rank: bd.getRankLabel(d.weaponRank) },
    { key: "ARM", type: d.armorType || null, rank: bd.getRankLabel(d.armorRank) },
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

module.exports = { buildModel, InvalidBuildError: bd.InvalidBuildError };
