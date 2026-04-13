import Link from "next/link";
import TaskToggleButton from "../../components/TaskToggleButton";
import TaskRestoreButton from "../../components/TaskRestoreButton";
import { UI_STRINGS } from "../../lib/strings";

const TASK_MODES = ["active", "done", "removed", "archived"];

function buildTaskModeHref(mode) {
  return mode === "active" ? "/tasks" : `/tasks?mode=${mode}`;
}

function getTaskMetaTag(task) {
  const parts = [];
  if (task.metatag_due) parts.push(task.metatag_due);
  if (task.has_reminders) parts.push("R");
  if (task.has_tags) parts.push("#");
  return parts.join("");
}

function doneMonthKey(task) {
  const raw = String(task.done_at || "").trim();
  if (!raw) return UI_STRINGS.DONE_UNKNOWN_MONTH;
  return raw.slice(0, 7);
}

function groupDoneTasksByMonth(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const key = doneMonthKey(task);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }
  return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

function TaskRow({ task, mode }) {
  const metatag = getTaskMetaTag(task);
  const hasSubtasks = Number(task.subtask_total || 0) > 0;

  return (
    <li key={task.id} className="taskListRow">
      <div className="taskListRowMain">
        <div className="taskListTitleBlock">
          <div className="taskListTitleRow taskListTitleRowWithMeta">
            <span className="taskListStateIcon">{task.is_done ? "◉" : "○"}</span>

            <Link
              className={
                "taskLink taskListTitleLink" + (task.is_done ? " taskLinkDone taskLinkDoneList" : "")
              }
              href={"/tasks/" + task.id}
            >
              {task.title}
            </Link>

            {metatag ? <span className="taskListMetaTag">{metatag}</span> : null}
            {hasSubtasks ? (
              <span className="taskListSubtaskProgress">[{Number(task.subtask_done || 0)}/{Number(task.subtask_total || 0)}]</span>
            ) : null}
          </div>
        </div>

        <div className="taskListAction">
          {mode === "removed" ? <TaskRestoreButton taskId={task.id} /> : null}
          {mode === "active" ? <TaskToggleButton taskId={task.id} isDone={task.is_done} compact /> : null}
        </div>
      </div>
    </li>
  );
}

async function getTasks(mode) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const suffix = mode && mode !== "active" ? `?mode=${encodeURIComponent(mode)}` : "";
  try {
    const res = await fetch(base + "/tasks" + suffix, { cache: "no-store" });
    return await res.json();
  } catch {
    return { items: [] };
  }
}

export default async function TasksPage({ searchParams }) {
  const mode = TASK_MODES.includes(searchParams?.mode) ? searchParams.mode : "active";
  const tasks = await getTasks(mode);

  const modeTitle =
    mode === "done"
      ? UI_STRINGS.TASKS_DONE_TITLE
      : mode === "removed"
      ? UI_STRINGS.TASKS_REMOVED_TITLE
      : mode === "archived"
      ? UI_STRINGS.TASKS_ARCHIVED_TITLE
      : UI_STRINGS.TASKS_ACTIVE_TITLE;

  const doneGroups = mode === "done" ? groupDoneTasksByMonth(tasks.items || []) : [];

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitleRow">
          <div className="sectionTitle sectionTitleNoMargin">{modeTitle}</div>
          <div className="modeDots" aria-label="Task list mode">
            {TASK_MODES.map((dotMode) => (
              <Link
                key={dotMode}
                href={buildTaskModeHref(dotMode)}
                className={"modeDot" + (mode === dotMode ? " modeDotActive" : "")}
                aria-label={`Show ${dotMode} tasks`}
              />
            ))}
          </div>
        </div>

        {tasks.items.length === 0 ? (
          <div className="empty">{UI_STRINGS.NO_TASKS}</div>
        ) : mode === "done" ? (
          <div className="taskDoneGroups">
            {doneGroups.map(([month, monthTasks]) => (
              <details key={month} className="taskDoneMonthGroup">
                <summary className="taskDoneMonthHeader">{month} ({monthTasks.length})</summary>
                <ul className="taskList">
                  {monthTasks.map((task) => (
                    <TaskRow key={task.id} task={task} mode={mode} />
                  ))}
                </ul>
              </details>
            ))}
          </div>
        ) : (
          <ul className="taskList">
            {tasks.items.map((task) => (
              <TaskRow key={task.id} task={task} mode={mode} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
