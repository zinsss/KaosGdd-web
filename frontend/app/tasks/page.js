import TaskToggleButton from "../../components/TaskToggleButton";
import { UI_STRINGS } from "../../lib/strings";

async function getTasks() {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/tasks", { cache: "no-store" });
    return await res.json();
  } catch {
    return { items: [] };
  }
}

export default async function TasksPage() {
  const tasks = await getTasks();

  return (
    <main className="page shellOffsetPage">
      <section className="panel">
        <div className="sectionTitle">{UI_STRINGS.TASK_LIST}</div>

        {tasks.items.length === 0 ? (
          <div className="empty">{UI_STRINGS.NO_TASKS}</div>
        ) : (
          <ul className="taskList">
            {tasks.items.map((task) => (
              <li key={task.id} className="taskListRow">
                <div className="taskListRowMain">
                  <div className="taskListTitleBlock">
                    <div className="taskListTitleRow">
                      <span className="taskListStateIcon">{task.is_done ? "◉" : "○"}</span>
                      <a
                        className={"taskLink taskListTitleLink" + (task.is_done ? " taskLinkDone taskLinkDoneList" : "")}
                        href={"/tasks/" + task.id}
                      >
                        {task.title}
                      </a>
                    </div>

                    {task.due_at_display ? (
                      <div className="taskListDueLine">{UI_STRINGS.DUE}:{task.due_at_display}</div>
                    ) : null}
                  </div>

                  <div className="taskListAction">
                    <TaskToggleButton taskId={task.id} isDone={task.is_done} compact />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}