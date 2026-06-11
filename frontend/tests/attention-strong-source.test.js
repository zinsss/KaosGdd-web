import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("nav status strong attention count is backed by visible attention item lists", async () => {
  const routeSource = await readFile(new URL("../app/api/nav-status/route.js", import.meta.url), "utf8");

  assert.match(routeSource, /export function summarizeAttentionTask/);
  assert.match(routeSource, /const attentionTasks = summarizeAttentionItems\(tasks, \(task\) => summarizeAttentionTask\(task, nowMs\)\);/);
  assert.match(routeSource, /const attentionTaskCount = attentionTasks\.length;/);
  assert.match(routeSource, /const attentionReminderCount = attentionReminders\.length;/);
  assert.match(routeSource, /const attentionFaxCount = attentionFaxes\.length;/);
  assert.match(routeSource, /const strongAttentionCount = attentionTaskCount \+ attentionReminderCount \+ attentionFaxCount;/);
  assert.match(routeSource, /attention_task_count: attentionTaskCount/);
  assert.match(routeSource, /attention_reminder_count: attentionReminderCount/);
  assert.match(routeSource, /attention_fax_count: attentionFaxCount/);
  assert.match(routeSource, /attention_tasks: attentionTasks/);
  assert.match(routeSource, /attention_reminders: attentionReminders/);
  assert.match(routeSource, /attention_faxes: attentionFaxes/);
  assert.doesNotMatch(routeSource, /ATTENTION_ITEM_LIMIT/);
  assert.doesNotMatch(routeSource, /\.slice\(0, ATTENTION_ITEM_LIMIT\)/);
});

test("AttentionBox renders every strong attention source and signs dismissals with all item types", async () => {
  const attentionBoxSource = await readFile(new URL("../components/AttentionBox.js", import.meta.url), "utf8");
  const attentionCss = await readFile(new URL("../app/styles/attention-box.css", import.meta.url), "utf8");

  assert.match(attentionBoxSource, /const tasks = normalizeItems\(data\?\.attention_tasks\);/);
  assert.match(attentionBoxSource, /const reminders = normalizeItems\(data\?\.attention_reminders\);/);
  assert.match(attentionBoxSource, /const faxes = normalizeItems\(data\?\.attention_faxes\);/);
  assert.match(attentionBoxSource, /attention_task_count/);
  assert.match(attentionBoxSource, /attention_reminder_count/);
  assert.match(attentionBoxSource, /attention_fax_count/);
  assert.match(attentionBoxSource, /strong_attention_count/);
  assert.match(attentionBoxSource, /tasks\.map\(\(item\) => `t:\$\{item\.id\}:\$\{item\.state \|\| ""\}:\$\{item\.when \|\| ""\}`\)/);
  assert.match(attentionBoxSource, /reminders\.map\(\(item\) => `r:\$\{item\.id\}:\$\{item\.state \|\| ""\}:\$\{item\.when \|\| ""\}`\)/);
  assert.match(attentionBoxSource, /faxes\.map\(\(item\) => `f:\$\{item\.id\}:\$\{item\.direction \|\| ""\}:\$\{item\.fax_status \|\| ""\}:\$\{item\.when \|\| ""\}`\)/);
  assert.match(attentionBoxSource, /attention\.counts\.strong <= 0/);
  assert.match(attentionBoxSource, /formatCount\("task", counts\.tasks\)/);
  assert.match(attentionBoxSource, /formatCount\("reminder", counts\.reminders\)/);
  assert.match(attentionBoxSource, /formatCount\("fax", counts\.faxes\)/);

  const taskIndex = attentionBoxSource.indexOf("attention.tasks.map");
  const reminderIndex = attentionBoxSource.indexOf("attention.reminders.map");
  const faxIndex = attentionBoxSource.indexOf("attention.faxes.map");
  assert.ok(taskIndex > 0 && reminderIndex > taskIndex && faxIndex > reminderIndex);
  assert.match(attentionCss, /\.attentionBoxPillTask\s*\{/);
});
