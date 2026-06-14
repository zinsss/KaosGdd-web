"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  FAMILY_CALENDAR_DAY_LABELS,
  addFamilyDays,
  familyCalendarColorClassName,
  formatFamilyDateKey,
  getDefaultSelectedWeekKeyForMonth,
  getFamilyMonthWeeks,
  getFamilyWeekStart,
  loadFamilyCalendarItems,
  loadFamilyRoniItems,
  parseFamilyDateKey,
  padFamilyDatePart,
  timeHourLabel,
} from "./familyCalendarData";

const FAMILY_CALENDAR_MODE_VIEW = "view";
const FAMILY_CALENDAR_MODE_EDIT = "edit";
const FAMILY_CALENDAR_EDIT_START_HOUR = 8;
const FAMILY_CALENDAR_EDIT_END_HOUR = 22;
const FAMILY_CALENDAR_EDIT_HOUR_HEIGHT = 60;
const FAMILY_CALENDAR_EDIT_HOURS = Array.from(
  { length: FAMILY_CALENDAR_EDIT_END_HOUR - FAMILY_CALENDAR_EDIT_START_HOUR + 1 },
  (_, index) => FAMILY_CALENDAR_EDIT_START_HOUR + index,
);
const FAMILY_CALENDAR_EDIT_VISIBLE_HOURS = FAMILY_CALENDAR_EDIT_HOURS.slice(0, -1);
const FAMILY_CALENDAR_EDIT_BODY_HEIGHT =
  (FAMILY_CALENDAR_EDIT_END_HOUR - FAMILY_CALENDAR_EDIT_START_HOUR) * FAMILY_CALENDAR_EDIT_HOUR_HEIGHT;

function itemRowKey(item) {
  return timeHourLabel(item.startTime || "") || "시간";
}

function formatEditHourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function parseTimeMinutes(timeString) {
  const match = String(timeString || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

function editItemStyle(item) {
  const rangeStart = FAMILY_CALENDAR_EDIT_START_HOUR * 60;
  const rangeEnd = FAMILY_CALENDAR_EDIT_END_HOUR * 60;
  const parsedStart = parseTimeMinutes(item.startTime);
  const parsedEnd = parseTimeMinutes(item.endTime);
  const start = Math.max(rangeStart, Math.min(rangeEnd, parsedStart ?? rangeStart));
  const fallbackEnd = start + 40;
  const end = Math.max(start + 10, Math.min(rangeEnd, parsedEnd ?? fallbackEnd));

  return {
    top: `${start - rangeStart}px`,
    height: `${Math.max(18, end - start)}px`,
  };
}

function buildSelectedWeekItems(selectedWeekStart, datedItems, roniItems) {
  const weekDates = FAMILY_CALENDAR_DAY_LABELS.map((_, dayIndex) => formatFamilyDateKey(addFamilyDays(selectedWeekStart, dayIndex)));
  const weekDatedItems = datedItems
    .filter((item) => weekDates.includes(item.date) && item.startTime)
    .map((item) => ({ ...item, type: "dated", dayIndex: weekDates.indexOf(item.date) }));

  const weekRoniItems = roniItems.flatMap((item) =>
    (item.slots || [item]).map((slot, slotIndex) => ({
      ...item,
      id: `${item.id}-${slotIndex}`,
      sourceId: item.id,
      date: weekDates[slot.dayOfWeek],
      dayIndex: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
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

function CalendarItemLink({ item, className = "" }) {
  const href = item.type === "roni" ? "/family/calendar/roni" : `/family/calendar/events/${item.id}/edit`;
  return (
    <Link
      className={`familyCalendarItem familyCalendarItem${item.type === "roni" ? "Roni" : "Dated"} familyTimetableEntry${familyCalendarColorClassName(item.color)}${className ? ` ${className}` : ""}`}
      href={href}
      key={`${item.type}-${item.id}`}
      style={className.includes("familyCalendarEditItem") ? editItemStyle(item) : undefined}
      title={`${item.title} ${item.startTime}`}
    >
      {item.title}
    </Link>
  );
}

function FamilyCalendarEditWeek({ selectedWeekItems }) {
  return (
    <div className="familyCalendarEditWeek" aria-label="고치까 주간 시간표">
      <p className="familyCalendarEditHelp">길게 눌러 뭔날 추가</p>
      <div
        className="familyCalendarEditGrid"
        style={{ "--family-calendar-edit-body-height": `${FAMILY_CALENDAR_EDIT_BODY_HEIGHT}px` }}
      >
        <span className="familyCalendarEditCorner" aria-hidden="true" />
        {FAMILY_CALENDAR_DAY_LABELS.map((label) => (
          <span className="familyCalendarEditDayHeader" key={label}>
            {label}
          </span>
        ))}
        <div className="familyCalendarEditTimeRail" aria-label="시간">
          {FAMILY_CALENDAR_EDIT_HOURS.map((hour) => (
            <span className="familyCalendarEditHourLabel" key={hour} style={{ top: `${(hour - FAMILY_CALENDAR_EDIT_START_HOUR) * FAMILY_CALENDAR_EDIT_HOUR_HEIGHT}px` }}>
              {formatEditHourLabel(hour)}
            </span>
          ))}
        </div>
        {FAMILY_CALENDAR_DAY_LABELS.map((label, dayIndex) => (
          <div className="familyCalendarEditDayColumn" key={label}>
            {FAMILY_CALENDAR_EDIT_VISIBLE_HOURS.map((hour) => (
              <div className="familyCalendarEditHour" key={hour} style={{ top: `${(hour - FAMILY_CALENDAR_EDIT_START_HOUR) * FAMILY_CALENDAR_EDIT_HOUR_HEIGHT}px` }}>
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            ))}
            {selectedWeekItems
              .filter((item) => item.dayIndex === dayIndex)
              .map((item) => (
                <CalendarItemLink className="familyCalendarEditItem" item={item} key={`${item.type}-${item.id}`} />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FamilyCalendarClient() {
  const [datedItems, setDatedItems] = useState([]);
  const [roniItems, setRoniItems] = useState([]);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedWeekKey, setSelectedWeekKey] = useState(() => formatFamilyDateKey(getFamilyWeekStart(new Date())));
  const [calendarMode, setCalendarMode] = useState(FAMILY_CALENDAR_MODE_VIEW);

  useEffect(() => {
    setDatedItems(loadFamilyCalendarItems());
    setRoniItems(loadFamilyRoniItems());
  }, []);

  const selectedWeekStart = useMemo(() => parseFamilyDateKey(selectedWeekKey) || getFamilyWeekStart(new Date()), [selectedWeekKey]);
  const weeks = useMemo(() => getFamilyMonthWeeks(monthDate), [monthDate]);
  const editingCalendar = calendarMode === FAMILY_CALENDAR_MODE_EDIT;
  const datedItemsByDate = useMemo(() => {
    return datedItems.reduce((counts, item) => {
      counts[item.date] = (counts[item.date] || 0) + 1;
      return counts;
    }, {});
  }, [datedItems]);
  const selectedWeekItems = useMemo(
    () => buildSelectedWeekItems(selectedWeekStart, datedItems, roniItems),
    [selectedWeekStart, datedItems, roniItems],
  );
  const selectedWeekRows = useMemo(() => groupItemsByHour(selectedWeekItems), [selectedWeekItems]);

  function changeMonth(offset) {
    setMonthDate((current) => {
      const nextMonth = new Date(current.getFullYear(), current.getMonth() + offset, 1, 12, 0, 0, 0);
      setSelectedWeekKey(getDefaultSelectedWeekKeyForMonth(nextMonth));
      return nextMonth;
    });
  }

  function exitEditMode() {
    setCalendarMode(FAMILY_CALENDAR_MODE_VIEW);
  }

  return (
    <main className="familyCalendar" aria-label="달력">
      <div className="familyCalendarIntro">
        <div>
          <h2>달력</h2>
          <p>뭔날은 날짜별로, 로니는 매주 흐름으로 같이 봐요.</p>
        </div>
        <div className="familyCalendarActions">
          <Link className="familyCalendarActionLink familyCalendarActionLinkPrimary" href="/family/calendar/events/new">
            + 뭔날
          </Link>
          <Link className="familyCalendarActionLink" href="/family/calendar/roni">
            로니 고치까
          </Link>
          {editingCalendar ? (
            <>
              <span className="familyCalendarEditStatus">고치는 중</span>
              <button type="button" onClick={exitEditMode}>
                되따
              </button>
              <button type="button" onClick={exitEditMode}>
                고마하자
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setCalendarMode(FAMILY_CALENDAR_MODE_EDIT)}>
              고치까
            </button>
          )}
          <button type="button" onClick={() => changeMonth(-1)} aria-label="이전 달">
            ‹
          </button>
          <span>{monthDate.getFullYear()}.{padFamilyDatePart(monthDate.getMonth() + 1)}</span>
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
              ) : editingCalendar ? (
                <FamilyCalendarEditWeek selectedWeekItems={selectedWeekItems} />
              ) : (
                <div className="familyCalendarExpandedWeek" aria-label="선택한 주">
                  {selectedWeekRows.length ? (
                    selectedWeekRows.map(([hour, dayItems]) => (
                      <div className="familyCalendarTimeRow" key={hour}>
                        <span className="familyCalendarTimeLabel">{hour}</span>
                        {dayItems.map((items, dayIndex) => (
                          <div className="familyCalendarDaySlot" key={dayIndex}>
                            {items.map((item) => (
                              <CalendarItemLink item={item} key={`${item.type}-${item.id}`} />
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
