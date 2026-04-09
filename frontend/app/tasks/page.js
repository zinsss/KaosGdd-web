import Link from "next/link";
import TaskToggleButton from "../../components/TaskToggleButton";
import { UI_STRINGS } from "../../lib/strings";

const TASK_MODES = ["active", "done", "removed"];

function buildTaskModeHref(mode: string) {
  return mode === "active" ? "/tasks" : `/tasks?mode=${mode}`;
}

function getTaskMetaTag(task) {
  const parts = [];

  if (task.metatag_due) parts.push(task.metatag_due);
  if (task.has_reminders) parts.push("R");
  if (task.has_tags) parts.push("#");

  return parts.join("");
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

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitleRow">
          <div className="sectionTitle sectionTitleNoMargin">{UI_STRINGS.TASK_LIST}</div>
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
        ) : (
          <ul className="taskList">
            {tasks.items.map((task) => {
              const metatag = getTaskMetaTag(task);

              return (
                <li key={task.id} className="taskListRow">
                  <div className="taskListRowMain">
                    <div className="taskListTitleBlock">
                      <div className="taskListTitleRow taskListTitleRowWithMeta">
                        <span className="taskListStateIcon">{task.is_done ? "◉" : "○"}</span>

                        <Link
                          className={
                            "taskLink taskListTitleLink" +
                            (task.is_done ? " taskLinkDone taskLinkDoneList" : "")
                          }
                          href={"/tasks/" + task.id}
                        >
                          {task.title}
                        </Link>

                        {metatag ? <span className="taskListMetaTag">{metatag}</span> : null}
                      </div>
                    </div>

                    <div className="taskListAction">
                      <TaskToggleButton taskId={task.id} isDone={task.is_done} compact />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}