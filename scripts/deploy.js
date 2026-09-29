// scripts/deploy.js — `bash deploy.sh`: check here, then deploy on the VPS over
// SSH (ts-builder Phase 8b, P42, K188). The same shape as ts-builder's
// `pnpm ship`.
//
//   bash deploy.sh             # every local check, then the VPS deploy over SSH
//   bash deploy.sh --dry-run   # every local check; print the SSH command, run nothing remote
//   bash deploy.sh --adopt     # ONCE, first: make ~/ts-embed a git checkout (vps-adopt.sh)
//
// Local checks, in order, the first failure stops everything:
//   no uncommitted change at all (it never touches the tree); `git fetch
//   origin master`; the branch is master and HEAD is exactly origin/master
//   (only what is pushed can ship); the game-data submodule at its committed
//   pointer; node --test.
// Then one SSH call: record the VPS checkout's commit as PREV, fast-forward
// ~/ts-embed to the checked commit, and run scripts/vps-deploy.js there
// (submodules, install, tests, pm2 reload, health, and a rollback to PREV on
// any failure).
//
// Auth is the SSH key already used for this host. The first deploy needs the
// VPS copy to be a git checkout: scripts/vps-adopt.sh, once.
"use strict";
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { SHA_RE } = require("./vps-deploy.js");

const ROOT = path.join(__dirname, "..");
const HOST = "ubuntu@135.148.47.135";
const REMOTE_DIR = "~/ts-embed";
const BRANCH = "master";
const SUBMODULE = "vendor/game-data";

// A non-interactive SSH login on the VPS gets the system Node 17 and no pnpm:
// nvm and pnpm load only in an interactive shell.
const REMOTE_ENV = 'source ~/.nvm/nvm.sh && export PATH="$HOME/.local/share/pnpm/bin:$PATH"';

/**
 * The one command run on the VPS: only the checked SHA varies, and it must be
 * 40 lowercase hex, so nothing else can reach the remote shell.
 *
 * @param {string} sha
 */
function remoteCommand(sha) {
  if (!SHA_RE.test(String(sha))) throw new Error("the commit must be a 40-character lowercase hex SHA");
  return `${REMOTE_ENV} && cd ${REMOTE_DIR} && PREV=$(git rev-parse HEAD) && git fetch origin ${BRANCH} && ` +
    `git merge --ff-only ${sha} && node scripts/vps-deploy.js ${sha} "$PREV"`;
}

/** Runs a local command with no shell; every argument here is a fixed constant. */
function localRun(cmd, args, { capture = false } = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  return { status: result.error ? 1 : result.status, stdout: result.stdout || "" };
}

/**
 * ssh with no shell: the host and the command are two separate arguments.
 * With `input`, that text is the remote command's stdin (for --adopt).
 */
function sshSpawn(host, command, spawn = spawnSync, input = null) {
  const opts = input === null
    ? { stdio: "inherit", shell: false }
    : { stdio: ["pipe", "inherit", "inherit"], shell: false, input };
  const result = spawn("ssh", [host, command], opts);
  return { status: result.error ? 1 : result.status };
}

const ADOPT_SCRIPT = path.join(__dirname, "vps-adopt.sh");

/** Every local check; returns the SHA that may ship. */
function localChecks(run, log) {
  const read = (cmd, args) => {
    const result = run(cmd, args, { capture: true });
    if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (exit ${result.status})`);
    return result.stdout;
  };
  const step = (cmd, args) => {
    log(`== ${cmd} ${args.join(" ")}`);
    const result = run(cmd, args);
    if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (exit ${result.status}); nothing was deployed`);
  };

  if (read("git", ["status", "--porcelain"]).trim() !== "") {
    throw new Error("the working tree has uncommitted changes; commit or move them first (nothing was touched)");
  }
  step("git", ["fetch", "origin", BRANCH]);
  const branch = read("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  if (branch !== BRANCH) throw new Error(`the branch is ${branch}; only ${BRANCH} deploys`);
  const head = read("git", ["rev-parse", "HEAD"]).trim();
  const remote = read("git", ["rev-parse", `origin/${BRANCH}`]).trim();
  if (head !== remote) throw new Error(`HEAD (${head}) is not origin/${BRANCH} (${remote}); push or pull ${BRANCH} first`);
  const status = read("git", ["submodule", "status", SUBMODULE]);
  if (status[0] !== " ") {
    throw new Error(`${SUBMODULE} is not at its committed pointer (${JSON.stringify(status.trim())}). Run: git submodule update --init --recursive`);
  }
  step("node", ["--test"]);
  return head;
}

async function ship({
  argv,
  run = localRun,
  ssh = (host, command, input) => sshSpawn(host, command, spawnSync, input),
  readScript = () => fs.readFileSync(ADOPT_SCRIPT, "utf8"),
  log = (line) => console.log(line),
}) {
  const dryRun = argv.includes("--dry-run");
  const sha = localChecks(run, log);

  if (argv.includes("--adopt")) {
    // Once: make ~/ts-embed a clean git checkout (scripts/vps-adopt.sh). The
    // script goes over stdin with LF endings: a Windows checkout has CRLF,
    // which bash on the VPS would read as part of each command.
    const command = `bash -s -- ${sha}`;
    if (dryRun) {
      log(`== dry run: would send scripts/vps-adopt.sh to ${HOST} and run: ${command}`);
      return;
    }
    log(`== switching ~/ts-embed on ${HOST} to a git checkout of ${sha}`);
    const result = ssh(HOST, command, readScript().replace(/\r\n/g, "\n"));
    if (result.status !== 0) throw new Error(`the switch on the VPS failed (exit ${result.status}); see its output above`);
    log("== done: ~/ts-embed is a git checkout; the old folder is ~/ts-embed-old");
    return;
  }

  const command = remoteCommand(sha);
  if (dryRun) {
    log(`== dry run: would run on ${HOST}:`);
    log(`   ssh ${HOST} '${command}'`);
    return;
  }
  log(`== deploying ${sha} on ${HOST}`);
  const result = ssh(HOST, command);
  if (result.status !== 0) throw new Error(`the deploy on the VPS failed (exit ${result.status}); see its output above`);
  log(`== done, ${sha} is live`);
}

if (require.main === module) {
  ship({ argv: process.argv.slice(2) }).catch((err) => {
    console.error(`deploy failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { HOST, REMOTE_DIR, BRANCH, remoteCommand, sshSpawn, localChecks, ship };
