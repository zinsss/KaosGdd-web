import Link from "next/link";
import { UI_STRINGS } from "../../lib/strings";

const REMINDER_MODES = ["active", "fired", "removed"];

function buildReminderModeHref(mode) {
  return mode === "active" ? "/reminders" : `/reminders?mode=${mode}`;
}

function itemLetter(reminder) {
  if (!reminder.parent_item_type) return "R";

  const map = {
    task: "T",
    reminder: "R",
    event: "E",
    journal: "J",
    note: "N",
    file: "F",
    fax: "X",
    list: "L",
  };

  return map[reminder.parent_item_type] || "?";
}

function reminderWhen(reminder) {
  return reminder.snoozed_until_display || reminder.remind_at_display || "-";
}

async function getReminders(mode) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const suffix = mode && mode !== "active" ? `?mode=${encodeURIComponent(mode)}` : "";
  try {
    const res = await fetch(base + "/reminders" + suffix, { cache: "no-store" });
    return await res.json();
  } catch {
    return { items: [] };
  }
}

export default async function RemindersPage({ searchParams }) {
  const mode = REMINDER_MODES.includes(searchParams?.mode) ? searchParams.mode : "active";
  const result = await getReminders(mode);

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitleRow">
          <div className="sectionTitle sectionTitleNoMargin">{UI_STRINGS.REMINDER_LIST}</div>
          <div className="modeDots" aria-label="Reminder list mode">
            {REMINDER_MODES.map((dotMode) => (
              <Link
                key={dotMode}
                href={buildReminderModeHref(dotMode)}
                className={"modeDot" + (mode === dotMode ? " modeDotActive" : "")}
                aria-label={`Show ${dotMode} reminders`}
              />
            ))}
          </div>
        </div>

        {result.items.length === 0 ? (
          <div className="empty">{UI_STRINGS.NO_REMINDERS}</div>
        ) : (
          <ul className="taskList reminderCompactList">
            {result.items.map((reminder) => {
              const tags = (reminder.tags || []).map((tag) => `#${tag}`).join(" ");
              const letter = itemLetter(reminder);
              const titleText = reminder.parent_item_title || reminder.title;

              return (
                <li key={reminder.id} className="taskListRow reminderListRow">
                  <div className="reminderListTopLine">
                    <span className="reminderListWhen">{reminderWhen(reminder)}</span>
                    <span className="reminderListTags">{tags}</span>
                  </div>

                  <div className="reminderListTitleLine">
                    <span className="reminderListType">[{letter}]</span>
                    <span className="reminderListTitleText">{titleText}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}