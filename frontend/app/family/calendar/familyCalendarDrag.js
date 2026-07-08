import { FAMILY_CALENDAR_DAY_LABELS } from "./familyCalendarData.js";

export const FAMILY_SCHEDULE_DRAG_SLOT_MINUTES = 10;
export const FAMILY_SCHEDULE_DRAG_MOVE_LIMIT = 8;
export const FAMILY_SCHEDULE_DRAGGING_CLASS = "kaosDragging";

export function beginFamilyScheduleDragSelectionLock() {
  if (typeof document === "undefined") return;
  document.body?.classList.add(FAMILY_SCHEDULE_DRAGGING_CLASS);
}

export function endFamilyScheduleDragSelectionLock() {
  if (typeof document === "undefined") return;
  document.body?.classList.remove(FAMILY_SCHEDULE_DRAGGING_CLASS);
}

export function minutesToFamilyScheduleTime(totalMinutes) {
  const minutesInDay = 24 * 60;
  const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseFamilyScheduleTimeMinutes(timeString) {
  const match = String(timeString || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function snapFamilyScheduleMinutes(totalMinutes) {
  return Math.floor(totalMinutes / FAMILY_SCHEDULE_DRAG_SLOT_MINUTES) * FAMILY_SCHEDULE_DRAG_SLOT_MINUTES;
}

export function familyScheduleSlotMinutesFromPoint(clientY, rect, startHour, hourHeight) {
  const y = Math.max(0, Math.min(rect.height - 1, clientY - rect.top));
  const minutesFromStart = Math.floor((y / hourHeight) * 60);
  return startHour * 60 + snapFamilyScheduleMinutes(minutesFromStart);
}

export function familyScheduleSlotMinutesFromRowPoint(clientY, rect, rowStartMinutes) {
  const y = Math.max(0, Math.min(rect.height - 1, clientY - rect.top));
  return rowStartMinutes + snapFamilyScheduleMinutes(y);
}

export function formatFamilyScheduleDragTimeLabel(dayIndex, startMinutes) {
  const weekday = FAMILY_CALENDAR_DAY_LABELS[dayIndex] || "";
  return `${weekday} ${minutesToFamilyScheduleTime(startMinutes)}`.trim();
}

export function formatFamilyScheduleDragRangeLabel(dayIndex, startMinutes, endMinutes) {
  const weekday = FAMILY_CALENDAR_DAY_LABELS[dayIndex] || "";
  return `${weekday} ${minutesToFamilyScheduleTime(startMinutes)} ~ ${minutesToFamilyScheduleTime(endMinutes)}`.trim();
}
