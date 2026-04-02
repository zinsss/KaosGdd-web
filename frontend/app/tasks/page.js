import AddTaskForm from "../../components/AddTaskForm";
import TaskToggleButton from "../../components/TaskToggleButton";

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
        <div className="line">KaosGdd Web</div>
        <div className="subline">Tasks</div>
      </section>

      <AddTaskForm />

      <section className="panel">
        <div className="sectionTitle">Task list</div>
        {tasks.items.length === 0 ? (
          <div className="empty">No tasks yet.</div>
        ) : (
          <ul className="taskList">
            {tasks.items.map((task) => (
              <li key={task.id} className="taskItem taskItemBlock">
                <div className="taskMainRow">
                  <div className="taskTitleWrap">
                    <span>{task.is_done ? "[x]" : "[ ]"}</span>
                    <a className="taskLink" href={"/tasks/" + task.id}>
                      {task.title}
                    </a>
                  </div>
                  <TaskToggleButton taskId={task.id} isDone={task.is_done} />
                </div>

                <div className="metaLine">
                  <span>id:{task.id}</span>
                  <span>{task.due_at ? "due:" + task.due_at : "due:-"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}