const { test } = require("node:test");
const assert = require("node:assert");
const { buildServer } = require("../server.js");

test("GET /health returns ok", async () => {
  const app = buildServer();
  const res = await app.inject({ method: "GET", url: "/health" });
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.json(), { status: "ok" });
  await app.close();
});
