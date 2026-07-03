const { test } = require("node:test");
const assert = require("node:assert");
const lru = require("../src/lru.js");

test("second call for same key is cached (producer runs once)", async () => {
  let calls = 0;
  const prod = async () => {
    calls++;
    return Buffer.from("A");
  };
  const a = await lru.getOrRender("k1", prod);
  const b = await lru.getOrRender("k1", prod);
  assert.strictEqual(calls, 1);
  assert.ok(a.equals(b));
});

test("concurrent calls for same uncached key dedupe to one producer run", async () => {
  let calls = 0;
  const prod = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 20));
    return Buffer.from("B");
  };
  const [a, b, c] = await Promise.all([
    lru.getOrRender("k2", prod),
    lru.getOrRender("k2", prod),
    lru.getOrRender("k2", prod),
  ]);
  assert.strictEqual(calls, 1);
  assert.ok(a.equals(b) && b.equals(c));
});
