import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const FAMILY_TESTS = [
  "frontend/tests/family-calendar-edit.test.js",
  "frontend/tests/family-font-palette.test.js",
  "frontend/tests/family-font.test.js",
  "frontend/tests/family-page.test.js",
  "frontend/tests/family-timetable-add.test.js",
  "frontend/tests/family-tasks.test.js",
];

test("temporary family subset diagnostic", () => {
  const result = spawnSync(process.execPath, ["--test", ...FAMILY_TESTS], {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
  }
  assert.equal(result.status, 0);
});
