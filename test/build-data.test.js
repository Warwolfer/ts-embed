const { test } = require("node:test");
const assert = require("node:assert");
const bd = require("../src/build-data.js");

const FIXTURE =
  "MzgsMjIsMTQsMTEsMjQsM3wyMjIyMjJ8NywxMywzMCwzLDgsMnwyMjIyMjJ8aHwzfGN8MnwzfDMsNCw1LDEyLDEzLDE4LDI1LDI2LDU0LDU1LDcxfG46THVuZSZyOkh1bWFuJnQ64p2uX0FsZV9RdWVlbl/ina8mYzoyNzA2JmI6MTM1LmpwZz8xNzcyOTEwOTc3JmE6aHR0cHMlM0ElMkYlMkZ0ZXJyYXJwLmNvbSUyRmRhdGElMkZhdmF0YXJzJTJGbSUyRjAlMkYxMzUuanBnJTNGMTc3MTMyMjc3MCZuZzox";

test("decode returns expected masteries/expertise/gear", () => {
  const d = bd.decode(FIXTURE);
  assert.deepStrictEqual(d.chosenMasteries, [
    "metamorph", "animancy", "power", "astramancy", "harmonic-magic", "beast-arts",
  ]);
  assert.deepStrictEqual(d.chosenMasteriesRanks, [2, 2, 2, 2, 2, 2]);
  assert.strictEqual(d.chosenExpertise.length, 6);
  assert.strictEqual(d.chosenActions.length, 11);
  assert.strictEqual(d.armorType, "heavy");
  assert.strictEqual(d.weaponRank, 3);
});

test("calc.calculateSaves matches builder", () => {
  const d = bd.decode(FIXTURE);
  const saves = bd.calc.calculateSaves(d, bd.masteries);
  assert.deepStrictEqual(saves, { fortitude: 60, reflex: 15, will: 30 });
});

test("getRankLabel maps rank index to letter", () => {
  assert.strictEqual(bd.getRankLabel(5), "S");
  assert.strictEqual(bd.getRankLabel(0), "E");
  assert.strictEqual(bd.getRankLabel(99), "E");
});

test("decodes base64url form (from the embed client) identically", () => {
  const urlSafe = FIXTURE.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const a = bd.decode(FIXTURE);
  const b = bd.decode(urlSafe);
  assert.deepStrictEqual(b.chosenMasteries, a.chosenMasteries);
  assert.strictEqual(b.weaponRank, a.weaponRank);
});

test("bad code throws InvalidBuildError", () => {
  assert.throws(() => bd.decode("not-a-real-code"), bd.InvalidBuildError);
});
