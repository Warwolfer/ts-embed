"use strict";
const fs = require("fs");
const path = require("path");
const satoriMod = require("satori");
const satori = satoriMod.default || satoriMod;
const { Resvg } = require("@resvg/resvg-js");
const sharp = require("sharp");
const { template } = require("./template.js");

const fonts = [
  {
    name: "Inter",
    weight: 400,
    style: "normal",
    data: fs.readFileSync(path.join(__dirname, "..", "assets", "Inter-Regular.woff")),
  },
  {
    name: "Inter",
    weight: 700,
    style: "normal",
    data: fs.readFileSync(path.join(__dirname, "..", "assets", "Inter-SemiBold.woff")),
  },
];

const LAYOUT_WIDTH = 738; // design is authored at this width
const OUT_WIDTH = 1080; // final image width (height scales by aspect)
const SCALE = 2; // supersample: rasterize at 2x then downscale for crisp text/edges

async function renderWebp(model, opts = {}) {
  const tree = await template(model, {
    mono:    !!opts.mono,
    flat:    !!opts.flat,
    gold:    !!opts.gold,
    center:  !!opts.center,
    compact_mastery: !!opts.compact_mastery,
    mastery:   opts.mastery   !== false,
    expertise: opts.expertise !== false,
    saves:     opts.saves     !== false,
    equipment: opts.equipment !== false,
    actions:   opts.actions   !== false,
  });
  const svg = await satori(tree, { width: LAYOUT_WIDTH, fonts });
  const png = new Resvg(svg, {
    background: "rgba(0,0,0,0)", // transparent
    fitTo: { mode: "width", value: OUT_WIDTH * SCALE }, // scale layout up + supersample
  })
    .render()
    .asPng();
  return sharp(png)
    .resize({ width: OUT_WIDTH, kernel: "lanczos3" }) // downscale the supersampled raster
    // effort is encode-speed vs compression (NOT visual quality). 6 costs ~2s
    // for ~1% smaller file here — not worth it; 4 is ~36ms at the same size.
    .webp({ quality: 90, alphaQuality: 100, effort: 4 })
    .toBuffer();
}

module.exports = { renderWebp };
