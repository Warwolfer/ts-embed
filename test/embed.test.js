const { test } = require("node:test");
const assert = require("node:assert");
const { buildServer } = require("../server.js");

const FIXTURE =
  "MzgsMjIsMTQsMTEsMjQsM3wyMjIyMjJ8NywxMywzMCwzLDgsMnwyMjIyMjJ8aHwzfGN8MnwzfDMsNCw1LDEyLDEzLDE4LDI1LDI2LDU0LDU1LDcxfG46THVuZSZyOkh1bWFuJnQ64p2uX0FsZV9RdWVlbl/ina8mYzoyNzA2JmI6MTM1LmpwZz8xNzcyOTEwOTc3JmE6aHR0cHMlM0ElMkYlMkZ0ZXJyYXJwLmNvbSUyRmRhdGElMkZhdmF0YXJzJTJGbSUyRjAlMkYxMzUuanBnJTNGMTc3MTMyMjc3MCZuZzox";

function isWebp(buf) {
  return (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

test("valid code returns immutable webp", async () => {
  const app = buildServer();
  const res = await app.inject({
    method: "GET",
    url: `/embed/${encodeURIComponent(FIXTURE)}.webp`,
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers["content-type"], "image/webp");
  assert.match(res.headers["cache-control"], /immutable/);
  assert.ok(isWebp(res.rawPayload));
  await app.close();
});

test("bad code returns placeholder with no-store, still 200", async () => {
  const app = buildServer();
  const res = await app.inject({ method: "GET", url: "/embed/not-a-code.webp" });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers["content-type"], "image/webp");
  assert.strictEqual(res.headers["cache-control"], "no-store");
  await app.close();
});

test("mono + flat + gold variants each render a webp", async () => {
  const app = buildServer();
  const base = `/embed/${encodeURIComponent(FIXTURE)}.webp`;
  const a = await app.inject({ method: "GET", url: base });
  const b = await app.inject({ method: "GET", url: base + "?mono=1" });
  const c = await app.inject({ method: "GET", url: base + "?flat=1" });
  const g = await app.inject({ method: "GET", url: base + "?gold=1" });
  assert.ok([a, b, c, g].every((r) => isWebp(r.rawPayload)));
  await app.close();
});
