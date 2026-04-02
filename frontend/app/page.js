async function getHealth() {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://backend:8000";
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, app: "backend unreachable" };
  }
}

async function getTasks() {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://backend:8000";
  try {
    const res = await fetch(`${base}/tasks`, { cache: "no-store" });
    return await res.json();
  } catch {
    return { items: [] };
  }
}

export default async function HomePage() {
  const health = await getHealth();
  const tasks = await getTasks();

  return (
    <main className="page">
      <section className="panel">
        <div className="line">KaosGdd Web</div>
        <div className="subline">Tailscale-only internal web app</div>
      </section>

      <section className="panel">
        <div className="sectionTitle">System</div>
        <div className="row">
          <span>Backend</span>
          <span>{health.ok ? "OK" : "DOWN"}</span>
        </div>
        <div className="row">
          <span>App</span>
          <span>{health.app}</span>
        </div>
      </section>

      <section className="panel">
        <div className="sectionTitle">Tasks</div>
        {tasks.items.length === 0 ? (
          <div className="empty">No tasks yet.</div>
        ) : (
          <ul className="taskList">
            {tasks.items.map((task) => (
              <li key={task.id} className="taskItem">
                <span>{task.is_done ? "[x]" : "[ ]"}</span>
                <span>{task.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
