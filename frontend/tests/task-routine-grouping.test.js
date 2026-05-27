import test from "node:test";
import assert from "node:assert/strict";

import { localYmd, splitActiveTasksForRoutineBox } from "../lib/tasks/routine-grouping.js";

const today = "2026-05-27";

test("localYmd formats local Date constructor values as yyyy-mm-dd", () => {
  assert.equal(localYmd(new Date(2026, 4, 7)), "2026-05-07");
});

function task(id, fields = {}) {
  return { id, title: id, ...fields };
}

test("repeating task goes to routineTasks", () => {
  const result = splitActiveTasksForRoutineBox([task("routine", { repeat_rule: "daily" })], today);
  assert.deepEqual(result.routineTasks.map((item) => item.id), ["routine"]);
  assert.deepEqual(result.normalTasks, []);
});

test("non-repeating task goes to normalTasks", () => {
  const result = splitActiveTasksForRoutineBox([task("normal")], today);
  assert.deepEqual(result.routineTasks, []);
  assert.deepEqual(result.normalTasks.map((item) => item.id), ["normal"]);
});

test("repeating overdue task sorts before repeating today task", () => {
  const result = splitActiveTasksForRoutineBox([
    task("today", { repeat_rule: "daily", due_at: "2026-05-27T09:00:00+09:00" }),
    task("overdue", { repeat_rule: "daily", due_at: "2026-05-26T09:00:00+09:00" }),
  ], today);
  assert.deepEqual(result.routineTasks.map((item) => item.id), ["overdue", "today"]);
});

test("repeating today task sorts before future repeating task", () => {
  const result = splitActiveTasksForRoutineBox([
    task("future", { repeat_rule: "weekly", due_at: "2026-05-28" }),
    task("today", { repeat_rule: "daily", due_at: "2026-05-27" }),
  ], today);
  assert.deepEqual(result.routineTasks.map((item) => item.id), ["today", "future"]);
});

test("future repeating task sorts before no-due repeating task", () => {
  const result = splitActiveTasksForRoutineBox([
    task("no-due", { repeat_rule: "daily" }),
    task("future", { repeat_rule: "weekly", due_at: "2026-06-01" }),
  ], today);
  assert.deepEqual(result.routineTasks.map((item) => item.id), ["future", "no-due"]);
});

test("normal tasks are not included in routines", () => {
  const result = splitActiveTasksForRoutineBox([
    task("normal"),
    task("routine", { repeat_rule: "monthly" }),
  ], today);
  assert.deepEqual(result.routineTasks.map((item) => item.id), ["routine"]);
  assert.deepEqual(result.normalTasks.map((item) => item.id), ["normal"]);
});

test("non-active modes do not split into routines", () => {
  const tasks = [task("routine", { repeat_rule: "daily" }), task("normal")];
  const result = splitActiveTasksForRoutineBox(tasks, today, "done");
  assert.deepEqual(result.routineTasks, []);
  assert.deepEqual(result.normalTasks, tasks);
});
