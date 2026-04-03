import AddReminderForm from "../../../components/AddReminderForm";
import ReminderActions from "../../../components/ReminderActions";
import TaskRawEditor from "../../../components/TaskRawEditor";
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

function reminderPriority(state) {
  switch (state) {
    case "fired":
      return 1;
    case "missed":
      return 2;
    case "scheduled":
      return 3;
    case "snoozed":
      return 4;
    case "acked":
      return 5;
    case "cancelled":
      return 6;
    default:
      return 9;
  }
}

function reminderStateClass(state) {
  switch (state) {
    case "fired":
      return " reminderStateFired";
    case "missed":
      return " reminderStateMissed";
    case "acked":
      return " reminderStateDim";
    case "snoozed":
      return " reminderStateDim";
    case "cancelled":
      return " reminderStateDimmer";
    default:
      return "";
  }
}

export default async function TaskDetailPage({ params }) {
  const result = await getTask(params.id);
  const rawResult = result.ok ? await getTaskRaw(params.id) : { ok: false, raw: "" };

  return (
    <main className="page">
      <section className="panel">
        <div className="line">{UI_STRINGS.APP_TITLE}</div>
        <div className="subline">{UI_STRINGS.TASK_DETAIL}</div>
      </section>

      {!result.ok ? (
        <section className="panel">
          <div className="errorText">{result.error || UI_STRINGS.TASK_NOT_FOUND}</div>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className={"sectionTitle" + (result.item.is_done ? " taskLinkDone taskLinkDoneDetail" : "")}>
              {result.item.title}
            </div>
            <div className="metaLine">
              <span>{result.item.is_done ? UI_STRINGS.DONE_STATE : UI_STRINGS.ACTIVE}</span>
              {result.item.tags && result.item.tags.length > 0 ? (
                <span>{result.item.tags.map((tag) => `#${tag}`).join(" ")}</span>
              ) : null}
              {result.item.repeat_rule ? (
                <span>{`R:${result.item.repeat_rule}`}</span>
              ) : null}
            </div>
            <div className="metaStack">
              <div>{UI_STRINGS.DUE}: {result.item.due_at_display || "-"}</div>
              <div>{UI_STRINGS.MEMO}: {result.item.memo || "-"}</div>
              <div>{UI_STRINGS.CREATED}: {result.item.created_at_display || "-"}</div>
              <div>{UI_STRINGS.UPDATED}: {result.item.updated_at_display || "-"}</div>
            </div>
            <div className="topGap">
              <a className="taskLink" href="/tasks">{UI_STRINGS.BACK_TO_TASKS}</a>
            </div>
          </section>

          <TaskRawEditor taskId={result.item.id} initialRaw={rawResult.raw || ""} />

          <section className="panel">
            <div className="sectionTitle">{UI_STRINGS.REMINDER_LIST}</div>
            {result.item.reminders && result.item.reminders.length > 0 ? (
              <ul className="taskList reminderCompactList">
                {[...result.item.reminders]
                  .sort((a, b) => reminderPriority(a.state) - reminderPriority(b.state))
                  .map((reminder) => (
                    <li key={reminder.id} className="reminderCompactItem">
                      <div className={"reminderCompactRow" + reminderStateClass(reminder.state)}>
                        <span className="reminderWhen">{reminder.remind_at_display || "-"}</span>
                        <span className="reminderState">{reminder.state}</span>
                      </div>
                      {(reminder.state === "fired" || reminder.state === "missed") ? (
                        <ReminderActions reminderId={reminder.id} state={reminder.state} />
                      ) : null}
                    </li>
                  ))}
              </ul>
            ) : (
              <div className="empty">{UI_STRINGS.NO_REMINDERS}</div>
            )}
          </section>

          <AddReminderForm taskId={result.item.id} />
        </>
      )}
    </main>
  );
}