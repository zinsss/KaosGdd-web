export const FAMILY_CALENDAR_STORAGE_KEY = "kaosgdd.family.calendarItems.v1";
export const FAMILY_RONI_STORAGE_KEY = "kaosgdd.family.defaultTimetable.v1";
export const FAMILY_CALENDAR_DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
export const FAMILY_CALENDAR_WEEKDAY_OPTIONS = [
  { dayOfWeek: 0, label: "일요일" },
  { dayOfWeek: 1, label: "월요일" },
  { dayOfWeek: 2, label: "화요일" },
  { dayOfWeek: 3, label: "수요일" },
  { dayOfWeek: 4, label: "목요일" },
  { dayOfWeek: 5, label: "금요일" },
  { dayOfWeek: 6, label: "토요일" },
];

export const DEFAULT_FAMILY_CALENDAR_COLOR = "pink";
export const FAMILY_CALENDAR_COLORS = new Set([
  "pink",
  "rose",
  "peach",
  "yellow",
  "mint",
  "green",
  "sky",
  "blue",
  "lavender",
  "purple",
  "cream",
  "gray",
]);

export function createFamilyCalendarId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function padFamilyDatePart(value) {
  return String(value).padStart(2, "0");
}

export function formatFamilyDateKey(date) {
  return `${date.getFullYear()}-${padFamilyDatePart(date.getMonth() + 1)}-${padFamilyDatePart(date.getDate())}`;
}

export function parseFamilyDateKey(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
}

export function addFamilyDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getFamilyWeekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function getFamilyMonthWeeks(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12, 0, 0, 0);
  const lastOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 12, 0, 0, 0);
  let cursor = getFamilyWeekStart(firstOfMonth);
  const weeks = [];

  while (cursor <= lastOfMonth || weeks.length < 5) {
    const weekStart = new Date(cursor);
    weeks.push({
      key: formatFamilyDateKey(weekStart),
      days: FAMILY_CALENDAR_DAY_LABELS.map((_, dayIndex) => {
        const date = addFamilyDays(weekStart, dayIndex);
        return {
          date,
          dateKey: formatFamilyDateKey(date),
          dayIndex,
          inMonth: date.getMonth() === monthDate.getMonth(),
        };
      }),
    });
    cursor = addFamilyDays(cursor, 7);
    if (weeks.length > 6) break;
  }

  return weeks;
}

export function getDefaultSelectedWeekKeyForMonth(monthDate, today = new Date()) {
  const weeks = getFamilyMonthWeeks(monthDate);
  if (today.getFullYear() === monthDate.getFullYear() && today.getMonth() === monthDate.getMonth()) {
    return formatFamilyDateKey(getFamilyWeekStart(today));
  }

  const firstInMonthWeek = weeks.find((week) => week.days.some((day) => day.inMonth && day.date.getDate() === 1));
  return (firstInMonthWeek || weeks[0])?.key || formatFamilyDateKey(getFamilyWeekStart(monthDate));
}

export function normalizeFamilyCalendarColor(color) {
  return FAMILY_CALENDAR_COLORS.has(color) ? color : DEFAULT_FAMILY_CALENDAR_COLOR;
}

export function familyCalendarColorClassName(color) {
  const normalized = normalizeFamilyCalendarColor(color);
  return `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
}

export function normalizeFamilyCalendarItem(item) {
  if (!item || typeof item !== "object") return null;
  const title = String(item.title || "").trim();
  const parsedDate = parseFamilyDateKey(item.date);
  if (!title || !parsedDate) return null;

  return {
    id: String(item.id || createFamilyCalendarId()),
    title,
    date: formatFamilyDateKey(parsedDate),
    startTime: String(item.startTime || ""),
    endTime: String(item.endTime || ""),
    memo: String(item.memo || ""),
    color: normalizeFamilyCalendarColor(item.color),
  };
}

export function normalizeFamilyRoniDayOfWeek(dayOfWeek) {
  const value = Number(dayOfWeek);
  if (value === 7) return 0;
  if (Number.isInteger(value) && value >= 0 && value <= 6) return value;
  return 1;
}

function normalizeFamilyRoniSlot(slot, fallback = {}) {
  return {
    dayOfWeek: normalizeFamilyRoniDayOfWeek(slot?.dayOfWeek ?? fallback.dayOfWeek),
    startTime: String(slot?.startTime || fallback.startTime || "09:00"),
    endTime: String(slot?.endTime || fallback.endTime || "09:40"),
  };
}

export function normalizeFamilyRoniItem(item) {
  if (!item || typeof item !== "object" || item.active === false) return null;
  const title = String(item.title || "").trim();
  if (!title) return null;

  const fallback = {
    dayOfWeek: item.dayOfWeek,
    startTime: item.startTime,
    endTime: item.endTime,
  };
  const slots = Array.isArray(item.slots) && item.slots.length > 0 ? item.slots.map((slot) => normalizeFamilyRoniSlot(slot, fallback)) : [normalizeFamilyRoniSlot(item, fallback)];
  const firstSlot = slots[0];
  return {
    id: String(item.id || createFamilyCalendarId()),
    title,
    dayOfWeek: firstSlot.dayOfWeek,
    startTime: firstSlot.startTime,
    endTime: firstSlot.endTime,
    slots,
    memo: String(item.memo || ""),
    color: normalizeFamilyCalendarColor(item.color),
    active: item.active !== false,
  };
}

export function readFamilyStorageArray(storageKey) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeFamilyStorageArray(storageKey, items) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    return;
  }
}

export function loadFamilyCalendarItems() {
  return readFamilyStorageArray(FAMILY_CALENDAR_STORAGE_KEY).map(normalizeFamilyCalendarItem).filter(Boolean);
}

export function saveFamilyCalendarItems(items) {
  writeFamilyStorageArray(FAMILY_CALENDAR_STORAGE_KEY, items.map(normalizeFamilyCalendarItem).filter(Boolean));
}

export function loadFamilyRoniItems() {
  return readFamilyStorageArray(FAMILY_RONI_STORAGE_KEY).map(normalizeFamilyRoniItem).filter(Boolean);
}

export function saveFamilyRoniItems(items) {
  writeFamilyStorageArray(FAMILY_RONI_STORAGE_KEY, items.map(normalizeFamilyRoniItem).filter(Boolean));
}

export function timeHourLabel(timeString) {
  const match = String(timeString || "").match(/^(\d{1,2}):/);
  if (!match) return "";
  return String(Number(match[1]));
}

export function createDefaultFamilyCalendarItem() {
  const today = new Date();
  return {
    id: createFamilyCalendarId(),
    title: "",
    date: formatFamilyDateKey(today),
    startTime: "09:00",
    endTime: "09:40",
    memo: "",
    color: DEFAULT_FAMILY_CALENDAR_COLOR,
  };
}

export function createDefaultFamilyRoniItem() {
  const today = new Date();
  return {
    id: createFamilyCalendarId(),
    title: "",
    dayOfWeek: today.getDay(),
    startTime: "09:00",
    endTime: "09:40",
    slots: [
      {
        dayOfWeek: today.getDay(),
        startTime: "09:00",
        endTime: "09:40",
      },
    ],
    memo: "",
    color: DEFAULT_FAMILY_CALENDAR_COLOR,
    active: true,
  };
}
