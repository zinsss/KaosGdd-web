import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testsDir, "..", "..");

test("temporary frontend per-file diagnostic", () => {
  const failures = [];
  const files = readdirSync(testsDir)
    .filter((file) => file.endsWith(".test.js") && file !== "000-family-diagnostic.test.js")
    .sort();

  for (const file of files) {
    const testPath = `frontend/tests/${file}`;
    const result = spawnSync(process.execPath, ["--test", testPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      failures.push(file);
      console.error(`FAILED ${file}`);
      console.error(result.stdout);
      console.error(result.stderr);
    }
  }

  assert.deepEqual(failures, []);
});
