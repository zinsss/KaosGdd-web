import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testsDir, "..", "..");

test("temporary frontend full-suite diagnostic", () => {
  const files = readdirSync(testsDir)
    .filter((file) => file.endsWith(".test.js") && file !== "000-family-diagnostic.test.js")
    .sort()
    .map((file) => `frontend/tests/${file}`);

  const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/);
    const interesting = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (/not ok|AssertionError|ERR_|failed|FAIL|Expected|actual|operator|Subtest:/i.test(lines[index])) {
        interesting.push(...lines.slice(Math.max(0, index - 4), Math.min(lines.length, index + 12)));
      }
    }
    console.error([...new Set(interesting)].join("\n"));
  }

  assert.equal(result.status, 0);
});
