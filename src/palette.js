"use strict";
const ROLE = {
  offense: "#bd4444",
  defense: "#ce832c",
  support: "#589edc",
  alter: "#6436b1",
};
const EXP_TYPE = {
  physical: "#ce6541",
  creative: "#a84b72",
  crafting: "#d2aa49",
};
const RANK = {
  S: "#fbbf24",
  A: "#fb923c",
  B: "#f472b6",
  C: "#4ade80",
  D: "#60a5fa",
  E: "#9ca3af",
};
const masteryRingColor = (role) => ROLE[role] || "#6436b1";
const expertiseRingColor = (type) => EXP_TYPE[type] || "#6e51cb";
const rankColor = (letter) => RANK[letter] || "#9ca3af";

module.exports = { masteryRingColor, expertiseRingColor, rankColor };
