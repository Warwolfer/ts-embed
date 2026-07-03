const { test } = require("node:test");
const assert = require("node:assert");
const { buildModel } = require("../src/model.js");
const { renderWebp } = require("../src/render.js");

const FIXTURE =
  "MzgsMjIsMTQsMTEsMjQsM3wyMjIyMjJ8NywxMywzMCwzLDgsMnwyMjIyMjJ8aHwzfGN8MnwzfDMsNCw1LDEyLDEzLDE4LDI1LDI2LDU0LDU1LDcxfG46THVuZSZyOkh1bWFuJnQ64p2uX0FsZV9RdWVlbl/ina8mYzoyNzA2JmI6MTM1LmpwZz8xNzcyOTEwOTc3JmE6aHR0cHMlM0ElMkYlMkZ0ZXJyYXJwLmNvbSUyRmRhdGElMkZhdmF0YXJzJTJGbSUyRjAlMkYxMzUuanBnJTNGMTc3MTMyMjc3MCZuZzox";

function isWebp(buf) {
  return (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

test("renders a WebP buffer", async () => {
  const m = buildModel(FIXTURE);
  const buf = await renderWebp(m, {});
  assert.ok(Buffer.isBuffer(buf));
  assert.ok(isWebp(buf), "starts with RIFF....WEBP");
});

test("mono variant also renders a WebP", async () => {
  const m = buildModel(FIXTURE);
  const buf = await renderWebp(m, { mono: true });
  assert.ok(isWebp(buf));
});

test("flat variant (no action border) also renders a WebP", async () => {
  const m = buildModel(FIXTURE);
  const buf = await renderWebp(m, { flat: true });
  assert.ok(isWebp(buf));
});

test("gold variant also renders a WebP", async () => {
  const m = buildModel(FIXTURE);
  const buf = await renderWebp(m, { gold: true });
  assert.ok(isWebp(buf));
});
