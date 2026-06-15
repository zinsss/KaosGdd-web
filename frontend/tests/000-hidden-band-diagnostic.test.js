import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const testsDir = new URL("./", import.meta.url);
const files = readdirSync(testsDir)
  .filter((file) => file.endsWith(".test.js") && file !== "000-hidden-band-diagnostic.test.js")
  .sort()
  .map((file) => `frontend/tests/${file}`);

test("temporary full frontend diagnostic", () => {
  const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "--no-warnings" },
    maxBuffer: 1024 * 1024 * 16,
  });
  assert.fail(`temporary diagnostic status=${result.status}\nFILES\n${files.join("\n")}\nSTDOUT\n${result.stdout}\nSTDERR\n${result.stderr}`);
});
