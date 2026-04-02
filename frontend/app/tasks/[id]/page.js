import AddReminderForm from "../../../components/AddReminderForm";

async function getTask(id) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/tasks/" + id, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, error: "backend unreachable" };
  }
}

export default async function TaskDetailPage({ params }) {
  const result = await getTask(params.id);

  return (
    <main className="page">
      <section className="panel">
        <div className="line">KaosGdd Web</div>
        <div className="subline">Task detail</div>
      </section>

      {!result.ok ? (
        <section className="panel">
          <div className="errorText">{result.error || "Task not found."}</div>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="sectionTitle">{result.item.title}</div>
            <div className="metaLine">
              <span>id:{result.item.id}</span>
              <span>{result.item.is_done ? "done" : "active"}</span>
            </div>
            <div className="metaStack">
              <div>due: {result.item.due_at || "-"}</div>
              <div>memo: {result.item.memo || "-"}</div>
              <div>created: {result.item.created_at || "-"}</div>
              <div>updated: {result.item.updated_at || "-"}</div>
            </div>
            <div className="topGap">
              <a className="taskLink" href="/tasks">← back to tasks</a>
            </div>
          </section>

          <AddReminderForm taskId={result.item.id} />
        </>
      )}
    </main>
  );
}
