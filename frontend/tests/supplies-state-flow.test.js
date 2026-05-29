import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("supplies page uses confirm-backed Done to Active action without timed undo", async () => {
  const source = await readFile(new URL("../components/SuppliesPageClient.js", import.meta.url), "utf8");

  assert.match(source, /window\.confirm\("Move this supply back to Active\?"\)/);
  assert.match(source, /\/api\/supplies\/\$\{supplyId\}\/active/);
  assert.doesNotMatch(source, /undoNotice/);
  assert.doesNotMatch(source, /undo_token/);
});

test("supplies API route no longer proxies undo tokens", async () => {
  const source = await readFile(new URL("../app/api/supplies/route.js", import.meta.url), "utf8");

  assert.match(source, /base \+ ["']\/supplies["']/);
  assert.doesNotMatch(source, /\/supplies\/undo/);
  assert.doesNotMatch(source, /undo_token/);
});
