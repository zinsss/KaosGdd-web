import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("file detail page awaits route params before fetching the file id", async () => {
  const source = await readSource("../app/files/[id]/page.js");

  assert.match(source, /export default async function FileDetailPage\(\{ params \}\)/);
  assert.match(source, /const \{ id \} = await params;/);
  assert.match(source, /const result = await getFile\(id\);/);
  assert.match(source, /const rawResult = result\.ok \? await getFileRaw\(id\) : \{ ok: false, raw: "" \};/);
  assert.doesNotMatch(source, /params\.id/);
});

test("file dynamic API routes await params before proxying ids", async () => {
  const routeFiles = [
    "../app/api/files/[id]/route.js",
    "../app/api/files/[id]/open/route.js",
    "../app/api/files/[id]/raw/route.js",
    "../app/api/files/[id]/hard/route.js",
  ];

  for (const routeFile of routeFiles) {
    const source = await readSource(routeFile);
    assert.match(source, /const \{ id \} = await context\.params;/);
    assert.doesNotMatch(source, /params\.id|context\.params\.id/);
  }
});
