import { NextResponse } from "next/server";

import { APP_TIMEZONE } from "../../../lib/config";
import { DEFAULT_MODULE_NAV_STATUS } from "../../../lib/module-nav-status";

function isOverdueTask(task, nowMs) {
  if (!task || typeof task !== "object") return false;
  const dueAt = task.due_at;
  if (!dueAt) return false;

  const dueAtMs = Date.parse(dueAt);
  if (Number.isNaN(dueAtMs)) return false;

  return dueAtMs < nowMs;
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
    const [tasksRes, eventsRes, remindersRes, suppliesRes] = await Promise.all([
      fetch(base + "/tasks", { cache: "no-store" }),
      fetch(base + `/events?start_date=${today}&end_date=${today}&mode=active`, { cache: "no-store" }),
      fetch(base + "/reminders?mode=active", { cache: "no-store" }),
      fetch(base + "/supplies?mode=active", { cache: "no-store" }),
    ]);

    const [tasksData, eventsData, remindersData, suppliesData] = await Promise.all([
      tasksRes.json().catch(() => ({ items: [] })),
      eventsRes.json().catch(() => ({ items: [] })),
      remindersRes.json().catch(() => ({ items: [] })),
      suppliesRes.json().catch(() => ({ items: [] })),
    ]);

    const nowMs = Date.now();
    const tasks = Array.isArray(tasksData?.items) ? tasksData.items : [];
    const events = Array.isArray(eventsData?.items) ? eventsData.items : [];
    const reminders = Array.isArray(remindersData?.items) ? remindersData.items : [];
    const supplies = Array.isArray(suppliesData?.items) ? suppliesData.items : [];

    return NextResponse.json({
      has_overdue_tasks: tasks.some((task) => isOverdueTask(task, nowMs)),
      has_today_events: events.length > 0,
      has_missed_reminders: reminders.some((reminder) => reminder?.state === "missed"),
      has_pending_supplies: supplies.length > 0,
      has_note_draft: false,
      has_file_draft: false,
      has_attention_fax: false,
    });
  } catch {
    return NextResponse.json({ ...DEFAULT_MODULE_NAV_STATUS });
  }
}
