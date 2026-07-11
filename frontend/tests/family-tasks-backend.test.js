import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family tasks use backend storage as canonical storage", async () => {
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
  assert.ok(!helperSource.includes("return localTasks;"), "backend v2 should not use localStorage as canonical fallback");
  assert.ok(!helperSource.includes("saveFamilyTasks(savedTasks);"), "backend v2 should not mirror successful backend saves into localStorage");
  assert.ok(!helperSource.includes("const localTasks = loadFamilyTasks();"), "backend v2 should not import old localStorage tasks");
  assert.ok(!helperSource.includes("persistFamilyTasks(localTasks);"), "backend v2 should not auto-migrate stale localStorage tasks");

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
  assert.ok(schemaSource.includes("CREATE TABLE IF NOT EXISTS {family_tasks}"));
  assert.ok(schemaSource.includes("CREATE TABLE IF NOT EXISTS {family_main_links}"));
});

test("family tasks do not rehydrate stale localStorage when backend is empty", async () => {
  const taskModule = await import("../app/family/familyTasks.js");
  const storage = new Map();
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
  };

  const localTask = {
    id: "local-1",
    title: "약 사기",
    assignee: "내 할 일",
    priority: "😄 보통",
    created_at: "2026-07-09T00:00:00.000Z",
    updated_at: "2026-07-09T00:00:00.000Z",
  };
  storage.set(taskModule.FAMILY_TASKS_STORAGE_KEY, JSON.stringify([localTask]));

  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (!options.method) {
      return Response.json({ ok: true, tasks: [] });
    }
    return Response.json({ ok: true, tasks: JSON.parse(options.body).tasks });
  };

  const emptyBackendTasks = await taskModule.fetchFamilyTasks();
  assert.deepEqual(emptyBackendTasks, []);
  assert.ok(!calls.some((call) => call.options.method === "PUT"), "empty backend should not trigger localStorage migration");
  assert.ok(storage.get(taskModule.FAMILY_TASKS_STORAGE_KEY)?.includes("local-1"), "stale localStorage should be left untouched but ignored");

  delete globalThis.fetch;
  delete globalThis.window;
});
