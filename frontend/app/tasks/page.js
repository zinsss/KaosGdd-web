import AddTaskForm from "../../components/AddTaskForm";
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
    <main className="page">
      <section className="panel">
        <div className="line">{UI_STRINGS.APP_TITLE}</div>
        <div className="subline">{UI_STRINGS.TASKS}</div>
      </section>

      <AddTaskForm />

      <section className="panel">
        <div className="sectionTitle">{UI_STRINGS.TASK_LIST}</div>
        {tasks.items.length === 0 ? (
          <div className="empty">{UI_STRINGS.NO_TASKS}</div>
        ) : (
          <ul className="taskList">
            {tasks.items.map((task) => (
              <li key={task.id} className="taskItem taskItemBlock">
                <div className="taskMainRow">
                  <div className="taskTitleWrap">
                    <span>{task.is_done ? "" : ""}</span>
                    <a
                      className={"taskLink" + (task.is_done ? " taskLinkDone taskLinkDoneList" : "")}
                      href={"/tasks/" + task.id}
                    >
                      {task.title}
                    </a>
                  </div>
                  <TaskToggleButton taskId={task.id} isDone={task.is_done} />
                </div>

                <div className="metaLine">
                  <span>{task.due_at_display ? UI_STRINGS.DUE + ":" + task.due_at_display : UI_STRINGS.DUE + ":-"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}