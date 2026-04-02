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
      <section className="panel">
        <div className="sectionTitle">Task list</div>
        <ul className="taskList">
          {tasks.items.map((task) => (
            <li key={task.id} className="taskItem">
              <span>{task.is_done ? "[x]" : "[ ]"}</span>
              <span>{task.title}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
