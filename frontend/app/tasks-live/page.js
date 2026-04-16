import AddTaskForm from "../../components/AddTaskForm";
import TaskToggleButton from "../../components/TaskToggleButton";
import { getApiBase } from "../../lib/api-base";
import { UI_STRINGS } from "../../lib/strings";
import styles from "./page.module.css";

async function getTasks() {
  const base = getApiBase();
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
        <div className="line">{UI_STRINGS.APP_TITLE_WEB}</div>
        <div className="subline">{UI_STRINGS.TASKS_LIVE}</div>
      </section>

      <div className={styles.formRow}>
        <div style={{ width: "100%" }}>
          <AddTaskForm />
        </div>
      </div>

      <section className="panel">
        <div className="sectionTitle">{UI_STRINGS.TASK_LIST}</div>
        {tasks.items.length === 0 ? (
          <div className="empty">{UI_STRINGS.NO_TASKS}</div>
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
