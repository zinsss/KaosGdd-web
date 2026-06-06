import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("tasks page awaits and normalizes mode searchParams", async () => {
  const source = await readFile(new URL("../app/tasks/page.js", import.meta.url), "utf8");

  assert.match(source, /export default async function TasksPage\(\{ searchParams \}\)/);
  assert.match(source, /const resolvedSearchParams = await searchParams;/);
  assert.match(source, /const modeParam = firstSearchParam\(resolvedSearchParams\?\.mode\);/);
  assert.match(source, /TASK_MODES\.includes\(modeParam\) \? modeParam : "active"/);
  assert.match(source, /<TasksPageClient initialMode=\{mode\} \/>/);
});

test("reminders page awaits and normalizes mode and reminder searchParams", async () => {
  const source = await readFile(new URL("../app/reminders/page.js", import.meta.url), "utf8");

  assert.match(source, /export default async function RemindersPage\(\{ searchParams \}\)/);
  assert.match(source, /const resolvedSearchParams = await searchParams;/);
  assert.match(source, /const modeParam = firstSearchParam\(resolvedSearchParams\?\.mode\);/);
  assert.match(source, /const reminderIdParam = firstSearchParam\(resolvedSearchParams\?\.reminder_id\);/);
  assert.match(source, /REMINDER_MODES\.includes\(modeParam\) \? modeParam : "active"/);
  assert.match(source, /initialMode=\{mode\}/);
});

test("supplies page awaits and normalizes mode searchParams", async () => {
  const source = await readFile(new URL("../app/supplies/page.js", import.meta.url), "utf8");

  assert.match(source, /export default async function SuppliesPage\(\{ searchParams \}\)/);
  assert.match(source, /const resolvedSearchParams = await searchParams;/);
  assert.match(source, /const modeParam = firstSearchParam\(resolvedSearchParams\?\.mode\);/);
  assert.match(source, /SUPPLY_MODES\.includes\(modeParam\) \? modeParam : "active"/);
  assert.match(source, /<SuppliesPageClient initialMode=\{mode\} \/>/);
});
