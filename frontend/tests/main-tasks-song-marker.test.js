import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("main task list renders Family 쏭 marker from task tags as a purple pill", async () => {
  const taskSource = await readSource("../components/TasksPageClient.js");
  const listCss = await readSource("../app/styles/lists.css");

  assert.ok(taskSource.includes('const SONG_TASK_TAGS = new Set(["쏭", "song", "ssong", "family-song", "family:song"]);'));
  assert.ok(taskSource.includes("function isSongTask(task)"));
  assert.ok(taskSource.includes("{songTask ? <span className=\"taskListSongMarker\">#family쏭</span> : null}"));
  assert.ok(taskSource.includes("const hasNonSongTags = tags.some((tag) => !isSongTaskTag(tag));"));
  assert.ok(taskSource.includes('if (hasNonSongTags || (task.has_tags && tags.length === 0)) parts.push("#");'));

  assert.match(listCss, /\.taskListSongMarker\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?background:\s*rgba\(203,\s*166,\s*247,\s*0\.16\);[\s\S]*?color:\s*var\(--ctp-mauve\);[\s\S]*?font-weight:\s*800;[\s\S]*?white-space:\s*nowrap;/);
  const markerBlock = listCss.match(/\.taskListSongMarker\s*\{[^}]*\}/)?.[0] || "";
  assert.ok(markerBlock, "task list song marker CSS should exist");
  assert.match(markerBlock, /box-shadow:\s*inset 0 0 0 1px rgba\(203,\s*166,\s*247,\s*0\.28\);/);
});
