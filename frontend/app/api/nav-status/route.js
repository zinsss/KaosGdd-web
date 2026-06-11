import { NextResponse } from "next/server.js";

import { APP_TIMEZONE } from "../../../lib/config.js";
import { DEFAULT_MODULE_NAV_STATUS } from "../../../lib/module-nav-status.js";

const ATTENTION_REMINDER_STATES = new Set(["fired", "missed"]);
const ATTENTION_OUTGOING_FAX_STATUSES = new Set(["failed", "conversion_failed"]);
const INACTIVE_TASK_STATUSES = new Set(["archived", "removed"]);
const ATTENTION_ITEM_LIMIT = 6;

function isActiveTask(task) {
  if (!task || typeof task !== "object") return false;
  if (task.is_done) return false;

  const status = String(task.status || "active").toLowerCase();
  return !INACTIVE_TASK_STATUSES.has(status);
}

export function isOverdueTask(task, nowMs) {
  if (!task || typeof task !== "object") return false;
  if (!isActiveTask(task)) return false;

  const dueAt = task.due_at;
  if (!dueAt) return false;

  const dueAtMs = Date.parse(dueAt);
  if (Number.isNaN(dueAtMs)) return false;

  return dueAtMs < nowMs;
}

function getReminderState(reminder) {
  return String(reminder?.state || "").toLowerCase();
}

export function isAttentionReminder(reminder) {
  if (!reminder || typeof reminder !== "object") return false;

  return ATTENTION_REMINDER_STATES.has(getReminderState(reminder));
}

function getReminderWhen(reminder) {
  return (
    reminder?.snoozed_until_display ||
    reminder?.remind_at_display ||
    reminder?.last_fired_at_display ||
    reminder?.snoozed_until ||
    reminder?.remind_at ||
    reminder?.last_fired_at ||
    reminder?.created_at_display ||
    reminder?.created_at ||
    ""
  );
}

export function summarizeAttentionReminder(reminder) {
  if (!isAttentionReminder(reminder)) return null;

  const id = String(reminder.id || "").trim();
  if (!id) return null;

  return {
    id,
    title: String(reminder.title || "Reminder").trim() || "Reminder",
    state: getReminderState(reminder),
    when: String(getReminderWhen(reminder) || "").trim(),
    href: `/reminders?mode=fired&reminder_id=${encodeURIComponent(id)}`,
  };
}

function getFaxStatus(fax) {
  return String(fax?.fax_status || fax?.status || "").toLowerCase();
}

function getFaxDirection(fax) {
  return String(fax?.direction || "").toLowerCase();
}

export function isAttentionFax(fax) {
  if (!fax || typeof fax !== "object") return false;
  if (String(fax.status || "active").toLowerCase() !== "active") return false;
  if (String(fax.saved_file_id || "").trim()) return false;

  const direction = getFaxDirection(fax);
  const status = getFaxStatus(fax);

  if (direction === "incoming") return status === "received";
  if (direction === "outgoing") return ATTENTION_OUTGOING_FAX_STATUSES.has(status);
  return false;
}

function getFaxWhen(fax) {
  return (
    fax?.received_at_display ||
    fax?.sent_at_display ||
    fax?.created_at_display ||
    fax?.received_at ||
    fax?.sent_at ||
    fax?.created_at ||
    ""
  );
}

export function summarizeAttentionFax(fax) {
  if (!isAttentionFax(fax)) return null;

  const id = String(fax.id || "").trim();
  if (!id) return null;

  return {
    id,
    title: String(fax.title || "Fax").trim() || "Fax",
    direction: getFaxDirection(fax),
    fax_status: getFaxStatus(fax),
    when: String(getFaxWhen(fax) || "").trim(),
    error_message: String(fax.error_message || "").trim(),
    href: `/fax/${encodeURIComponent(id)}`,
  };
}

function summarizeAttentionItems(items, summarize) {
  return items
    .map((item) => summarize(item))
    .filter(Boolean)
    .slice(0, ATTENTION_ITEM_LIMIT);
}

function getTodayYmdInAppTimezone() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

export async function GET() {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const today = getTodayYmdInAppTimezone();

  try {
    const [tasksRes, eventsRes, activeRemindersRes, firedRemindersRes, suppliesRes, faxRes] = await Promise.all([
      fetch(base + "/tasks", { cache: "no-store" }),
      fetch(base + `/events?start_date=${today}&end_date=${today}&mode=active`, { cache: "no-store" }),
      fetch(base + "/reminders?mode=active", { cache: "no-store" }),
      fetch(base + "/reminders?mode=fired", { cache: "no-store" }),
      fetch(base + "/supplies?mode=active", { cache: "no-store" }),
      fetch(base + "/fax?mode=active", { cache: "no-store" }),
    ]);

    const [tasksData, eventsData, activeRemindersData, firedRemindersData, suppliesData, faxData] = await Promise.all([
      tasksRes.json().catch(() => ({ items: [] })),
      eventsRes.json().catch(() => ({ items: [] })),
      activeRemindersRes.json().catch(() => ({ items: [] })),
      firedRemindersRes.json().catch(() => ({ items: [] })),
      suppliesRes.json().catch(() => ({ items: [] })),
      faxRes.json().catch(() => ({ items: [] })),
    ]);

    const nowMs = Date.now();
    const tasks = Array.isArray(tasksData?.items) ? tasksData.items : [];
    const events = Array.isArray(eventsData?.items) ? eventsData.items : [];
    const activeReminders = Array.isArray(activeRemindersData?.items) ? activeRemindersData.items : [];
    const firedReminders = Array.isArray(firedRemindersData?.items) ? firedRemindersData.items : [];
    const reminders = [...activeReminders, ...firedReminders];
    const supplies = Array.isArray(suppliesData?.items) ? suppliesData.items : [];
    const faxes = Array.isArray(faxData?.items) ? faxData.items : [];
    const overdueTaskCount = tasks.filter((task) => isOverdueTask(task, nowMs)).length;
    const attentionReminderCount = reminders.filter((reminder) => isAttentionReminder(reminder)).length;
    const attentionFaxCount = faxes.filter((fax) => isAttentionFax(fax)).length;
    const attentionReminders = summarizeAttentionItems(reminders, summarizeAttentionReminder);
    const attentionFaxes = summarizeAttentionItems(faxes, summarizeAttentionFax);
    const hasOverdueTasks = overdueTaskCount > 0;
    const hasUnackedReminders = attentionReminderCount > 0;
    const hasAttentionFax = attentionFaxCount > 0;
    const strongAttentionCount = overdueTaskCount + attentionReminderCount + attentionFaxCount;

    return NextResponse.json({
      has_overdue_tasks: hasOverdueTasks,
      has_today_events: events.length > 0,
      has_missed_reminders: reminders.some((reminder) => getReminderState(reminder) === "missed"),
      has_unacked_reminders: hasUnackedReminders,
      has_strong_attention: strongAttentionCount > 0,
      strong_attention_count: strongAttentionCount,
      has_pending_supplies: supplies.length > 0,
      has_note_draft: false,
      has_file_draft: false,
      has_attention_fax: hasAttentionFax,
      attention_reminder_count: attentionReminderCount,
      attention_fax_count: attentionFaxCount,
      attention_reminders: attentionReminders,
      attention_faxes: attentionFaxes,
    });
  } catch {
    return NextResponse.json({ ...DEFAULT_MODULE_NAV_STATUS });
  }
}
