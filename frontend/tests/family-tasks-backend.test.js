import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family tasks use backend storage with localStorage as fallback only", async () => {
  const helperSource = await readSource("../app/family/familyTasks.js");
  const dashboardSource = await readSource("../app/family/FamilyDashboardClient.js");
  const formSource = await readSource("../app/family/tasks/FamilyTaskFormClient.js");
  const doneSource = await readSource("../app/family/tasks/done/FamilyDoneTasksClient.js");
  const routeSource = await readSource("../app/api/family/tasks/route.js");
  const backendSource = await readSource("../../backend/app/main.py");
  const schemaSource = await readSource("../../backend/app/db/schema_v0.py");

  assert.ok(helperSource.includes('fetch("/api/family/tasks"'));
  assert.ok(helperSource.includes("export async function fetchFamilyTasks()"));
  assert.ok(helperSource.includes("export async function persistFamilyTasks(tasks)"));
  assert.ok(helperSource.includes("return loadFamilyTasks();"), "localStorage should remain as fallback if backend is unreachable");
  assert.ok(helperSource.includes("saveFamilyTasks(normalizedTasks);"), "localStorage should mirror successful backend saves");

  for (const source of [dashboardSource, formSource, doneSource]) {
    assert.ok(source.includes("fetchFamilyTasks"));
    assert.ok(source.includes("persistFamilyTasks"));
    assert.ok(!source.includes("loadFamilyTasks"));
    assert.ok(!source.includes("saveFamilyTasks"));
  }

  assert.ok(routeSource.includes('fetch(`${apiBase()}/family/tasks`'));
  assert.ok(routeSource.includes('method: "PUT"'));
  assert.ok(backendSource.includes('@app.get("/family/tasks")'));
  assert.ok(backendSource.includes('@app.put("/family/tasks")'));
  assert.ok(schemaSource.includes("CREATE TABLE IF NOT EXISTS {family_records}"));
});
