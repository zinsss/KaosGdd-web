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

function itemRowKey(item) {
  return timeHourLabel(item.startTime || "") || "시간";
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

export default function FamilyCalendarClient() {
  const [datedItems, setDatedItems] = useState([]);
  const [roniItems, setRoniItems] = useState([]);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedWeekKey, setSelectedWeekKey] = useState(() => formatFamilyDateKey(getFamilyWeekStart(new Date())));

  useEffect(() => {
    setDatedItems(loadFamilyCalendarItems());
    setRoniItems(loadFamilyRoniItems());
  }, []);

  const selectedWeekStart = useMemo(() => parseFamilyDateKey(selectedWeekKey) || getFamilyWeekStart(new Date()), [selectedWeekKey]);
  const weeks = useMemo(() => getFamilyMonthWeeks(monthDate), [monthDate]);
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
              ) : (
                <div className="familyCalendarExpandedWeek" aria-label="선택한 주">
                  {selectedWeekRows.length ? (
                    selectedWeekRows.map(([hour, dayItems]) => (
                      <div className="familyCalendarTimeRow" key={hour}>
                        <span className="familyCalendarTimeLabel">{hour}</span>
                        {dayItems.map((items, dayIndex) => (
                          <div className="familyCalendarDaySlot" key={dayIndex}>
                            {items.map((item) => {
                              const href = item.type === "roni" ? "/family/calendar/roni" : `/family/calendar/events/${item.id}/edit`;
                              return (
                                <Link
                                  className={`familyCalendarItem familyCalendarItem${item.type === "roni" ? "Roni" : "Dated"} familyTimetableEntry${familyCalendarColorClassName(item.color)}`}
                                  href={href}
                                  key={`${item.type}-${item.id}`}
                                  title={`${item.title} ${item.startTime}`}
                                >
                                  {item.title}
                                </Link>
                              );
                            })}
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
