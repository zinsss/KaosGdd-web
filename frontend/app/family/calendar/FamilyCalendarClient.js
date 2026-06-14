"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export const FAMILY_CALENDAR_STORAGE_KEY = "kaosgdd.family.calendarItems.v1";
export const FAMILY_RONI_STORAGE_KEY = "kaosgdd.family.defaultTimetable.v1";
export const FAMILY_CALENDAR_DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const DEFAULT_COLOR = "pink";
const FAMILY_CALENDAR_COLORS = new Set([
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

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function getMonthWeeks(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12, 0, 0, 0);
  const lastOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 12, 0, 0, 0);
  let cursor = getWeekStart(firstOfMonth);
  const weeks = [];

  while (cursor <= lastOfMonth || weeks.length < 5) {
    const weekStart = new Date(cursor);
    weeks.push({
      key: formatDateKey(weekStart),
      days: FAMILY_CALENDAR_DAY_LABELS.map((_, dayIndex) => {
        const date = addDays(weekStart, dayIndex);
        return {
          date,
          dateKey: formatDateKey(date),
          dayIndex,
          inMonth: date.getMonth() === monthDate.getMonth(),
        };
      }),
    });
    cursor = addDays(cursor, 7);
    if (weeks.length > 6) break;
  }

  return weeks;
}

function normalizeColor(color) {
  return FAMILY_CALENDAR_COLORS.has(color) ? color : DEFAULT_COLOR;
}

function colorClassName(color) {
  const normalized = normalizeColor(color);
  return `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
}

function normalizeDatedItem(item) {
  if (!item || typeof item !== "object") return null;
  const title = String(item.title || "").trim();
  const date = formatDateKey(parseDateKey(item.date) || new Date());
  if (!title || !date) return null;

  return {
    id: String(item.id || createId()),
    title,
    date,
    startTime: String(item.startTime || ""),
    endTime: String(item.endTime || ""),
    memo: String(item.memo || ""),
    color: normalizeColor(item.color),
  };
}

function normalizeRoniDayOfWeek(dayOfWeek) {
  const value = Number(dayOfWeek);
  if (value === 7) return 0;
  if (Number.isInteger(value) && value >= 0 && value <= 6) return value;
  return 1;
}

function normalizeRoniSlot(slot, fallback) {
  return {
    dayOfWeek: normalizeRoniDayOfWeek(slot?.dayOfWeek ?? fallback?.dayOfWeek),
    startTime: String(slot?.startTime || fallback?.startTime || "09:00"),
    endTime: String(slot?.endTime || fallback?.endTime || "09:40"),
  };
}

function normalizeRoniTemplate(item) {
  if (!item || typeof item !== "object" || item.active === false) return null;
  const title = String(item.title || "").trim();
  if (!title) return null;

  const fallback = {
    dayOfWeek: item.dayOfWeek,
    startTime: item.startTime,
    endTime: item.endTime,
  };
  const slots = Array.isArray(item.slots) && item.slots.length > 0 ? item.slots : [fallback];

  return {
    id: String(item.id || createId()),
    title,
    slots: slots.map((slot) => normalizeRoniSlot(slot, fallback)),
    memo: String(item.memo || ""),
    color: normalizeColor(item.color),
    active: item.active !== false,
  };
}

function readStorageArray(storageKey) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadDatedItems() {
  return readStorageArray(FAMILY_CALENDAR_STORAGE_KEY).map(normalizeDatedItem).filter(Boolean);
}

function loadRoniTemplates() {
  return readStorageArray(FAMILY_RONI_STORAGE_KEY).map(normalizeRoniTemplate).filter(Boolean);
}

function timeHourLabel(timeString) {
  const match = String(timeString || "").match(/^(\d{1,2}):/);
  if (!match) return "";
  return String(Number(match[1]));
}

function itemRowKey(item) {
  return timeHourLabel(item.startTime || "") || "시간";
}

function buildSelectedWeekItems(selectedWeekStart, datedItems, roniTemplates) {
  const weekDates = FAMILY_CALENDAR_DAY_LABELS.map((_, dayIndex) => formatDateKey(addDays(selectedWeekStart, dayIndex)));
  const weekDatedItems = datedItems
    .filter((item) => weekDates.includes(item.date) && item.startTime)
    .map((item) => ({ ...item, type: "dated", dayIndex: weekDates.indexOf(item.date) }));

  const weekRoniItems = roniTemplates.flatMap((template) =>
    template.slots.map((slot, slotIndex) => ({
      id: `${template.id}-${slotIndex}`,
      title: template.title,
      date: weekDates[slot.dayOfWeek],
      dayIndex: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      memo: template.memo,
      color: template.color,
      type: "roni",
    })),
  );

  return [...weekRoniItems, ...weekDatedItems]
    .filter((item) => item.dayIndex >= 0 && item.dayIndex <= 6 && item.startTime)
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)) || a.dayIndex - b.dayIndex);
}

function groupItemsByHour(items) {
  const rows = new Map();
  for (const item of items) {
    const rowKey = itemRowKey(item);
    if (!rowKey) continue;
    if (!rows.has(rowKey)) rows.set(rowKey, FAMILY_CALENDAR_DAY_LABELS.map(() => []));
    rows.get(rowKey)[item.dayIndex].push(item);
  }

  return [...rows.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
}

export default function FamilyCalendarClient() {
  const [datedItems, setDatedItems] = useState([]);
  const [roniTemplates, setRoniTemplates] = useState([]);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedWeekKey, setSelectedWeekKey] = useState(() => formatDateKey(getWeekStart(new Date())));

  useEffect(() => {
    setDatedItems(loadDatedItems());
    setRoniTemplates(loadRoniTemplates());
  }, []);

  const selectedWeekStart = useMemo(() => parseDateKey(selectedWeekKey) || getWeekStart(new Date()), [selectedWeekKey]);
  const weeks = useMemo(() => getMonthWeeks(monthDate), [monthDate]);
  const datedItemsByDate = useMemo(() => {
    return datedItems.reduce((counts, item) => {
      counts[item.date] = (counts[item.date] || 0) + 1;
      return counts;
    }, {});
  }, [datedItems]);
  const selectedWeekItems = useMemo(
    () => buildSelectedWeekItems(selectedWeekStart, datedItems, roniTemplates),
    [selectedWeekStart, datedItems, roniTemplates],
  );
  const selectedWeekRows = useMemo(() => groupItemsByHour(selectedWeekItems), [selectedWeekItems]);

  function changeMonth(offset) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12, 0, 0, 0));
  }

  return (
    <main className="familyCalendar" aria-label="달력">
      <div className="familyCalendarIntro">
        <div>
          <h2>달력</h2>
          <p>뭔날은 날짜별로, 로니는 매주 흐름으로 같이 봐요.</p>
        </div>
        <div className="familyCalendarActions">
          <Link className="familyTaskActionButton" href="/family/timetable">
            로니
          </Link>
          <button type="button" onClick={() => changeMonth(-1)} aria-label="이전 달">
            ‹
          </button>
          <span>{monthDate.getFullYear()}.{pad(monthDate.getMonth() + 1)}</span>
          <button type="button" onClick={() => changeMonth(1)} aria-label="다음 달">
            ›
          </button>
        </div>
      </div>

      <div className="familyCalendarGrid" aria-label="달력 월간 보기">
        <div className="familyCalendarWeekHeader">
          {FAMILY_CALENDAR_DAY_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        {weeks.map((week) => {
          const selected = week.key === selectedWeekKey;
          return (
            <section className={`familyCalendarWeek${selected ? " familyCalendarWeekSelected" : ""}`} key={week.key}>
              <button className="familyCalendarWeekDates" type="button" onClick={() => setSelectedWeekKey(week.key)}>
                {week.days.map((day) => (
                  <span className={day.inMonth ? "" : "familyCalendarDateOutside"} key={day.dateKey}>
                    {day.date.getDate()}
                  </span>
                ))}
              </button>

              {!selected ? (
                <button className="familyCalendarWeekCounts" type="button" onClick={() => setSelectedWeekKey(week.key)} aria-label="뭔날 개수">
                  {week.days.map((day) => {
                    const count = datedItemsByDate[day.dateKey] || 0;
                    return <span key={day.dateKey}>{count ? count : ""}</span>;
                  })}
                </button>
              ) : (
                <div className="familyCalendarExpandedWeek" aria-label="선택한 주">
                  {selectedWeekRows.length ? (
                    selectedWeekRows.map(([hour, dayItems]) => (
                      <div className="familyCalendarTimeRow" key={hour}>
                        <span className="familyCalendarTimeLabel">{hour}</span>
                        {dayItems.map((items, dayIndex) => (
                          <div className="familyCalendarDaySlot" key={dayIndex}>
                            {items.map((item) => (
                              <span
                                className={`familyCalendarItem familyCalendarItem${item.type === "roni" ? "Roni" : "Dated"} familyTimetableEntry${colorClassName(item.color)}`}
                                key={`${item.type}-${item.id}`}
                                title={`${item.title} ${item.startTime}`}
                              >
                                {item.title}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))
                  ) : (
                    <p className="familyCalendarEmptyWeek">이번 주에는 아직 적힌 게 없어요.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
