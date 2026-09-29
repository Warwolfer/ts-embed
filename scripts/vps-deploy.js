// scripts/vps-deploy.js — the VPS half of ts-embed's deploy
// (ts-builder Phase 8b, P42, K188).
//
// Runs on the VPS in ~/ts-embed, started by `bash deploy.sh` on the owner's
// PC over SSH (scripts/deploy.js), after that command recorded the commit it
// was on (PREV) and fast-forwarded the checkout to the commit it checked:
//
//   node scripts/vps-deploy.js <40-hex sha> <40-hex prev>
//
// Steps, in order; the first failure stops everything after it:
//   Node >= 22.22.2; HEAD is exactly <sha>; no tracked change; the game-data
//   submodule updated and at its committed pointer; pnpm install
//   --frozen-lockfile; pm2 startOrReload through ecosystem.config.js;
//   GET http://127.0.0.1:4567/health answering {"status":"ok"} (10 tries,
//   500 ms apart).
//
// No tests here: deploy.sh ran them on the PC against this exact commit (the
// owner's call, to make deploys faster). The health check and the rollback
// still guard the live service.
//
// Rollback (K188, approved by the owner): once the checkout is known to hold
// no tracked change, any later failure runs `git reset --hard <prev>`, the
// submodule update, the install and the pm2 reload again, so the previous
// commit runs. This checkout on the VPS holds no hand edits by design; a
// tracked change stops the deploy BEFORE anything is reset, so nothing typed
// on the VPS is ever lost. .env and node_modules are untracked and a reset
// never touches them. pm2 is only ever told about this app, through its
// ecosystem file: never an id, `all`, `restart` or `delete` (the bot is pm2
// id 0 on the same box).
"use strict";
const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

/** The pm2 app, as named in ecosystem.config.js. */
const APP = "ts-embed";
const SHA_RE = /^[0-9a-f]{40}$/;
const MIN_NODE = [22, 22, 2];
const HEALTH = "http://127.0.0.1:4567/health";
const HEALTH_TRIES = 10;
const HEALTH_GAP_MS = 500;
const SUBMODULE = "vendor/game-data";
const PM2_ARGS = ["startOrReload", "ecosystem.config.js", "--update-env"];

/** @param {string} version e.g. "24.5.0" (no leading v) */
function nodeOk(version) {
  const parts = String(version).replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((parts[i] || 0) !== MIN_NODE[i]) return (parts[i] || 0) > MIN_NODE[i];
  }
  return true;
}

/** Runs a command with no shell, inheriting stdio unless its output is wanted. */
function spawnRun(root) {
  return (cmd, args, { capture = false } = {}) => {
    const result = spawnSync(cmd, args, {
      cwd: root,
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    });
    return { status: result.error ? 1 : result.status, stdout: result.stdout || "" };
  };
}

/** GET a URL on this box; resolves { status, body }, status 0 when unreachable. */
function httpText(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { agent: false }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode || 0, body }));
    });
    req.setTimeout(3000, () => req.destroy());
    req.on("error", () => resolve({ status: 0, body: "" }));
  });
}

/** @param {string} body */
function healthOk(body) {
  try {
    return JSON.parse(body).status === "ok";
  } catch {
    return false;
  }
}

/**
 * The deploy. Throws an Error naming the failed step; resolves when the new
 * commit is live and healthy.
 *
 * @param {{
 *   sha: string,
 *   prev: string,
 *   root?: string,
 *   run?: (cmd: string, args: string[], opts?: { capture?: boolean }) => { status: number | null, stdout: string },
 *   fetchText?: (url: string) => Promise<{ status: number, body: string }>,
 *   sleep?: (ms: number) => Promise<void>,
 *   version?: string,
 *   log?: (line: string) => void,
 * }} opts
 */
async function runDeploy(opts) {
  const {
    sha,
    prev,
    root = path.join(__dirname, ".."),
    run = spawnRun(root),
    fetchText = httpText,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    version = process.versions.node,
    log = (line) => console.log(line),
  } = opts;

  if (!SHA_RE.test(String(sha)) || !SHA_RE.test(String(prev))) {
    throw new Error("the commit and the previous commit must each be a 40-character lowercase hex SHA");
  }
  if (!nodeOk(version)) throw new Error(`Node ${version} is too old; ts-embed needs ${MIN_NODE.join(".")} or later`);

  const read = (cmd, args) => {
    const result = run(cmd, args, { capture: true });
    if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (exit ${result.status})`);
    return result.stdout;
  };

  // Before anything can be rolled back: the pull landed, and nothing on the
  // VPS was edited by hand. Neither failure resets anything.
  const head = read("git", ["rev-parse", "HEAD"]).trim();
  if (head !== sha) throw new Error(`HEAD is ${head}, not ${sha}; nothing was changed`);
  if (read("git", ["status", "--porcelain", "--untracked-files=no"]).trim() !== "") {
    throw new Error(`the checkout has uncommitted changes to tracked files; nothing was reset (HEAD is ${sha}, it was ${prev})`);
  }

  const step = (name, cmd, args) => {
    log(`== ${name}`);
    const result = run(cmd, args);
    if (result.status !== 0) throw new Error(`step "${name}" failed (exit ${result.status})`);
  };

  try {
    step("submodules", "git", ["submodule", "update", "--init", "--recursive"]);
    const status = read("git", ["submodule", "status", SUBMODULE]);
    if (status[0] !== " ") throw new Error(`${SUBMODULE} is not at its committed pointer (${JSON.stringify(status.trim())})`);
    step("install", "pnpm", ["install", "--frozen-lockfile"]);
    step("pm2", "pm2", PM2_ARGS);
    log("== health");
    for (let i = 0; i < HEALTH_TRIES; i++) {
      const got = await fetchText(HEALTH);
      if (got.status === 200 && healthOk(got.body)) {
        log(`== live: ${sha}`);
        return;
      }
      await sleep(HEALTH_GAP_MS);
    }
    throw new Error("the health check failed");
  } catch (error) {
    if (prev === sha) throw new Error(`${error.message}; the pull changed nothing, so nothing was rolled back`);
    log(`== rolling back to ${prev}`);
    run("git", ["reset", "--hard", prev]);
    run("git", ["submodule", "update", "--init", "--recursive"]);
    run("pnpm", ["install", "--frozen-lockfile"]);
    run("pm2", PM2_ARGS);
    throw new Error(`${error.message}; rolled back to ${prev}`);
  }
}

if (require.main === module) {
  runDeploy({ sha: process.argv[2], prev: process.argv[3] }).catch((error) => {
    console.error(`vps-deploy failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { APP, SHA_RE, PM2_ARGS, nodeOk, runDeploy };
