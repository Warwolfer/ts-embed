const { test } = require("node:test");
const assert = require("node:assert");
const { buildServer } = require("../server.js");
const { buildRender } = require("../src/model.js");

// A full code (with char data). Its canonical short form is what the server
// serves directly; the full form redirects to it.
const FULL =
  "MzgsMjIsMTQsMTEsMjR8MjIxMTF8NywxMywzMCwzfDExMTF8aHwyfGN8MnwyfDExLDU0LDU1LDcxLDMsOCw0LDUsMTgsMjB8bjpMdW5lJnI6SHVtYW4mdDrina5fU3RlZWxfUmVjbGFpbWVyX+KdryZjOjI1NjkmYjoxMzUuanBnPzE3NzI5MTA5NzcmYTpodHRwcyUzQSUyRiUyRnRlcnJhcnAuY29tJTJGZGF0YSUyRmF2YXRhcnMlMkZtJTJGMCUyRjEzNS5qcGclM0YxNzcxMzIyNzcwJm5nOjE=";
const CANON = buildRender(FULL).canonical; // canonical base64url short code

function isWebp(buf) {
  return (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

test("canonical code returns immutable webp", async () => {
  const app = buildServer();
  const res = await app.inject({ method: "GET", url: `/embed/${CANON}.webp` });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers["content-type"], "image/webp");
  assert.match(res.headers["cache-control"], /immutable/);
  assert.ok(isWebp(res.rawPayload));
  await app.close();
});

test("full code 301-redirects to the shorter canonical url", async () => {
  const app = buildServer();
  const res = await app.inject({
    method: "GET",
    url: `/embed/${encodeURIComponent(FULL)}.webp?gold=1`,
  });
  assert.strictEqual(res.statusCode, 301);
  const loc = res.headers["location"];
  assert.match(loc, /^\/embed\/~[A-Za-z0-9_-]+\.webp\?gold=1$/);
  assert.ok(loc.length < FULL.length, "canonical url is shorter");
  // following it renders a webp (canonical serves directly, no further redirect)
  const res2 = await app.inject({ method: "GET", url: loc });
  assert.strictEqual(res2.statusCode, 200);
  assert.strictEqual(res2.headers["content-type"], "image/webp");
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
  const base = `/embed/${CANON}.webp`;
  const a = await app.inject({ method: "GET", url: base });
  const b = await app.inject({ method: "GET", url: base + "?mono=1" });
  const c = await app.inject({ method: "GET", url: base + "?flat=1" });
  const g = await app.inject({ method: "GET", url: base + "?gold=1" });
  assert.ok([a, b, c, g].every((r) => isWebp(r.rawPayload)));
  await app.close();
});
