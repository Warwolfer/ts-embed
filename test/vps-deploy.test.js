// scripts/vps-deploy.js, the VPS half of ts-embed's deploy (ts-builder
// Phase 8b, P42, K188). Every command goes through an injected runner and
// every health request through an injected fetcher, so nothing here runs
// git, pnpm, pm2 or a network call.
const { test } = require("node:test");
const assert = require("node:assert");
const deploy = require("../scripts/vps-deploy.js");

const SHA = "0123456789abcdef0123456789abcdef01234567";
const PREV = "fedcba9876543210fedcba9876543210fedcba98";

/** A fake runner: a clean success unless `overrides` names the command line. */
function fakeRun(overrides = {}) {
  const calls = [];
  const run = (cmd, args) => {
    const line = [cmd, ...args].join(" ");
    calls.push(line);
    if (line in overrides) return overrides[line];
    if (line === "git rev-parse HEAD") return { status: 0, stdout: SHA + "\n" };
    if (line === "git status --porcelain --untracked-files=no") return { status: 0, stdout: "" };
    if (line === "git submodule status vendor/game-data") return { status: 0, stdout: " c5549ea vendor/game-data (heads/main)\n" };
    return { status: 0, stdout: "" };
  };
  return { run, calls };
}

const healthy = async () => ({ status: 200, body: '{"status":"ok"}' });
const down = async () => ({ status: 0, body: "" });
const opts = (extra) => ({ sha: SHA, prev: PREV, version: "24.5.0", fetchText: healthy, sleep: async () => {}, log: () => {}, ...extra });

const STEPS = [
  "git rev-parse HEAD",
  "git status --porcelain --untracked-files=no",
  "git submodule update --init --recursive",
  "git submodule status vendor/game-data",
  "pnpm install --frozen-lockfile",
  "pm2 startOrReload ecosystem.config.js --update-env",
];

test("a SHA or a previous SHA that is not 40 lowercase hex is refused before any command", async () => {
  // Break: accept any string (drop the SHA_RE test on prev).
  for (const [sha, prev] of [["main", PREV], [SHA, "HEAD"], [SHA, ""], [SHA.toUpperCase(), PREV], [SHA, PREV + ";x"]]) {
    const { run, calls } = fakeRun();
    await assert.rejects(deploy.runDeploy(opts({ sha, prev, run })), /40/);
    assert.deepStrictEqual(calls, [], `ran something for ${sha} ${prev}`);
  }
});

test("the steps run in K188's order, then health; no tests on the VPS (deploy.sh ran them on the PC)", async () => {
  // Break: run node --test on the VPS again.
  const { run, calls } = fakeRun();
  let asked = null;
  await deploy.runDeploy(opts({ run, fetchText: async (url) => { asked = url; return healthy(); } }));
  assert.deepStrictEqual(calls, STEPS);
  assert.strictEqual(asked, "http://127.0.0.1:4567/health");
});

test("Node below 22.22.2 stops it before any command", async () => {
  // Break: compare the major version only.
  for (const version of ["22.22.1", "20.19.4", "17.9.0"]) {
    const { run, calls } = fakeRun();
    await assert.rejects(deploy.runDeploy(opts({ run, version })), /Node/);
    assert.deepStrictEqual(calls, []);
  }
  for (const version of ["22.22.2", "24.5.0", "26.0.0"]) assert.ok(deploy.nodeOk(version), version);
});

test("HEAD not at the SHA stops it, with no rollback", async () => {
  // Break: skip the HEAD comparison.
  const { run, calls } = fakeRun({ "git rev-parse HEAD": { status: 0, stdout: PREV + "\n" } });
  await assert.rejects(deploy.runDeploy(opts({ run })), /HEAD/);
  assert.ok(!calls.some((c) => c.startsWith("git reset")));
});

test("a tracked change on the VPS stops it and is never reset", async () => {
  // Break: roll back on this failure too.
  const { run, calls } = fakeRun({ "git status --porcelain --untracked-files=no": { status: 0, stdout: " M server.js\n" } });
  await assert.rejects(deploy.runDeploy(opts({ run })), /uncommitted/);
  assert.ok(!calls.some((c) => c.startsWith("git reset")), calls.join("\n"));
  assert.ok(!calls.includes("pnpm install --frozen-lockfile"));
});

test("a stale submodule stops it and rolls back", async () => {
  // Break: accept a "+" status.
  const { run, calls } = fakeRun({ "git submodule status vendor/game-data": { status: 0, stdout: "+c5549ea vendor/game-data\n" } });
  await assert.rejects(deploy.runDeploy(opts({ run })), /game-data/);
  const reset = calls.indexOf(`git reset --hard ${PREV}`);
  assert.ok(reset !== -1);
  // Nothing installed from the new commit: the only install is the rollback's.
  assert.ok(!calls.slice(0, reset).includes("pnpm install --frozen-lockfile"));
});

test("a failing step after the pull rolls back to the previous commit and reloads it", async () => {
  // Break: throw without rolling back.
  const { run, calls } = fakeRun({ "pm2 startOrReload ecosystem.config.js --update-env": { status: 1, stdout: "" } });
  await assert.rejects(deploy.runDeploy(opts({ run })), /rolled back/);
  const after = calls.slice(calls.indexOf("pm2 startOrReload ecosystem.config.js --update-env") + 1);
  assert.deepStrictEqual(after, [
    `git reset --hard ${PREV}`,
    "git submodule update --init --recursive",
    "pnpm install --frozen-lockfile",
    "pm2 startOrReload ecosystem.config.js --update-env",
  ]);
});

test("a failed health check rolls back too", async () => {
  // Break: one try only and no rollback.
  const { run, calls } = fakeRun();
  await assert.rejects(deploy.runDeploy(opts({ run, fetchText: down })), /health/);
  assert.ok(calls.includes(`git reset --hard ${PREV}`));
  assert.strictEqual(calls.filter((c) => c.startsWith("pm2 ")).length, 2);
});

test("health wants 200 and status ok, and retries while the server comes up", async () => {
  // Break: accept any 200.
  const { run: run1 } = fakeRun();
  await assert.rejects(deploy.runDeploy(opts({ run: run1, fetchText: async () => ({ status: 200, body: "{}" }) })), /health/);
  const { run: run2 } = fakeRun();
  let tries = 0;
  await deploy.runDeploy(opts({ run: run2, fetchText: async () => (++tries < 5 ? { status: 0, body: "" } : healthy()) }));
  assert.strictEqual(tries, 5);
});

test("when the pull changed nothing (PREV = SHA), a failure does not reset", async () => {
  // Break: always reset.
  const { run, calls } = fakeRun({ "pnpm install --frozen-lockfile": { status: 1, stdout: "" } });
  await assert.rejects(deploy.runDeploy(opts({ run, prev: SHA })), /failed/);
  assert.ok(!calls.some((c) => c.startsWith("git reset")));
});

test("every pm2 call is startOrReload through the ecosystem file, never an id, all, restart or delete", async () => {
  // Break: PM2_ARGS = ["restart", "all"].
  const { run, calls } = fakeRun();
  await deploy.runDeploy(opts({ run, fetchText: down })).catch(() => {});
  const pm2 = calls.filter((c) => c.startsWith("pm2 "));
  assert.ok(pm2.length > 0);
  for (const call of pm2) {
    assert.strictEqual(call, "pm2 startOrReload ecosystem.config.js --update-env");
    assert.doesNotMatch(call, /\b(all|restart|delete|stop|kill)\b|\s\d+(\s|$)/);
  }
});

test("the ecosystem file has the one app, ts-embed", () => {
  // Break: APP = "embed".
  const eco = require("../ecosystem.config.js");
  assert.strictEqual(eco.apps.length, 1);
  assert.strictEqual(eco.apps[0].name, deploy.APP);
});
