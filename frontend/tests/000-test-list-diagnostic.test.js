import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const testsDir = dirname(fileURLToPath(import.meta.url));

test("temporary frontend test file list diagnostic", () => {
  const files = readdirSync(testsDir)
    .filter((file) => file.endsWith(".test.js"))
    .sort();
  console.error(files.join("\n"));
  assert.fail("temporary diagnostic");
});
