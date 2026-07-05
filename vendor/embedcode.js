// embedcode — compact, bit-packed code used ONLY for the forum embed image.
// This is NOT the builder's build/share code; it carries only what the embed
// image needs (masteries+ranks, expertise+ranks, equipment, actions) and omits
// all character data. Format: "~" + base64url(bit-packed payload).
//
// Runs in the browser (builder, via window.EmbedCode) and in Node (embed
// server, via require). Keep both copies byte-identical.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.EmbedCode = api;
})(this, function () {
  "use strict";

  const VERSION = 1;
  const PREFIX = "~";
  const EXCLUDED_ACTIONS = { attack: true, rush: true }; // universal, omitted
  const ARMOR = [null, "heavy", "medium", "light"]; // 2 bits
  const ACCESSORY = [null, "combat", "utility", "magic"]; // 2 bits

  // Bit widths
  const W_VER = 4;
  const W_MCOUNT = 3, W_MID = 6, W_RANK = 3; // mastery
  const W_ECOUNT = 3, W_EID = 6; // expertise (rank reuses W_RANK)
  const W_ARMT = 2, W_ACCT = 2; // equipment type codes
  const W_ACOUNT = 5, W_AID = 9; // actions (id up to 511)

  function BitWriter() {
    this.bits = [];
  }
  BitWriter.prototype.write = function (value, n) {
    const v = value | 0;
    for (let i = n - 1; i >= 0; i--) this.bits.push((v >> i) & 1);
  };
  BitWriter.prototype.bytes = function () {
    const out = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | (this.bits[i + j] || 0);
      out.push(b);
    }
    return out;
  };

  function BitReader(bytes) {
    this.bits = [];
    for (let i = 0; i < bytes.length; i++) {
      for (let j = 7; j >= 0; j--) this.bits.push((bytes[i] >> j) & 1);
    }
    this.pos = 0;
  }
  BitReader.prototype.read = function (n) {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | (this.bits[this.pos++] || 0);
    return v;
  };

  function toBase64url(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromBase64url(s) {
    let b = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4 !== 0) b += "=";
    const bin = atob(b);
    const out = new Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  const clampRank = (r) => {
    const n = Number(r) || 0;
    return n < 0 ? 0 : n > 7 ? 7 : n;
  };
  const idMap = (list) => {
    const m = Object.create(null);
    for (const o of list) m[o.lookup] = o.id;
    return m;
  };
  const lookupMap = (list) => {
    const m = Object.create(null);
    for (const o of list) m[o.id] = o.lookup;
    return m;
  };

  // refs = { masteries, expertise, actionlist } (the data arrays)
  function encode(state, refs) {
    const mId = idMap(refs.masteries);
    const eId = idMap(refs.expertise);
    const aId = idMap(refs.actionlist);
    const w = new BitWriter();
    w.write(VERSION, W_VER);

    const masts = (state.chosenMasteries || []).slice(0, 7);
    w.write(masts.length, W_MCOUNT);
    masts.forEach((lk, i) => {
      w.write(mId[lk] || 0, W_MID);
      w.write(clampRank((state.chosenMasteriesRanks || [])[i]), W_RANK);
    });

    const exps = (state.chosenExpertise || []).slice(0, 7);
    w.write(exps.length, W_ECOUNT);
    exps.forEach((lk, i) => {
      w.write(eId[lk] || 0, W_EID);
      w.write(clampRank((state.chosenExpertiseRanks || [])[i]), W_RANK);
    });

    w.write(Math.max(0, ARMOR.indexOf(state.armorType || null)), W_ARMT);
    w.write(clampRank(state.armorRank), W_RANK);
    w.write(Math.max(0, ACCESSORY.indexOf(state.accessoryType || null)), W_ACCT);
    w.write(clampRank(state.accessoryRank), W_RANK);
    w.write(clampRank(state.weaponRank), W_RANK);

    const acts = (state.chosenActions || [])
      .filter((a) => !EXCLUDED_ACTIONS[a])
      .slice(0, 31);
    w.write(acts.length, W_ACOUNT);
    acts.forEach((lk) => w.write(aId[lk] || 0, W_AID));

    return PREFIX + toBase64url(w.bytes());
  }

  function isEmbedCode(code) {
    return typeof code === "string" && code.charAt(0) === PREFIX;
  }

  // Returns a data object shaped like the builder's decoded build (only the
  // image-relevant fields). Throws on version/format mismatch.
  function decode(code, refs) {
    if (!isEmbedCode(code)) throw new Error("not an embedcode");
    const mLk = lookupMap(refs.masteries);
    const eLk = lookupMap(refs.expertise);
    const aLk = lookupMap(refs.actionlist);
    const r = new BitReader(fromBase64url(code.slice(PREFIX.length)));

    const version = r.read(W_VER);
    if (version !== VERSION) throw new Error("unsupported embedcode version " + version);

    const chosenMasteries = [];
    const chosenMasteriesRanks = [];
    const mCount = r.read(W_MCOUNT);
    for (let i = 0; i < mCount; i++) {
      const id = r.read(W_MID);
      chosenMasteries.push(mLk[id] || String(id));
      chosenMasteriesRanks.push(r.read(W_RANK));
    }

    const chosenExpertise = [];
    const chosenExpertiseRanks = [];
    const eCount = r.read(W_ECOUNT);
    for (let i = 0; i < eCount; i++) {
      const id = r.read(W_EID);
      chosenExpertise.push(eLk[id] || String(id));
      chosenExpertiseRanks.push(r.read(W_RANK));
    }

    const armorType = ARMOR[r.read(W_ARMT)] || null;
    const armorRank = r.read(W_RANK);
    const accessoryType = ACCESSORY[r.read(W_ACCT)] || null;
    const accessoryRank = r.read(W_RANK);
    const weaponRank = r.read(W_RANK);

    const chosenActions = [];
    const aCount = r.read(W_ACOUNT);
    for (let i = 0; i < aCount; i++) {
      const id = r.read(W_AID);
      chosenActions.push(aLk[id] || String(id));
    }

    return {
      chosenMasteries,
      chosenMasteriesRanks,
      chosenExpertise,
      chosenExpertiseRanks,
      armorType,
      armorRank,
      accessoryType,
      accessoryRank,
      weaponRank,
      chosenActions,
    };
  }

  return { encode, decode, isEmbedCode, VERSION, PREFIX };
});
