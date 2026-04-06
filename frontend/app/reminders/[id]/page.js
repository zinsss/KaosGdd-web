import { UI_STRINGS } from "../../../lib/strings";
import TopNav from "../../../components/TopNav";
import ReminderActions from "../../../components/ReminderActions";

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
      <section className="panel">
        <div className="line">{UI_STRINGS.APP_TITLE}</div>
        <div className="subline">{UI_STRINGS.REMINDER_DETAIL}</div>
      </section>

      <TopNav />

      {!result.ok ? (
        <section className="panel">
          <div className="errorText">{result.error || UI_STRINGS.TASK_NOT_FOUND}</div>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="detailTitleRow">
              <div className="sectionTitle detailMainTitle">{result.item.title}</div>
              <div className="detailStateText">{result.item.state}</div>
            </div>

            <div className="metaStack">
              <div>r:{result.item.snoozed_until_display || result.item.remind_at_display || "-"}</div>
            </div>
          </section>

          {(result.item.state === "fired" || result.item.state === "missed") ? (
            <section className="panel">
              <ReminderActions reminderId={result.item.id} state={result.item.state} />
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}