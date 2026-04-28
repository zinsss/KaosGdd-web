import { UI_STRINGS } from "../../../lib/strings";
import ReminderDetailPanel from "../../../components/ReminderDetailPanel";

async function getReminder(id) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/reminders/" + id, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, error: UI_STRINGS.BACKEND_UNREACHABLE };
  }
}

export default async function ReminderDetailPage({ params }) {
  const result = await getReminder(params.id);

  return (
    <main className="page">
      {!result.ok ? (
        <section className="panel">
          <div className="errorText">{result.error || UI_STRINGS.REMINDER_NOT_FOUND}</div>
        </section>
      ) : (
        <ReminderDetailPanel item={result.item} />
      )}
    </main>
  );
}
