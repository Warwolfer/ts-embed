// scripts/deploy.js (`bash deploy.sh`), the PC half of ts-embed's deploy
// (ts-builder Phase 8b, P42, K188). Every command goes through an injected
// runner and the SSH call through an injected function, so nothing here
// runs git or ssh, and nothing reaches the VPS.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const ship = require("../scripts/deploy.js");

const SHA = "0123456789abcdef0123456789abcdef01234567";
const LOCAL_STEPS = [
  "git status --porcelain",
  "git fetch origin master",
  "git rev-parse --abbrev-ref HEAD",
  "git rev-parse HEAD",
  "git rev-parse origin/master",
  "git submodule status vendor/game-data",
  "node --test",
];

function fakeRun(overrides = {}) {
  const calls = [];
  const run = (cmd, args) => {
    const line = [cmd, ...args].join(" ");
    calls.push(line);
    if (line in overrides) return overrides[line];
    if (line === "git status --porcelain") return { status: 0, stdout: "" };
    if (line === "git rev-parse --abbrev-ref HEAD") return { status: 0, stdout: "master\n" };
    if (line === "git rev-parse HEAD" || line === "git rev-parse origin/master") return { status: 0, stdout: SHA + "\n" };
    if (line === "git submodule status vendor/game-data") return { status: 0, stdout: " c5549ea vendor/game-data (heads/main)\n" };
    return { status: 0, stdout: "" };
  };
  return { run, calls };
}

function fakeSsh(status = 0) {
  const calls = [];
  return { ssh: (host, command) => { calls.push([host, command]); return { status }; }, calls };
}

const quiet = { log: () => {} };

test("a clean master at origin/master runs every local check in order, then one SSH call", async () => {
  // Break: drop the tests from the local checks.
  const { run, calls } = fakeRun();
  const { ssh, calls: sshCalls } = fakeSsh();
  await ship.ship({ argv: [], run, ssh, ...quiet });
  assert.deepStrictEqual(calls, LOCAL_STEPS);
  assert.deepStrictEqual(sshCalls, [[ship.HOST, ship.remoteCommand(SHA)]]);
});

test("any uncommitted change, tracked or not, refuses before anything else runs", async () => {
  // Break: `git status --porcelain --untracked-files=no`.
  for (const dirty of [" M server.js\n", "?? notes.txt\n"]) {
    const { run, calls } = fakeRun({ "git status --porcelain": { status: 0, stdout: dirty } });
    const { ssh, calls: sshCalls } = fakeSsh();
    await assert.rejects(ship.ship({ argv: [], run, ssh, ...quiet }), /uncommitted/);
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(sshCalls, []);
  }
});

test("a branch other than master, or HEAD not at origin/master, refuses", async () => {
  // Break: compare HEAD with itself.
  for (const overrides of [
    { "git rev-parse --abbrev-ref HEAD": { status: 0, stdout: "feat/x\n" } },
    { "git rev-parse origin/master": { status: 0, stdout: "f".repeat(40) + "\n" } },
  ]) {
    const { run, calls } = fakeRun(overrides);
    const { ssh, calls: sshCalls } = fakeSsh();
    await assert.rejects(ship.ship({ argv: [], run, ssh, ...quiet }), /master/);
    assert.ok(!calls.includes("node --test"));
    assert.deepStrictEqual(sshCalls, []);
  }
});

test("a stale submodule or failing tests refuse before SSH", async () => {
  // Break: ignore the tests' status.
  for (const [line, result] of [
    ["git submodule status vendor/game-data", { status: 0, stdout: "+c5549ea vendor/game-data\n" }],
    ["node --test", { status: 1, stdout: "" }],
  ]) {
    const { run } = fakeRun({ [line]: result });
    const { ssh, calls: sshCalls } = fakeSsh();
    await assert.rejects(ship.ship({ argv: [], run, ssh, ...quiet }), undefined, line);
    assert.deepStrictEqual(sshCalls, [], `ssh after a failing ${line}`);
  }
});

test("the remote command loads nvm and pnpm, records PREV, and has only the checked SHA in it", () => {
  // Break: drop PREV (the VPS script could not roll back).
  assert.strictEqual(ship.remoteCommand(SHA),
    'source ~/.nvm/nvm.sh && export PATH="$HOME/.local/share/pnpm/bin:$PATH" && ' +
    `cd ~/ts-embed && PREV=$(git rev-parse HEAD) && git fetch origin master && git merge --ff-only ${SHA} && ` +
    `node scripts/vps-deploy.js ${SHA} "$PREV"`);
  for (const bad of ["master", SHA + ";rm -rf ~", "", SHA.toUpperCase()]) {
    assert.throws(() => ship.remoteCommand(bad), /40/);
  }
  assert.strictEqual(ship.HOST, "ubuntu@135.148.47.135");
});

test("ssh is spawned with no shell, the host and the command as two arguments", () => {
  // Break: shell: true in sshSpawn.
  const seen = [];
  ship.sshSpawn(ship.HOST, "echo x", (cmd, args, o) => { seen.push({ cmd, args, o }); return { status: 0 }; });
  assert.strictEqual(seen[0].cmd, "ssh");
  assert.deepStrictEqual(seen[0].args, [ship.HOST, "echo x"]);
  assert.ok(!seen[0].o.shell);
});

test("a failing SSH call is a failure", async () => {
  // Break: ignore ssh's status.
  const { run } = fakeRun();
  await assert.rejects(ship.ship({ argv: [], run, ssh: fakeSsh(1).ssh, ...quiet }), /VPS/);
});

test("--dry-run runs every local check, prints the SSH command and never calls ssh", async () => {
  // Break: call ssh in dry run too.
  const { run, calls } = fakeRun();
  const { ssh, calls: sshCalls } = fakeSsh();
  const lines = [];
  await ship.ship({ argv: ["--dry-run"], run, ssh, log: (l) => lines.push(l) });
  assert.deepStrictEqual(calls, LOCAL_STEPS);
  assert.deepStrictEqual(sshCalls, []);
  assert.ok(lines.some((l) => l.includes(ship.remoteCommand(SHA))), lines.join("\n"));
});

test("deploy.sh runs scripts/deploy.js with its arguments", () => {
  // Break: drop "$@" from deploy.sh.
  const sh = fs.readFileSync(path.join(__dirname, "..", "deploy.sh"), "utf8");
  assert.match(sh, /^exec node scripts\/deploy\.js "\$@"$/m);
});
