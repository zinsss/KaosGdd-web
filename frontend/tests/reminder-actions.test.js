import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";


test("global reminder list actions use reminder id, not parent item id", async () => {
  const source = await readFile(new URL("../app/reminders/RemindersPageClient.js", import.meta.url), "utf8");

  assert.match(source, /\/api\/reminders\/\$\{reminder\.id\}\/ack/);
  assert.match(source, /\/api\/reminders\/\$\{reminder\.id\}\/snooze/);
  assert.match(source, /\/api\/reminders\/\$\{reminder\.id\}\/complete/);
  assert.doesNotMatch(source, /\/api\/reminders\/\$\{reminder\.parent_item_id\}/);
});

test("reminder dynamic API routes await route params before proxying IDs", async () => {
  const routeFiles = [
    "../app/api/reminders/[id]/ack/route.js",
    "../app/api/reminders/[id]/snooze/route.js",
    "../app/api/reminders/[id]/complete/route.js",
    "../app/api/reminders/[id]/cancel/route.js",
  ];

  for (const routeFile of routeFiles) {
    const source = await readFile(new URL(routeFile, import.meta.url), "utf8");
    assert.match(source, /const \{ id \} = await context\.params/);
    assert.doesNotMatch(source, /context\.params\.id/);
  }
});

test("reminder action proxy routes forward the awaited reminder id", async () => {
  const routeExpectations = [
    ["../app/api/reminders/[id]/ack/route.js", /base \+ "\/reminders\/" \+ id \+ "\/ack"/],
    ["../app/api/reminders/[id]/snooze/route.js", /base \+ "\/reminders\/" \+ id \+ "\/snooze"/],
    ["../app/api/reminders/[id]/complete/route.js", /base \+ "\/reminders\/" \+ id \+ "\/complete"/],
    ["../app/api/reminders/[id]/cancel/route.js", /base \+ "\/reminders\/" \+ id \+ "\/cancel"/],
  ];

  for (const [routeFile, urlPattern] of routeExpectations) {
    const source = await readFile(new URL(routeFile, import.meta.url), "utf8");
    assert.match(source, urlPattern);
    assert.doesNotMatch(source, /parent_item_id/);
  }
});
