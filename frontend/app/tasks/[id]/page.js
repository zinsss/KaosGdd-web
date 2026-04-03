import TaskDetailPanel from "../../../components/TaskDetailPanel";
import { UI_STRINGS } from "../../../lib/strings";

async function getTask(id) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/tasks/" + id, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, error: UI_STRINGS.BACKEND_UNREACHABLE };
  }
}

async function getTaskRaw(id) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/tasks/" + id + "/raw", { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, raw: "" };
  }
}

export default async function TaskDetailPage({ params }) {
  const result = await getTask(params.id);
  const rawResult = result.ok ? await getTaskRaw(params.id) : { ok: false, raw: "" };

  return (
    <main className="page">
      {!result.ok ? (
        <section className="panel">
          <div className="errorText">{result.error || UI_STRINGS.TASK_NOT_FOUND}</div>
        </section>
      ) : (
        <TaskDetailPanel item={result.item} raw={rawResult.raw || ""} />
      )}
    </main>
  );
}