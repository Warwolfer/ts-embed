"use strict";
const { rankColor } = require("./palette.js");
const { getIconDataUri } = require("./icons.js");

const el = (type, style, children) => ({ type, props: { style, children } });
const img = (src, w, h) => ({
  type: "img",
  props: { src, width: w, height: h, style: { display: "flex", width: w, height: h } },
});
const text = (s) => s;

async function template(model, {
  mono, flat, gold, center,
  compact_mastery,
  mastery   = true,
  expertise = true,
  saves     = true,
  equipment = true,
  actions   = true,
}) {
  const rankInk  = (letter) => (gold ? "#edab2d" : mono ? "#ffffff" : rankColor(letter));
  const saveInk  = gold ? "#edab2d" : mono ? "#ffffff" : "#eef1f7";

  // Preload icons only for visible sections
  const visibleMasteries = mastery   ? model.masteries : [];
  const visibleExpertise = expertise ? model.expertise : [];
  const allIcons = [...visibleMasteries, ...visibleExpertise];
  const uris = await Promise.all(allIcons.map((o) => getIconDataUri(o.image)));
  const uriFor = new Map(allIcons.map((o, i) => [o, uris[i]]));

  // ── Icon node (normal mastery/expertise display) ──
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

  // ── Compact mastery pill (same height as save/gear pills) ──
  const compactPill = (o) =>
    el(
      "div",
      {
        display: "flex",
        alignItems: "center",
        height: 22,
        paddingLeft: 4,
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
            width: 14,
            height: 14,
            borderRadius: 7,
            overflow: "hidden",
            marginRight: 5,
            flexShrink: 0,
          },
          [
            uriFor.get(o)
              ? img(uriFor.get(o), 12, 12)
              : el("div", { display: "flex", width: 12, height: 12 }),
          ],
        ),
        el("div", { display: "flex", color: rankInk(o.rank), fontWeight: 700 }, [
          text(o.rank),
        ]),
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

  const savePills  = model.saves.map((s) => pill(s.key, s.value, saveInk));
  const gearPills  = model.gear.map((g) =>
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

  // ── Build rows ──
  const showRow1 = mastery || expertise;
  const showRow2 = saves || equipment;
  const showRow3 = actions;

  const rootChildren = [];

  if (showRow1) {
    const row1Children = [];
    if (mastery) {
      if (compact_mastery) {
        visibleMasteries.forEach((o) => row1Children.push(compactPill(o)));
      } else {
        row1Children.push(iconRow(visibleMasteries));
      }
    }
    if (mastery && expertise && !compact_mastery) {
      row1Children.push(el("div", { display: "flex", width: 28 }, []));
    }
    if (expertise) {
      if (compact_mastery) {
        visibleExpertise.forEach((o) => row1Children.push(compactPill(o)));
      } else {
        row1Children.push(iconRow(visibleExpertise));
      }
    }
    const row1Style = { display: "flex", alignItems: "center" };
    if (compact_mastery) { row1Style.flexWrap = "wrap"; row1Style.rowGap = 6; }
    if (showRow2 || showRow3) row1Style.marginBottom = 5;
    rootChildren.push(el("div", row1Style, row1Children));
  }

  if (showRow2) {
    const row2Children = [
      ...(saves     ? savePills  : []),
      ...(equipment ? gearPills  : []),
    ];
    const row2Style = { display: "flex", flexWrap: "wrap" };
    if (showRow3) row2Style.marginBottom = 5;
    rootChildren.push(el("div", row2Style, row2Children));
  }

  if (showRow3) {
    rootChildren.push(el("div", { display: "flex", flexWrap: "wrap" }, actionPills));
  }

  return el(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: 738,
      fontFamily: "Inter",
      color: "#eef1f7",
      alignItems: center ? "center" : "flex-start",
    },
    rootChildren,
  );
}

module.exports = { template };
