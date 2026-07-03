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

const WIDTH = 738;
const SCALE = 2; // supersample: rasterize at 2x then downscale for crisp text/edges

async function renderWebp(model, opts = {}) {
  const tree = await template(model, {
    mono: !!opts.mono,
    flat: !!opts.flat,
    gold: !!opts.gold,
  });
  const svg = await satori(tree, { width: WIDTH, fonts });
  const png = new Resvg(svg, {
    background: "rgba(0,0,0,0)", // transparent
    fitTo: { mode: "width", value: WIDTH * SCALE },
  })
    .render()
    .asPng();
  return sharp(png)
    .resize({ width: WIDTH, kernel: "lanczos3" }) // downscale the 2x raster
    .webp({ quality: 92, alphaQuality: 100, effort: 5 })
    .toBuffer();
}

module.exports = { renderWebp };
