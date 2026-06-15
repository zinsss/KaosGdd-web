import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const files = [
  "frontend/tests/event-count-glyphs.test.js",
  "frontend/tests/event-public-holiday-action-id.test.js",
  "frontend/tests/events-calendar-style.test.js",
  "frontend/tests/events-selected-day.test.js",
  "frontend/tests/family-calendar-edit.test.js",
  "frontend/tests/family-font-palette.test.js",
  "frontend/tests/family-font.test.js",
  "frontend/tests/family-page.test.js",
  "frontend/tests/family-tasks.test.js",
  "frontend/tests/family-timetable-add.test.js",
  "frontend/tests/fax-inbox-actions.test.js",
  "frontend/tests/list-mode-search-params.test.js",
  "frontend/tests/mode-swipe.test.js",
  "frontend/tests/module-implied-capture.test.js",
];

test("temporary hidden-band diagnostic", () => {
  const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "--no-warnings" },
    maxBuffer: 1024 * 1024 * 8,
  });
  assert.fail(`temporary diagnostic status=${result.status}\nSTDOUT\n${result.stdout}\nSTDERR\n${result.stderr}`);
});
