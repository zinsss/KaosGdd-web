import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("capture route stays a thin backend capture proxy with no supply endpoint interception", async () => {
  const source = await readFile(new URL("../app/api/capture/route.js", import.meta.url), "utf8");

  assert.match(source, /base \+ ["']\/capture["']/);
  assert.doesNotMatch(source, /\/supplies/);
  assert.doesNotMatch(source, /startsWith\(["']\$\$/);
});
