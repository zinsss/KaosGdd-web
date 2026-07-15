import { FAMILY_TIMETABLE_DEFAULT_FONT, normalizeFamilyTimetableFont } from "../familyTimetableFonts.js";
import { fetchFamilyRecord, fetchFamilyModule, fetchFamilyModuleWithQuery, persistFamilyModule, persistFamilyRecord } from "../familyBackendStore.js";

export const FAMILY_CALENDAR_STORAGE_KEY = "kaosgdd.family.calendarItems.v1";
export const FAMILY_ROUNY_STORAGE_KEY = "kaosgdd.family.defaultTimetable.v1";
export const FAMILY_ROUNY_TEMPLATE_STORAGE_KEY = "kaosgdd.family.rounyTimetableTemplates.v1";
export const FAMILY_LEGACY_RONI_TEMPLATE_STORAGE_KEY = "kaosgdd.family.roniTimetableTemplates.v1";
export const FAMILY_ROUN_PLAN_STORAGE_KEY = "kaosgdd.family.rounWeeklyPlans.v1";
export const FAMILY_ROUN_ASSIGNMENT_STORAGE_KEY = "kaosgdd.family.rounAssignments.v1";
export const FAMILY_ROUNY_OVERRIDE_STORAGE_KEY = "kaosgdd.family.rounyOverrides.v1";
export const FAMILY_LEGACY_RONI_OVERRIDE_STORAGE_KEY = "kaosgdd.family.roniOverrides.v1";
export const FAMILY_CAREGIVER_HOURS_STORAGE_KEY = "familyCaregiverHours.v1";
export const FAMILY_CAREGIVER_HOURLY_WAGE_STORAGE_KEY = "familyCaregiverHourlyWage.v1";
export const FAMILY_CAREGIVER_MONTHLY_SETTINGS_STORAGE_KEY = "familyCaregiverMonthlySettings.v1";
export const FAMILY_CALENDAR_RECORD_KEY = "calendar-items";
export const FAMILY_ROUN_RECORD_KEY = "roun-state";
export const FAMILY_ROUNY_OVERRIDE_RECORD_KEY = "rouny-overrides";
export const FAMILY_CAREGIVER_HOURS_RECORD_KEY = "caregiver-hours";
export const FAMILY_CAREGIVER_HOURLY_WAGE_RECORD_KEY = "caregiver-hourly-wage";
export const FAMILY_CAREGIVER_MONTHLY_SETTINGS_RECORD_KEY = "caregiver-monthly-settings";
export const FAMILY_ROUNY_DEFAULT_TEMPLATE_NAME = "기본 시간표";
export const FAMILY_CALENDAR_DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
export const FAMILY_CAREGIVER_HOUR_VALUES = Array.from({ length: 25 }, (_, index) => index * 0.5);
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
export const FAMILY_CALENDAR_COLOR_KEYS = [
  "pink",
  "rose",
  "cream",
  "yellow",
  "peach",
  "mint",
  "green",
  "sky",
  "blue",
  "purple",
  "lavender",
  "gray",
];
export const FAMILY_CALENDAR_COLORS = new Set(FAMILY_CALENDAR_COLOR_KEYS);
export const FAMILY_CALENDAR_COLOR_LABELS = {
  pink: "분홍",
  rose: "연분홍",
  cream: "크림",
  yellow: "노랑",
  peach: "살구",
  mint: "민트",
  green: "초록",
  sky: "하늘",
  blue: "파랑",
  purple: "보라",
  lavender: "라벤더",
  gray: "회색",
};

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
  const allDay = item.allDay === true;

  return {
    id: String(item.id || createFamilyCalendarId()),
    title,
    date: formatFamilyDateKey(parsedDate),
    startTime: allDay ? "" : String(item.startTime || "09:00"),
    endTime: allDay ? "" : String(item.endTime || "09:40"),
    memo: String(item.memo || ""),
    color: normalizeFamilyCalendarColor(item.color),
    allDay,
    sharedWithSong: item.sharedWithSong === true,
    mainItemId: String(item.mainItemId || ""),
    adoptedFromMain: item.adoptedFromMain === true,
    readOnly: item.readOnly === true,
    systemEvent: item.systemEvent === true,
    isImportedCalendarEvent: item.isImportedCalendarEvent === true,
    eventClass: String(item.eventClass || ""),
    classificationSource: String(item.classificationSource || ""),
  };
}

export function normalizeFamilyCaregiverHour(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0.5 || numeric > 12) return null;
  if (Math.round(numeric * 2) !== numeric * 2) return null;
  return numeric;
}

export function parseFamilyCaregiverTime(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function minutesToFamilyCaregiverTime(totalMinutes) {
  const minutesInDay = 24 * 60;
  const normalized = Math.max(0, Math.min(minutesInDay - 1, Number(totalMinutes) || 0));
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function normalizeFamilyCaregiverSession(session) {
  if (!session || typeof session !== "object") return null;
  const start = String(session.start || "");
  const end = String(session.end || "");
  const startMinutes = parseFamilyCaregiverTime(start);
  const endMinutes = parseFamilyCaregiverTime(end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;
  return { start, end };
}

export function normalizeFamilyCaregiverSessions(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeFamilyCaregiverSession).filter(Boolean);
}

export function normalizeFamilyCaregiverExtra(extra) {
  if (!extra || typeof extra !== "object") return null;
  const label = String(extra.label || "").trim();
  const amount = Math.max(0, Math.floor(Number(extra.amount) || 0));
  if (!label && amount <= 0) return null;
  return { label, amount };
}

export function normalizeFamilyCaregiverExtras(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeFamilyCaregiverExtra).filter(Boolean);
}

export function normalizeFamilyCaregiverDayRecord(value) {
  const legacyHours = normalizeFamilyCaregiverHour(value);
  if (legacyHours !== null) {
    return { legacyHours, sessions: [], extras: [], memo: "" };
  }

  if (Array.isArray(value)) {
    return {
      legacyHours: null,
      sessions: normalizeFamilyCaregiverSessions(value),
      extras: [],
      memo: "",
    };
  }

  if (!value || typeof value !== "object") {
    return { legacyHours: null, sessions: [], extras: [], memo: "" };
  }

  return {
    legacyHours: normalizeFamilyCaregiverHour(value.legacyHours),
    sessions: normalizeFamilyCaregiverSessions(value.sessions),
    extras: normalizeFamilyCaregiverExtras(value.extras),
    memo: String(value.memo || "").trim(),
  };
}

export function familyCaregiverSessionDurationHours(session) {
  const normalized = normalizeFamilyCaregiverSession(session);
  if (!normalized) return 0;
  return (parseFamilyCaregiverTime(normalized.end) - parseFamilyCaregiverTime(normalized.start)) / 60;
}

export function calculateFamilyCaregiverHours(value) {
  const record = normalizeFamilyCaregiverDayRecord(value);
  if (record.sessions.length) {
    return record.sessions.reduce((total, session) => total + familyCaregiverSessionDurationHours(session), 0);
  }
  return record.legacyHours || 0;
}

export function calculateFamilyCaregiverExtraTotal(value) {
  return normalizeFamilyCaregiverDayRecord(value).extras.reduce((total, extra) => total + extra.amount, 0);
}

export function formatFamilyCaregiverHours(value) {
  const normalized = calculateFamilyCaregiverHours(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return "";
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
}

export function normalizeFamilyCaregiverHoursMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce((next, [dateKey, hours]) => {
    if (!parseFamilyDateKey(dateKey)) return next;
    const normalizedDate = formatFamilyDateKey(parseFamilyDateKey(dateKey));
    const normalizedLegacy = normalizeFamilyCaregiverHour(hours);
    if (normalizedLegacy !== null) {
      next[normalizedDate] = normalizedLegacy;
      return next;
    }
    const normalizedSessions = normalizeFamilyCaregiverSessions(hours);
    if (normalizedSessions.length) next[normalizedDate] = normalizedSessions;
    if (!Array.isArray(hours) && hours && typeof hours === "object") {
      const normalizedRecord = normalizeFamilyCaregiverDayRecord(hours);
      if (normalizedRecord.sessions.length || normalizedRecord.extras.length || normalizedRecord.memo) {
        next[normalizedDate] = {
          sessions: normalizedRecord.sessions,
          extras: normalizedRecord.extras,
          memo: normalizedRecord.memo,
        };
      }
    }
    return next;
  }, {});
}

export function normalizeFamilyCaregiverHourlyWage(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
}

export function formatFamilyCaregiverWon(value) {
  const numeric = Math.max(0, Math.round(Number(value) || 0));
  return `₩${numeric.toLocaleString("ko-KR")}`;
}

export function formatFamilyCaregiverMonthKey(year, month) {
  const safeYear = Number(year);
  const safeMonth = Number(month);
  if (!Number.isInteger(safeYear) || !Number.isInteger(safeMonth) || safeMonth < 1 || safeMonth > 12) return "";
  return `${safeYear}-${padFamilyDatePart(safeMonth)}`;
}

export function normalizeFamilyCaregiverMonthlySetting(setting) {
  if (!setting || typeof setting !== "object") return null;
  const year = Number(setting.year);
  const month = Number(setting.month);
  const monthKey = formatFamilyCaregiverMonthKey(year, month);
  if (!monthKey) return null;
  return {
    year,
    month,
    hourlyWage: normalizeFamilyCaregiverHourlyWage(setting.hourlyWage),
    transportFee: normalizeFamilyCaregiverHourlyWage(setting.transportFee),
  };
}

export function normalizeFamilyCaregiverMonthlySettingsMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce((next, [monthKey, setting]) => {
    const normalized = normalizeFamilyCaregiverMonthlySetting(setting);
    const normalizedKey = normalized ? formatFamilyCaregiverMonthKey(normalized.year, normalized.month) : "";
    if (normalized && normalizedKey && (!monthKey || monthKey === normalizedKey)) {
      next[normalizedKey] = normalized;
    }
    return next;
  }, {});
}

function previousMonthKeys(year, month, settingsMap) {
  const currentKey = formatFamilyCaregiverMonthKey(year, month);
  return Object.keys(settingsMap)
    .filter((key) => key < currentKey)
    .sort((a, b) => b.localeCompare(a));
}

export function resolveFamilyCaregiverMonthlySetting(settingsMap, year, month, fallbackHourlyWage = 0) {
  const normalizedMap = normalizeFamilyCaregiverMonthlySettingsMap(settingsMap);
  const monthKey = formatFamilyCaregiverMonthKey(year, month);
  const current = normalizedMap[monthKey];
  if (current) return current;
  const previous = normalizedMap[previousMonthKeys(year, month, normalizedMap)[0]];
  return {
    year,
    month,
    hourlyWage: previous?.hourlyWage ?? normalizeFamilyCaregiverHourlyWage(fallbackHourlyWage),
    transportFee: previous?.transportFee ?? 0,
  };
}

export function normalizeFamilyRounyOverride(override) {
  if (!override || typeof override !== "object") return null;
  const sourceRounyId = String(override.sourceRounyId || override.sourceRoniId || "");
  const parsedDate = parseFamilyDateKey(override.date);
  if (!sourceRounyId || !parsedDate) return null;

  return {
    id: String(override.id || createFamilyCalendarId()),
    sourceRounyId,
    date: formatFamilyDateKey(parsedDate),
    startTime: String(override.startTime || ""),
    endTime: String(override.endTime || ""),
    title: String(override.title || "").trim(),
    deleted: override.deleted === true,
    overrideType: override.overrideType === "deleted" || override.deleted === true ? "deleted" : "moved",
  };
}

export function normalizeFamilyRounyDayOfWeek(dayOfWeek) {
  const value = Number(dayOfWeek);
  if (value === 7) return 0;
  if (Number.isInteger(value) && value >= 0 && value <= 6) return value;
  return 1;
}

function normalizeFamilyRounySlot(slot, fallback = {}) {
  return {
    dayOfWeek: normalizeFamilyRounyDayOfWeek(slot?.dayOfWeek ?? fallback.dayOfWeek),
    startTime: String(slot?.startTime || fallback.startTime || "09:00"),
    endTime: String(slot?.endTime || fallback.endTime || "09:40"),
  };
}

export function normalizeFamilyRounyItem(item) {
  if (!item || typeof item !== "object" || item.active === false) return null;
  const title = String(item.title || "").trim();
  if (!title) return null;

  const fallback = {
    dayOfWeek: item.dayOfWeek,
    startTime: item.startTime,
    endTime: item.endTime,
  };
  const rawSessions = Array.isArray(item.sessions) && item.sessions.length > 0
    ? item.sessions
    : item.slots;
  const slots = Array.isArray(rawSessions) && rawSessions.length > 0
    ? rawSessions.map((slot) => normalizeFamilyRounySlot(slot, fallback))
    : [normalizeFamilyRounySlot(item, fallback)];
  const firstSlot = slots[0];
  return {
    id: String(item.id || createFamilyCalendarId()),
    title,
    dayOfWeek: firstSlot.dayOfWeek,
    startTime: firstSlot.startTime,
    endTime: firstSlot.endTime,
    slots,
    sessions: slots,
    memo: String(item.memo || ""),
    color: normalizeFamilyCalendarColor(item.color),
    fontFamily: normalizeFamilyTimetableFont(item.fontFamily || FAMILY_TIMETABLE_DEFAULT_FONT),
    active: item.active !== false,
  };
}

export function normalizeFamilyRounPlan(plan) {
  if (!plan || typeof plan !== "object") return null;
  const name = String(plan.name || "").trim();
  if (!name) return null;
  const itemsSource = Array.isArray(plan.items) ? plan.items : plan.entries;
  const items = Array.isArray(itemsSource) ? itemsSource.map(normalizeFamilyRounyItem).filter(Boolean) : [];
  const now = new Date().toISOString();

  return {
    id: String(plan.id || createFamilyCalendarId()),
    name,
    createdAt: String(plan.createdAt || now),
    updatedAt: String(plan.updatedAt || plan.createdAt || now),
    items,
  };
}

export function createFamilyRounPlan(name = FAMILY_ROUNY_DEFAULT_TEMPLATE_NAME, items = []) {
  const now = new Date().toISOString();
  return normalizeFamilyRounPlan({
    id: createFamilyCalendarId(),
    name,
    createdAt: now,
    updatedAt: now,
    items,
  });
}

export function normalizeFamilyRounAssignment(assignment) {
  if (!assignment || typeof assignment !== "object") return null;
  const planId = String(assignment.planId || "");
  const parsedDate = parseFamilyDateKey(assignment.startDate);
  if (!planId || !parsedDate) return null;

  return {
    id: String(assignment.id || createFamilyCalendarId()),
    planId,
    startDate: formatFamilyDateKey(parsedDate),
  };
}

function normalizeFamilyRounState(state) {
  const plans = Array.isArray(state?.plans) ? state.plans.map(normalizeFamilyRounPlan).filter(Boolean) : [];
  const safePlans = plans.length ? plans : [createFamilyRounPlan(FAMILY_ROUNY_DEFAULT_TEMPLATE_NAME, [])];
  const planIds = new Set(safePlans.map((plan) => plan.id));
  const assignments = Array.isArray(state?.assignments)
    ? state.assignments.map(normalizeFamilyRounAssignment).filter((assignment) => assignment && planIds.has(assignment.planId))
    : [];
  const safeAssignments = assignments.length ? assignments : [{
    id: createFamilyCalendarId(),
    planId: safePlans[0].id,
    startDate: "1970-01-01",
  }];

  return {
    plans: safePlans,
    assignments: safeAssignments.sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))),
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

function readFamilyStorageObject(storageKey) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeFamilyStorageObject(storageKey, value) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    return;
  }
}

function migrateLegacyRounState() {
  const oldTemplateState =
    readFamilyStorageObject(FAMILY_ROUNY_TEMPLATE_STORAGE_KEY) ||
    readFamilyStorageObject(FAMILY_LEGACY_RONI_TEMPLATE_STORAGE_KEY);
  if (Array.isArray(oldTemplateState?.templates) && oldTemplateState.templates.length) {
    const oldPlanKey = "active" + "TemplateId";
    const plans = oldTemplateState.templates.map((template) => normalizeFamilyRounPlan({
      id: template.id,
      name: template.name,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      items: template.entries,
    })).filter(Boolean);
    const selectedPlan = plans.find((plan) => plan.id === oldTemplateState[oldPlanKey]) || plans[0];
    return normalizeFamilyRounState({
      plans,
      assignments: selectedPlan ? [{ planId: selectedPlan.id, startDate: "1970-01-01" }] : [],
    });
  }

  const legacyItems = readFamilyStorageArray(FAMILY_ROUNY_STORAGE_KEY).map(normalizeFamilyRounyItem).filter(Boolean);
  return normalizeFamilyRounState({
    plans: [createFamilyRounPlan(FAMILY_ROUNY_DEFAULT_TEMPLATE_NAME, legacyItems)],
    assignments: [],
  });
}

export function loadFamilyRounState() {
  const plans = readFamilyStorageArray(FAMILY_ROUN_PLAN_STORAGE_KEY);
  const assignments = readFamilyStorageArray(FAMILY_ROUN_ASSIGNMENT_STORAGE_KEY);
  if (plans.length || assignments.length) return normalizeFamilyRounState({ plans, assignments });

  const migratedState = migrateLegacyRounState();
  saveFamilyRounState(migratedState);
  return migratedState;
}

export function saveFamilyRounState(state) {
  const normalized = normalizeFamilyRounState(state);
  writeFamilyStorageArray(FAMILY_ROUN_PLAN_STORAGE_KEY, normalized.plans);
  writeFamilyStorageArray(FAMILY_ROUN_ASSIGNMENT_STORAGE_KEY, normalized.assignments);
  return normalized;
}

export async function fetchFamilyRounState() {
  const payload = await fetchFamilyModule("timetables", "state", { plans: [], assignments: [] });
  const normalized = normalizeFamilyRounState(payload);
  return normalized;
}

export function persistFamilyRounState(state) {
  const normalized = normalizeFamilyRounState(state);
  persistFamilyModule("timetables", "state", "state", normalized);
  return normalized;
}

export function updateFamilyRounPlanItems(rounState, planId, items) {
  const now = new Date().toISOString();
  return normalizeFamilyRounState({
    ...rounState,
    plans: rounState.plans.map((plan) => (
      plan.id === planId
        ? { ...plan, items, updatedAt: now }
        : plan
    )),
  });
}

export function resolveFamilyRounPlanForDate(dateKey, rounState = loadFamilyRounState()) {
  const targetDate = formatFamilyDateKey(parseFamilyDateKey(dateKey) || new Date());
  const sortedAssignments = [...rounState.assignments]
    .filter((assignment) => assignment.startDate <= targetDate)
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  const selectedAssignment = sortedAssignments[0];
  return rounState.plans.find((plan) => plan.id === selectedAssignment?.planId) || rounState.plans[0] || null;
}

export function loadFamilyCalendarItems() {
  return readFamilyStorageArray(FAMILY_CALENDAR_STORAGE_KEY).map(normalizeFamilyCalendarItem).filter(Boolean);
}

export function saveFamilyCalendarItems(items) {
  writeFamilyStorageArray(FAMILY_CALENDAR_STORAGE_KEY, items.map(normalizeFamilyCalendarItem).filter(Boolean));
}

export async function fetchFamilyCalendarItems({ startDate = "", endDate = "" } = {}) {
  const payload = await fetchFamilyModuleWithQuery("events", "events", { start_date: startDate, end_date: endDate }, []);
  const normalized = Array.isArray(payload) ? payload.map(normalizeFamilyCalendarItem).filter(Boolean) : [];
  return normalized;
}

export async function persistFamilyCalendarItems(items) {
  const normalized = items
    .map(normalizeFamilyCalendarItem)
    .filter((item) => item && !item.readOnly && !item.systemEvent);
  const persisted = await persistFamilyModule("events", "events", "events", normalized);
  const next = Array.isArray(persisted) ? persisted.map(normalizeFamilyCalendarItem).filter(Boolean) : normalized;
  return next;
}

export function loadFamilyCaregiverHours() {
  return normalizeFamilyCaregiverHoursMap(readFamilyStorageObject(FAMILY_CAREGIVER_HOURS_STORAGE_KEY));
}

export function saveFamilyCaregiverHours(hoursByDate) {
  writeFamilyStorageObject(FAMILY_CAREGIVER_HOURS_STORAGE_KEY, normalizeFamilyCaregiverHoursMap(hoursByDate));
}

export async function fetchFamilyCaregiverHours() {
  const normalized = normalizeFamilyCaregiverHoursMap(await fetchFamilyModule("caregiver/days", "days", {}));
  return normalized;
}

export async function persistFamilyCaregiverHours(hoursByDate) {
  const normalized = normalizeFamilyCaregiverHoursMap(hoursByDate);
  await persistFamilyModule("caregiver/days", "days", "days", normalized);
}

export function loadFamilyCaregiverHourlyWage() {
  try {
    return normalizeFamilyCaregiverHourlyWage(window.localStorage.getItem(FAMILY_CAREGIVER_HOURLY_WAGE_STORAGE_KEY));
  } catch {
    return 0;
  }
}

export function saveFamilyCaregiverHourlyWage(value) {
  try {
    window.localStorage.setItem(FAMILY_CAREGIVER_HOURLY_WAGE_STORAGE_KEY, String(normalizeFamilyCaregiverHourlyWage(value)));
  } catch {
    return;
  }
}

export async function fetchFamilyCaregiverHourlyWage() {
  const normalized = normalizeFamilyCaregiverHourlyWage(await fetchFamilyModule("settings/caregiver-hourly-wage", "payload", 0));
  return normalized;
}

export async function persistFamilyCaregiverHourlyWage(value) {
  const normalized = normalizeFamilyCaregiverHourlyWage(value);
  await persistFamilyModule("settings/caregiver-hourly-wage", "payload", "payload", normalized);
}

export function loadFamilyCaregiverMonthlySettings() {
  return normalizeFamilyCaregiverMonthlySettingsMap(readFamilyStorageObject(FAMILY_CAREGIVER_MONTHLY_SETTINGS_STORAGE_KEY));
}

export function saveFamilyCaregiverMonthlySettings(settingsMap) {
  writeFamilyStorageObject(FAMILY_CAREGIVER_MONTHLY_SETTINGS_STORAGE_KEY, normalizeFamilyCaregiverMonthlySettingsMap(settingsMap));
}

export async function fetchFamilyCaregiverMonthlySettings() {
  const normalized = normalizeFamilyCaregiverMonthlySettingsMap(
    await fetchFamilyModule("settings/caregiver-monthly-settings", "payload", {}),
  );
  return normalized;
}

export async function persistFamilyCaregiverMonthlySettings(settingsMap) {
  const normalized = normalizeFamilyCaregiverMonthlySettingsMap(settingsMap);
  await persistFamilyModule("settings/caregiver-monthly-settings", "payload", "payload", normalized);
}

export function loadFamilyRounyItemsForDate(dateKey) {
  const rounState = loadFamilyRounState();
  const plan = resolveFamilyRounPlanForDate(dateKey, rounState);
  return (plan?.items || []).map(normalizeFamilyRounyItem).filter(Boolean);
}

export function loadFamilyRounyItems() {
  return loadFamilyRounyItemsForDate(formatFamilyDateKey(new Date()));
}

export function saveFamilyRounyItems(items) {
  const rounState = loadFamilyRounState();
  const plan = resolveFamilyRounPlanForDate(formatFamilyDateKey(new Date()), rounState) || rounState.plans[0];
  const nextState = updateFamilyRounPlanItems(rounState, plan.id, items.map(normalizeFamilyRounyItem).filter(Boolean));
  saveFamilyRounState(nextState);
}

export function loadFamilyRounyOverrides() {
  const overrides = [
    ...readFamilyStorageArray(FAMILY_ROUNY_OVERRIDE_STORAGE_KEY),
    ...readFamilyStorageArray(FAMILY_LEGACY_RONI_OVERRIDE_STORAGE_KEY),
  ].map(normalizeFamilyRounyOverride).filter(Boolean);
  return [...new Map(overrides.map((override) => [override.id, override])).values()];
}

export function saveFamilyRounyOverrides(overrides) {
  writeFamilyStorageArray(FAMILY_ROUNY_OVERRIDE_STORAGE_KEY, overrides.map(normalizeFamilyRounyOverride).filter(Boolean));
}

export async function fetchFamilyRounyOverrides() {
  const payload = await fetchFamilyRecord(FAMILY_ROUNY_OVERRIDE_RECORD_KEY, []);
  const normalized = Array.isArray(payload) ? payload.map(normalizeFamilyRounyOverride).filter(Boolean) : [];
  return normalized;
}

export async function persistFamilyRounyOverrides(overrides) {
  const normalized = overrides.map(normalizeFamilyRounyOverride).filter(Boolean);
  await persistFamilyRecord(FAMILY_ROUNY_OVERRIDE_RECORD_KEY, normalized);
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
    allDay: false,
    startTime: "09:00",
    endTime: "09:40",
    memo: "",
    color: DEFAULT_FAMILY_CALENDAR_COLOR,
  };
}

export function createDefaultFamilyRounyItem() {
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
    fontFamily: FAMILY_TIMETABLE_DEFAULT_FONT,
    active: true,
  };
}
