import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const PAGE_ROUTES = [
  "../app/files/[id]/page.js",
  "../app/journals/[id]/page.js",
  "../app/reminders/[id]/page.js",
];

const API_ROUTES = [
  "../app/api/events/[id]/route.js",
  "../app/api/events/[id]/raw/route.js",
  "../app/api/events/[id]/restore/route.js",
  "../app/api/files/[id]/route.js",
  "../app/api/files/[id]/open/route.js",
  "../app/api/files/[id]/raw/route.js",
  "../app/api/files/[id]/hard/route.js",
  "../app/api/journals/[id]/route.js",
  "../app/api/journals/[id]/raw/route.js",
  "../app/reminders/[id]/restore/route.js",
  "../app/api/shared-files/[id]/route.js",
  "../app/api/shared-files/[id]/file/route.js",
];

test("dynamic detail pages await params before using ids", async () => {
  for (const routeFile of PAGE_ROUTES) {
    const source = await readSource(routeFile);
    assert.match(source, /const \{ id \} = await params;/, routeFile);
    assert.doesNotMatch(source, /params\.id/, routeFile);
  }
});

test("dynamic API routes await context params before proxying ids", async () => {
  for (const routeFile of API_ROUTES) {
    const source = await readSource(routeFile);
    assert.match(source, /const \{ id \} = await context\.params;/, routeFile);
    assert.doesNotMatch(source, /context\.params\.id|params\.id/, routeFile);
  }
});
