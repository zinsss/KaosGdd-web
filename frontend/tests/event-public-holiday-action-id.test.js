import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("event public holiday action uses stable local or canonical event id", async () => {
  const panelSource = await readFile(new URL("../components/EventDetailPanel.js", import.meta.url), "utf8");

  assert.match(panelSource, /function stableEventActionId\(item\)/);
  assert.match(panelSource, /item\.local_event_id \|\| item\.kaos_event_id \|\| item\.canonical_event_id \|\| item\.id/);
  assert.match(panelSource, /const publicHolidayEventId = stableEventActionId\(item\);/);
  assert.match(panelSource, /const publicHolidayActionAvailable = Boolean\(publicHolidayEventId\) && !String\(publicHolidayEventId\)\.includes\(":"\);/);
  assert.match(panelSource, /fetch\(`\/api\/events\/\$\{publicHolidayEventId\}\/classification`/);
  assert.doesNotMatch(panelSource, /fetch\(`\/api\/events\/\$\{item\.id\}\/classification`/);
  assert.match(panelSource, /body: JSON\.stringify\(\{ is_public_holiday: checked, event_id: publicHolidayEventId \}\)/);
});

test("event public holiday action disables unresolved virtual ids", async () => {
  const panelSource = await readFile(new URL("../components/EventDetailPanel.js", import.meta.url), "utf8");

  assert.match(panelSource, /if \(!publicHolidayActionAvailable\) \{/);
  assert.match(panelSource, /setClassificationError\("event_not_persisted"\);/);
  assert.match(panelSource, /disabled=\{isClassifying \|\| !publicHolidayActionAvailable\}/);
});

test("event classification proxy awaits dynamic params", async () => {
  const routeSource = await readFile(new URL("../app/api/events/[id]/classification/route.js", import.meta.url), "utf8");

  assert.match(routeSource, /const \{ id \} = await context\.params;/);
  assert.doesNotMatch(routeSource, /context\.params\.id/);
  assert.match(routeSource, /encodeURIComponent\(id\)/);
});

test("checked public holidays use the Sunday color in the month calendar", async () => {
  const eventsSource = await readFile(new URL("../app/events/EventsPageClient.js", import.meta.url), "utf8");
  const eventsCss = await readFile(new URL("../app/styles/events.css", import.meta.url), "utf8");

  assert.match(eventsSource, /const hasPublicHoliday = dayEvents\.some\(\(event\) => event\.event_class === "public-holiday"\);/);
  assert.match(eventsSource, /hasPublicHoliday\s*\?\s*" eventCalDayPublicHoliday"/);
  assert.match(eventsCss, /\.eventCalDaySun,\s*\n\.eventCalDayPublicHoliday\s*\{\s*color:\s*var\(--ctp-maroon\);/);
});
