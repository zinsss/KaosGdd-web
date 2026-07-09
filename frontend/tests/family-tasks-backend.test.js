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
  assert.ok(helperSource.includes("return localTasks;"), "localStorage should remain as fallback if backend is unreachable");
  assert.ok(helperSource.includes("saveFamilyTasks(normalizedTasks);"), "localStorage should mirror successful backend saves");
  assert.ok(helperSource.includes("const localTasks = loadFamilyTasks();"), "old localStorage tasks should be read before backend migration decisions");
  assert.ok(helperSource.includes("parsed?.hasRecord === true"), "tasks should distinguish a missing backend record from an intentionally empty one");
  assert.ok(helperSource.includes("persistFamilyTasks(localTasks);"), "missing backend task records should migrate localStorage tasks once");

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
  assert.ok(backendSource.includes('"hasRecord": has_record'), "backend tasks response should expose whether a persisted record exists");
  assert.ok(schemaSource.includes("CREATE TABLE IF NOT EXISTS {family_records}"));
});

test("family tasks migrate old localStorage only when backend record is missing", async () => {
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

  const missingRecordCalls = [];
  globalThis.fetch = async (url, options = {}) => {
    missingRecordCalls.push({ url, options });
    if (!options.method) {
      return Response.json({ ok: true, tasks: [], hasRecord: false });
    }
    return Response.json({ ok: true, tasks: JSON.parse(options.body).tasks });
  };

  const migratedTasks = await taskModule.fetchFamilyTasks();
  assert.equal(migratedTasks.length, 1);
  assert.equal(migratedTasks[0].id, "local-1");
  assert.ok(missingRecordCalls.some((call) => call.options.method === "PUT"), "missing backend record should trigger a one-time local task migration");

  const existingEmptyCalls = [];
  storage.set(taskModule.FAMILY_TASKS_STORAGE_KEY, JSON.stringify([localTask]));
  globalThis.fetch = async (url, options = {}) => {
    existingEmptyCalls.push({ url, options });
    return Response.json({ ok: true, tasks: [], hasRecord: true });
  };

  const emptyBackendTasks = await taskModule.fetchFamilyTasks();
  assert.deepEqual(emptyBackendTasks, []);
  assert.ok(!existingEmptyCalls.some((call) => call.options.method === "PUT"), "intentional empty backend task record should not re-migrate stale local tasks");
  assert.equal(storage.get(taskModule.FAMILY_TASKS_STORAGE_KEY), "[]");

  delete globalThis.fetch;
  delete globalThis.window;
});
