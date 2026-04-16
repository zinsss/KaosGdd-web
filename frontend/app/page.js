import { UI_STRINGS } from "../lib/strings";
import { getApiBase } from "../lib/api-base";

async function getHealth() {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, app: UI_STRINGS.BACKEND_UNREACHABLE };
  }
}

async function getTasks() {
  const base = getApiBase();
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
        <div className="line">{UI_STRINGS.APP_TITLE_WEB}</div>
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
        <div className="sectionTitle">{UI_STRINGS.TASKS}</div>
        {tasks.items.length === 0 ? (
          <div className="empty">{UI_STRINGS.NO_TASKS}</div>
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
