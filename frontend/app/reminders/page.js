import TopNav from "../../components/TopNav";
import { UI_STRINGS } from "../../lib/strings";

async function getReminders() {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/reminders", { cache: "no-store" });
    return await res.json();
  } catch {
    return { items: [] };
  }
}

export default async function RemindersPage() {
  const result = await getReminders();

  return (
    <main className="page">
      <section className="panel">
        <div className="line">{UI_STRINGS.APP_TITLE}</div>
        <div className="subline">{UI_STRINGS.REMINDERS}</div>
      </section>

      <TopNav />

      <section className="panel">
        <div className="sectionTitle">{UI_STRINGS.REMINDER_LIST}</div>

        {result.items.length === 0 ? (
          <div className="empty">{UI_STRINGS.NO_REMINDERS}</div>
        ) : (
          <ul className="taskList reminderCompactList">
            {result.items.map((reminder) => (
              <li key={reminder.id} className="taskListRow">
                <div className="taskListRowMain">
                  <div className="taskListTitleBlock">
                    <div className="taskListTitleRow">
                      <span className="taskListStateIcon">⏰</span>
                      <a className="taskLink taskListTitleLink" href={"/reminders/" + reminder.id}>
                        {reminder.title}
                      </a>
                    </div>

                    <div className="taskListDueLine">
                      r:{reminder.snoozed_until_display || reminder.remind_at_display || "-"}
                    </div>
                  </div>

                  <div className="taskListAction reminderListStateText">{reminder.state}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}