const { test } = require("node:test");
const assert = require("node:assert");
const { buildModel, InvalidBuildError } = require("../src/model.js");

const FIXTURE =
  "MzgsMjIsMTQsMTEsMjQsM3wyMjIyMjJ8NywxMywzMCwzLDgsMnwyMjIyMjJ8aHwzfGN8MnwzfDMsNCw1LDEyLDEzLDE4LDI1LDI2LDU0LDU1LDcxfG46THVuZSZyOkh1bWFuJnQ64p2uX0FsZV9RdWVlbl/ina8mYzoyNzA2JmI6MTM1LmpwZz8xNzcyOTEwOTc3JmE6aHR0cHMlM0ElMkYlMkZ0ZXJyYXJwLmNvbSUyRmRhdGElMkZhdmF0YXJzJTJGbSUyRjAlMkYxMzUuanBnJTNGMTc3MTMyMjc3MCZuZzox";

test("model has 6 masteries with image, ring, rank", () => {
  const m = buildModel(FIXTURE);
  assert.strictEqual(m.masteries.length, 6);
  const power = m.masteries.find((x) => x.name === "Power");
  assert.ok(power.image.startsWith("https://terrarp.com/db/mastery/"));
  assert.match(power.ring, /^#/);
  assert.strictEqual(power.rank, "C"); // rank index 2 -> "C"
});

test("model saves formatted with sign", () => {
  const m = buildModel(FIXTURE);
  assert.deepStrictEqual(m.saves, [
    { key: "Fort", value: "+60" },
    { key: "Ref", value: "+15" },
    { key: "Will", value: "+30" },
  ]);
});

test("model gear: armor carries its type", () => {
  const m = buildModel(FIXTURE);
  const arm = m.gear.find((g) => g.key === "ARM");
  assert.strictEqual(arm.type, "heavy");
  assert.strictEqual(arm.rank, "B"); // rank index 3 -> "B"
});

test("model actions: excluded universals dropped, names abbreviated", () => {
  const m = buildModel(FIXTURE);
  assert.strictEqual(m.actions.length, 11);
  assert.ok(m.actions.every((a) => a.name && /^#/.test(a.color)));
  const names = m.actions.map((a) => a.name);
  assert.ok(names.includes("U. Protect"));
  assert.ok(names.includes("P. Buff"));
  assert.ok(names.includes("Sp. Burst Attack"));
  assert.ok(!names.includes("Attack") && !names.includes("Rush"));
});

test("bad code throws InvalidBuildError", () => {
  assert.throws(() => buildModel("garbage"), InvalidBuildError);
});
