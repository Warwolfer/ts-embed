// scripts/vps-adopt.sh, the one-time switch of ~/ts-embed on the VPS to a
// clean git checkout (ts-builder Phase 8b, K189). The real script runs under
// bash in a temp HOME, with stub git, pnpm, node, pm2 and curl first on PATH,
// so nothing real is cloned, installed or reloaded. Skipped where there is
// no bash.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "vps-adopt.sh");
const SHA = "0123456789abcdef0123456789abcdef01234567";
const HAS_BASH = spawnSync("bash", ["-c", "true"]).status === 0;

/** The stubs. Each logs its call to $HOME/calls.log. */
const STUBS = {
  git: `#!/usr/bin/env bash
echo "git $*" >> "$HOME/calls.log"
case "$1" in
  clone) mkdir -p "\${@: -1}"; echo "new" > "\${@: -1}/marker" ;;
  rev-parse) echo "\${FAKE_HEAD:-${SHA}}" ;;
esac
exit 0
`,
  pnpm: '#!/usr/bin/env bash\necho "pnpm $*" >> "$HOME/calls.log"\nexit 0\n',
  node: '#!/usr/bin/env bash\necho "node $*" >> "$HOME/calls.log"\nexit "${FAKE_TESTS:-0}"\n',
  pm2: '#!/usr/bin/env bash\necho "pm2 $* in $PWD" >> "$HOME/calls.log"\nexit 0\n',
  curl: '#!/usr/bin/env bash\necho "curl $*" >> "$HOME/calls.log"\n[ "${FAKE_HEALTH:-ok}" = ok ] && echo \'{"status":"ok"}\' && exit 0\nexit 7\n',
  sleep: "#!/usr/bin/env bash\nexit 0\n",
};

/** A temp HOME with a live ~/ts-embed (and its .env), nvm, and the stubs. */
function world({ env = true } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ts-embed-adopt-"));
  fs.mkdirSync(path.join(home, "ts-embed"));
  fs.writeFileSync(path.join(home, "ts-embed", "marker"), "old");
  if (env) fs.writeFileSync(path.join(home, "ts-embed", ".env"), "SECRET=1\n");
  fs.mkdirSync(path.join(home, ".nvm"));
  fs.writeFileSync(path.join(home, ".nvm", "nvm.sh"), "# stub nvm\n");
  const bin = path.join(home, "bin");
  fs.mkdirSync(bin);
  for (const [name, body] of Object.entries(STUBS)) {
    fs.writeFileSync(path.join(bin, name), body);
    fs.chmodSync(path.join(bin, name), 0o755);
  }
  return home;
}

function adopt(home, args, extraEnv = {}) {
  // Unix-style paths for bash on Windows (C:\x -> /c/x).
  const unix = (p) => p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (m, d) => `/${d.toLowerCase()}`);
  const result = spawnSync("bash", [unix(SCRIPT), ...args], {
    encoding: "utf8",
    env: { ...process.env, HOME: unix(home), PATH: `${unix(path.join(home, "bin"))}:${process.env.PATH}`, ...extraEnv },
  });
  const log = fs.existsSync(path.join(home, "calls.log")) ? fs.readFileSync(path.join(home, "calls.log"), "utf8") : "";
  return { ...result, log };
}

const read = (home, ...p) => fs.readFileSync(path.join(home, ...p), "utf8");
const exists = (home, ...p) => fs.existsSync(path.join(home, ...p));

test("a good switch: the clone becomes ~/ts-embed with the old .env, the old folder is kept", { skip: !HAS_BASH }, () => {
  // Break: skip the `cp` of .env.
  const home = world();
  const got = adopt(home, [SHA]);
  assert.strictEqual(got.status, 0, got.stderr + got.stdout);
  assert.strictEqual(read(home, "ts-embed", "marker").trim(), "new");
  assert.strictEqual(read(home, "ts-embed", ".env"), "SECRET=1\n");
  assert.strictEqual(read(home, "ts-embed-old", "marker"), "old");
  assert.ok(!exists(home, "ts-embed-next"));
  assert.match(got.log, /git clone -b master git@github\.com:Warwolfer\/ts-embed\.git .*ts-embed-next/);
  assert.match(got.log, /git submodule update --init --recursive/);
  assert.match(got.log, /pnpm install --frozen-lockfile/);
  assert.match(got.log, /node --test/);
  assert.match(got.log, /pm2 startOrReload ecosystem\.config\.js --update-env in .*\/ts-embed$/m);
  fs.rmSync(home, { recursive: true, force: true });
});

test("a failed health check puts the old folder back and reloads it; the new one is kept", { skip: !HAS_BASH }, () => {
  // Break: exit on the failed health check without moving the old folder back.
  const home = world();
  const got = adopt(home, [SHA], { FAKE_HEALTH: "down" });
  assert.notStrictEqual(got.status, 0);
  assert.strictEqual(read(home, "ts-embed", "marker"), "old");
  assert.strictEqual(read(home, "ts-embed-next-failed", "marker").trim(), "new");
  assert.ok(!exists(home, "ts-embed-old"));
  assert.strictEqual((got.log.match(/^pm2 /gm) || []).length, 2);
  fs.rmSync(home, { recursive: true, force: true });
});

test("failing tests stop it before the swap: the live folder is untouched and nothing reloads", { skip: !HAS_BASH }, () => {
  // Break: run the tests after the swap.
  const home = world();
  const got = adopt(home, [SHA], { FAKE_TESTS: "1" });
  assert.notStrictEqual(got.status, 0);
  assert.strictEqual(read(home, "ts-embed", "marker"), "old");
  assert.doesNotMatch(got.log, /^pm2 /m);
  fs.rmSync(home, { recursive: true, force: true });
});

test("it refuses, touching nothing, on a bad SHA, a missing .env, a clone at another commit, or a leftover folder", { skip: !HAS_BASH }, () => {
  // Break: drop the .env check.
  // [world, args, env, refused before any clone?] — a bad SHA and a missing
  // .env are refused up front; a clone at another commit is caught after it.
  const cases = [
    [{}, ["main"], {}, true],
    [{ env: false }, [SHA], {}, true],
    [{}, [SHA], { FAKE_HEAD: "f".repeat(40) }, false],
  ];
  for (const [w, args, env, upFront] of cases) {
    const home = world(w);
    const got = adopt(home, args, env);
    assert.notStrictEqual(got.status, 0, JSON.stringify([w, args, env]));
    if (upFront) assert.doesNotMatch(got.log, /git clone/, `cloned before refusing ${JSON.stringify([w, args])}`);
    assert.strictEqual(read(home, "ts-embed", "marker"), "old");
    assert.ok(!exists(home, "ts-embed-old"));
    assert.doesNotMatch(got.log, /^pm2 /m);
    fs.rmSync(home, { recursive: true, force: true });
  }
  const home = world();
  fs.mkdirSync(path.join(home, "ts-embed-old"));
  const got = adopt(home, [SHA]);
  assert.notStrictEqual(got.status, 0);
  assert.doesNotMatch(got.log, /git clone/);
  fs.rmSync(home, { recursive: true, force: true });
});

test("nothing is ever deleted: the script has no rm", () => {
  // Break: add an `rm -rf "$NEXT"` cleanup.
  const text = fs.readFileSync(SCRIPT, "utf8");
  assert.doesNotMatch(text.replace(/^\s*#.*$/gm, ""), /\brm\b/);
});
