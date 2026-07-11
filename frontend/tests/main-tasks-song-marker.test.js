import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("main task list renders Repeat and Family markers as inline title pills", async () => {
  const taskSource = await readSource("../components/TasksPageClient.js");
  const listCss = await readSource("../app/styles/lists.css");

  assert.ok(taskSource.includes('const SONG_TASK_TAGS = new Set(["쏭", "song", "ssong", "family", "family쏭", "family-song", "family:song"]);'));
  assert.ok(taskSource.includes("function isSongTask(task)"));
  assert.ok(taskSource.includes("function getTaskRepeatOccurrenceDate(task)"));
  assert.ok(taskSource.includes('return `${year}.${month.padStart(2, "0")}.${day.padStart(2, "0")}`;'));
  assert.ok(taskSource.includes('<span className="taskListTitlePills" aria-label="Task labels">'));
  assert.ok(taskSource.includes("{isRepeating ? <span className=\"taskListRepeatMarker\">Repeat</span> : null}"));
  assert.ok(taskSource.includes("{repeatOccurrenceDate ? <span className=\"taskListRepeatDateMarker\">{repeatOccurrenceDate}</span> : null}"));
  assert.ok(taskSource.includes("{songTask ? <span className=\"taskListSongMarker\">Family</span> : null}"));
  assert.ok(taskSource.indexOf("taskListRepeatMarker") < taskSource.indexOf("taskListTitleLink"));
  assert.ok(taskSource.indexOf("taskListSongMarker") < taskSource.indexOf("taskListTitleLink"));
  assert.ok(!taskSource.includes("taskRoutineBox"));
  assert.ok(!taskSource.includes("taskListSubsectionTitleRoutine"));
  assert.ok(taskSource.includes("const hasNonSongTags = tags.some((tag) => !isSongTaskTag(tag));"));
  assert.ok(taskSource.includes('if (hasNonSongTags || (task.has_tags && tags.length === 0)) parts.push("#");'));

  assert.match(listCss, /\.taskListTitlePills\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*5px;/);
  assert.match(listCss, /\.taskListRepeatMarker\s*\{[\s\S]*?background:\s*rgba\(166,\s*227,\s*161,\s*0\.16\);[\s\S]*?color:\s*var\(--ctp-green\);[\s\S]*?box-shadow:\s*inset 0 0 0 1px rgba\(166,\s*227,\s*161,\s*0\.28\);/);
  assert.match(listCss, /\.taskListRepeatDateMarker\s*\{[\s\S]*?background:\s*rgba\(166,\s*227,\s*161,\s*0\.09\);[\s\S]*?color:\s*var\(--ctp-teal\);[\s\S]*?box-shadow:\s*inset 0 0 0 1px rgba\(166,\s*227,\s*161,\s*0\.18\);/);
  assert.match(listCss, /\.taskListSongMarker\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?background:\s*rgba\(203,\s*166,\s*247,\s*0\.16\);[\s\S]*?color:\s*var\(--ctp-mauve\);[\s\S]*?font-weight:\s*800;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(listCss, /\.taskListSongMarker\s*\{[\s\S]*?box-shadow:\s*inset 0 0 0 1px rgba\(203,\s*166,\s*247,\s*0\.28\);/);
  assert.ok(!listCss.includes(".taskRoutineBox"));
});
