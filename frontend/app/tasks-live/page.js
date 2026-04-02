import AddTaskForm from "../../components/AddTaskForm";
import TaskToggleButton from "../../components/TaskToggleButton";
import styles from "./page.module.css";

async function getTasks() {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/tasks", { cache: "no-store" });
    return await res.json();
  } catch {
    return { items: [] };
  }
}

export default async function TasksLivePage() {
  const tasks = await getTasks();

  return (
    <main className="page">
      <section className="panel">
        <div className="line">KaosGdd Web</div>
        <div className="subline">Tasks Live</div>
      </section>

      <div className={styles.formRow}>
        <div style={{ width: "100%" }}>
          <AddTaskForm />
        </div>
      </div>

      <section className="panel">
        <div className="sectionTitle">Task list</div>
        {tasks.items.length === 0 ? (
          <div className="empty">No tasks yet.</div>
        ) : (
          <ul className="taskList">
            {tasks.items.map((task) => (
              <li key={task.id} className={styles.taskItemBlock}>
                <div className={styles.taskMainRow}>
                  <div className={styles.taskTitleWrap}>
                    <span>{task.is_done ? "[x]" : "[ ]"}</span>
                    <span>{task.title}</span>
                  </div>
                  <TaskToggleButton taskId={task.id} isDone={task.is_done} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
