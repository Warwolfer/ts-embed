"use strict";
const { rankColor } = require("./palette.js");
const { getIconDataUri } = require("./icons.js");

const el = (type, style, children) => ({ type, props: { style, children } });
const img = (src, w, h) => ({
  type: "img",
  props: { src, width: w, height: h, style: { display: "flex", width: w, height: h } },
});
const text = (s) => s;

async function template(model, { mono, flat, gold }) {
  // gold beats mono beats per-rank color. Saves have no rank letter -> neutral ink by default.
  const rankInk = (letter) => (gold ? "#edab2d" : mono ? "#ffffff" : rankColor(letter));
  const saveInk = gold ? "#edab2d" : mono ? "#ffffff" : "#eef1f7";

  // Preload all icon data URIs (parallel, cached).
  const allIcons = [...model.masteries, ...model.expertise];
  const uris = await Promise.all(allIcons.map((o) => getIconDataUri(o.image)));
  const uriFor = new Map(allIcons.map((o, i) => [o, uris[i]]));

  const iconNode = (o) =>
    el(
      "div",
      {
        display: "flex",
        position: "relative",
        width: 32,
        height: 32,
        marginRight: 8,
      },
      [
        el(
          "div",
          {
            display: "flex",
            width: 32,
            height: 32,
            borderRadius: 16,
            border: `2px solid ${o.ring}`,
            overflow: "hidden",
          },
          [
            uriFor.get(o)
              ? img(uriFor.get(o), 28, 28)
              : el("div", { display: "flex", width: 28, height: 28 }),
          ],
        ),
        el(
          "div",
          {
            position: "absolute",
            right: -4,
            bottom: -4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 16,
            height: 16,
            paddingLeft: 3,
            paddingRight: 3,
            borderRadius: 8,
            backgroundColor: "#1e2131",
            border: "1px solid #000000",
            color: rankInk(o.rank),
            fontSize: 11,
            fontWeight: 700,
          },
          [text(o.rank)],
        ),
      ],
    );

  const iconRow = (items) =>
    el("div", { display: "flex", alignItems: "center" }, items.map(iconNode));

  const pill = (label, value, valueInk) =>
    el(
      "div",
      {
        display: "flex",
        alignItems: "center",
        height: 22,
        paddingLeft: 8,
        paddingRight: 8,
        marginRight: 6,
        borderRadius: 6,
        backgroundColor: "#232937",
        fontSize: 11,
      },
      [
        el(
          "div",
          {
            display: "flex",
            color: "#aeb6c6",
            textTransform: "uppercase",
            marginRight: 5,
          },
          [text(label)],
        ),
        el("div", { display: "flex", color: valueInk, fontWeight: 700 }, [
          text(value),
        ]),
      ],
    );

  const savePills = model.saves.map((s) => pill(s.key, s.value, saveInk));
  const gearPills = model.gear.map((g) =>
    pill(
      g.type ? `${g.key} ${g.type.toUpperCase()}` : g.key,
      g.rank,
      rankInk(g.rank),
    ),
  );

  const actionPills = model.actions.map((a) =>
    el(
      "div",
      {
        display: "flex",
        alignItems: "center",
        height: 22,
        paddingLeft: 8,
        paddingRight: 8,
        marginRight: 6,
        marginBottom: 6,
        borderRadius: 6,
        backgroundColor: "#232937",
        borderBottom: flat ? "2px solid transparent" : `2px solid ${a.color}`,
        color: "#aeb6c6",
        fontSize: 11,
      },
      [text(a.name)],
    ),
  );

  return el(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: 738,
      fontFamily: "Inter",
      color: "#eef1f7",
    },
    [
      el(
        "div",
        { display: "flex", alignItems: "center", marginBottom: 5 },
        [
          iconRow(model.masteries),
          el("div", { display: "flex", width: 28 }, []),
          iconRow(model.expertise),
        ],
      ),
      el(
        "div",
        { display: "flex", flexWrap: "wrap", marginBottom: 5 },
        [...savePills, ...gearPills],
      ),
      el("div", { display: "flex", flexWrap: "wrap" }, actionPills),
    ],
  );
}

module.exports = { template };
