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

  assert.match(source, /getSuppliesApiBase\(\)/);
  assert.match(source, /base \+ ["']\/supplies["']/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_API_BASE/);
  assert.doesNotMatch(source, /\/supplies\/undo/);
  assert.doesNotMatch(source, /undo_token/);
});

test("supplies proxy routes use the standalone KaosSupplies base", async () => {
  const sources = await Promise.all(
    [
      "../app/api/supplies/route.js",
      "../app/api/supplies/[id]/done/route.js",
      "../app/api/supplies/[id]/active/route.js",
      "../app/api/supplies/[id]/route.js",
      "../app/api/supplies/presets/route.js",
      "../app/api/supplies/presets/use/route.js",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  const baseSource = await readFile(new URL("../app/api/supplies/supplies-api-base.js", import.meta.url), "utf8");

  assert.match(baseSource, /SUPPLIES_API_BASE/);
  assert.match(baseSource, /kaossupplies-api:8000/);
  for (const source of sources) {
    assert.match(source, /getSuppliesApiBase/);
    assert.doesNotMatch(source, /process\.env\.NEXT_PUBLIC_API_BASE/);
  }
});

test("supplies dynamic API routes await route params before proxying IDs", async () => {
  const doneSource = await readFile(new URL("../app/api/supplies/[id]/done/route.js", import.meta.url), "utf8");
  const activeSource = await readFile(new URL("../app/api/supplies/[id]/active/route.js", import.meta.url), "utf8");
  const deleteSource = await readFile(new URL("../app/api/supplies/[id]/route.js", import.meta.url), "utf8");

  for (const source of [doneSource, activeSource, deleteSource]) {
    assert.match(source, /const \{ id \} = await context\.params/);
    assert.doesNotMatch(source, /context\.params\.id/);
  }
});
