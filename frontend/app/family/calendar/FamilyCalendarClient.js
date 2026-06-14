"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  FAMILY_CALENDAR_DAY_LABELS,
  addFamilyDays,
  createFamilyCalendarId,
  familyCalendarColorClassName,
  formatFamilyDateKey,
  getDefaultSelectedWeekKeyForMonth,
  getFamilyMonthWeeks,
  getFamilyWeekStart,
  loadFamilyCalendarItems,
  loadFamilyRoniItems,
  loadFamilyRoniOverrides,
  parseFamilyDateKey,
  padFamilyDatePart,
  saveFamilyCalendarItems,
  saveFamilyRoniOverrides,
  timeHourLabel,
} from "./familyCalendarData";

const FAMILY_CALENDAR_MODE_VIEW = "view";
const FAMILY_CALENDAR_MODE_EDIT = "edit";
const FAMILY_CALENDAR_EDIT_START_HOUR = 8;
const FAMILY_CALENDAR_EDIT_END_HOUR = 22;
const FAMILY_CALENDAR_EDIT_HOUR_HEIGHT = 60;
const FAMILY_CALENDAR_LONG_PRESS_MS = 600;
const FAMILY_CALENDAR_LONG_PRESS_MOVE_LIMIT = 10;
const FAMILY_CALENDAR_DRAG_START_MOVE_LIMIT = 8;
const FAMILY_CALENDAR_AUTO_SCROLL_EDGE_PX = 48;
const FAMILY_CALENDAR_AUTO_SCROLL_STEP_PX = 14;
const FAMILY_CALENDAR_DEFAULT_EVENT_DURATION_MINUTES = 40;
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

function minutesToFamilyTime(totalMinutes) {
  const minutesInDay = 24 * 60;
  const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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

function eventDurationMinutes(item) {
  const start = parseTimeMinutes(item.startTime);
  const end = parseTimeMinutes(item.endTime);
  if (start === null || end === null || end <= start) return FAMILY_CALENDAR_DEFAULT_EVENT_DURATION_MINUTES;
  return end - start;
}

function editItemStyle(item) {
  const rangeStart = FAMILY_CALENDAR_EDIT_START_HOUR * 60;
  const rangeEnd = FAMILY_CALENDAR_EDIT_END_HOUR * 60;
  const parsedStart = parseTimeMinutes(item.startTime);
  const parsedEnd = parseTimeMinutes(item.endTime);
  const start = Math.max(rangeStart, Math.min(rangeEnd - 10, parsedStart ?? rangeStart));
  const fallbackEnd = start + 40;
  const end = Math.max(start + 10, Math.min(rangeEnd, parsedEnd ?? fallbackEnd));

  return {
    top: `${start - rangeStart}px`,
    height: `${Math.max(18, end - start)}px`,
  };
}

function slotTimeFromPointer(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return slotTimeFromPoint(event.clientY, rect);
}

function slotTimeFromPoint(clientY, rect) {
  const y = Math.max(0, Math.min(rect.height - 1, clientY - rect.top));
  const minutesFromStart = Math.floor(y / FAMILY_CALENDAR_EDIT_HOUR_HEIGHT * 60);
  const snappedMinutes = Math.floor(minutesFromStart / 10) * 10;
  return FAMILY_CALENDAR_EDIT_START_HOUR * 60 + snappedMinutes;
}

function roniOverrideKey(sourceRoniId, date) {
  return `${sourceRoniId}|${date}`;
}

function applyRoniOverrides(generatedRoniItems, roniOverrides) {
  const overrideByRoniDate = new Map(
    roniOverrides.map((override) => [roniOverrideKey(override.sourceRoniId, override.date), override]),
  );

  return generatedRoniItems.flatMap((item) => {
    const override = overrideByRoniDate.get(roniOverrideKey(item.sourceId, item.date));
    if (!override) return [item];
    if (override.deleted) return [];
    return [{
      ...item,
      id: `${item.id}-override-${override.id}`,
      overrideId: override.id,
      title: override.title || item.title,
      startTime: override.startTime || item.startTime,
      endTime: override.endTime || item.endTime,
      overridden: true,
    }];
  });
}

function buildSelectedWeekItems(selectedWeekStart, datedItems, roniItems, roniOverrides) {
  const weekDates = FAMILY_CALENDAR_DAY_LABELS.map((_, dayIndex) => formatFamilyDateKey(addFamilyDays(selectedWeekStart, dayIndex)));
  const weekDatedItems = datedItems
    .filter((item) => weekDates.includes(item.date) && item.startTime)
    .map((item) => ({ ...item, type: "dated", dayIndex: weekDates.indexOf(item.date) }));

  const weekGeneratedRoniItems = roniItems.flatMap((item) =>
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
  const weekRoniItems = applyRoniOverrides(weekGeneratedRoniItems, roniOverrides);

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

function CalendarItemLink({ dragging = false, item, className = "", onStartDatedDrag = null, onStartRoniChoice = null, roniChoiceItemId = "" }) {
  const href = item.type === "roni" ? "/family/calendar/roni" : `/family/calendar/events/${item.id}/edit`;
  const editItem = className.includes("familyCalendarEditItem");
  const editableDatedItem = editItem && item.type === "dated";
  const editableRoniItem = editItem && item.type === "roni";
  const suppressRoniNavigation = editableRoniItem && roniChoiceItemId === item.id;
  return (
    <Link
      className={`familyCalendarItem familyCalendarItem${item.type === "roni" ? "Roni" : "Dated"} familyTimetableEntry${familyCalendarColorClassName(item.color)}${className ? ` ${className}` : ""}${dragging ? " familyCalendarEditItemDragging" : ""}`}
      href={href}
      key={`${item.type}-${item.id}`}
      onClick={dragging || suppressRoniNavigation ? (event) => event.preventDefault() : undefined}
      onPointerDown={editItem ? (event) => {
        event.stopPropagation();
        if (editableDatedItem && onStartDatedDrag) onStartDatedDrag(event, item);
        if (editableRoniItem && onStartRoniChoice) onStartRoniChoice(event, item);
      } : undefined}
      style={editItem ? editItemStyle(item) : undefined}
      title={`${item.title} ${item.startTime}`}
    >
      <span>{item.title}</span>
      {item.overridden ? <span className="familyCalendarRoniOverrideBadge">예외</span> : null}
    </Link>
  );
}

function FamilyCalendarEditWeek({ datedItems, onCreateRoniOverride, onMoveDatedItem, selectedWeekItems, selectedWeekStart }) {
  const router = useRouter();
  const editScrollRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressStartRef = useRef(null);
  const roniChoiceTimerRef = useRef(null);
  const dragStartRef = useRef(null);
  const autoScrollIntervalRef = useRef(null);
  const autoScrollDirectionRef = useRef(0);
  const [pendingSlotKey, setPendingSlotKey] = useState("");
  const [dragState, setDragState] = useState(null);
  const [roniChoiceItem, setRoniChoiceItem] = useState(null);

  function clearPendingLongPress() {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    longPressStartRef.current = null;
    setPendingSlotKey("");
  }

  function clearRoniChoiceTimer() {
    if (roniChoiceTimerRef.current) window.clearTimeout(roniChoiceTimerRef.current);
    roniChoiceTimerRef.current = null;
  }

  function stopAutoScroll() {
    if (autoScrollIntervalRef.current) window.clearInterval(autoScrollIntervalRef.current);
    autoScrollIntervalRef.current = null;
    autoScrollDirectionRef.current = 0;
  }

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      if (roniChoiceTimerRef.current) window.clearTimeout(roniChoiceTimerRef.current);
      longPressTimerRef.current = null;
      longPressStartRef.current = null;
      roniChoiceTimerRef.current = null;
      stopAutoScroll();
    };
  }, []);

  function openNewEventForSlot(dayIndex, startMinutes) {
    const date = formatFamilyDateKey(addFamilyDays(selectedWeekStart, dayIndex));
    const start = minutesToFamilyTime(startMinutes);
    const end = minutesToFamilyTime(startMinutes + FAMILY_CALENDAR_DEFAULT_EVENT_DURATION_MINUTES);
    router.push(`/family/calendar/events/new?date=${encodeURIComponent(date)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  }

  function startSlotLongPress(event, dayIndex) {
    if (event.button !== undefined && event.button !== 0) return;
    const startMinutes = slotTimeFromPointer(event);
    const slotKey = `${dayIndex}-${startMinutes}`;
    longPressStartRef.current = {
      dayIndex,
      startMinutes,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
    setPendingSlotKey(slotKey);
    longPressTimerRef.current = window.setTimeout(() => {
      const pending = longPressStartRef.current;
      if (!pending) return;
      clearPendingLongPress();
      openNewEventForSlot(pending.dayIndex, pending.startMinutes);
    }, FAMILY_CALENDAR_LONG_PRESS_MS);
  }

  function moveSlotLongPress(event) {
    const pending = longPressStartRef.current;
    if (!pending || pending.pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - pending.x, event.clientY - pending.y);
    if (moved > FAMILY_CALENDAR_LONG_PRESS_MOVE_LIMIT) clearPendingLongPress();
  }

  function findDropTarget(clientX, clientY) {
    const elements = document.elementsFromPoint(clientX, clientY);
    const dropElement = elements.find((element) => element instanceof HTMLElement && element.dataset.familyCalendarDrop);
    if (!dropElement) return null;
    const dayIndex = Number(dropElement.dataset.dayIndex);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return null;
    const date = formatFamilyDateKey(addFamilyDays(selectedWeekStart, dayIndex));
    if (dropElement.dataset.familyCalendarDrop === "date") {
      return { type: "date", dayIndex, date };
    }
    const startMinutes = slotTimeFromPoint(clientY, dropElement.getBoundingClientRect());
    return { type: "time", dayIndex, date, startMinutes };
  }

  function updateAutoScroll(clientY) {
    const container = editScrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    let direction = 0;
    if (clientY - rect.top < FAMILY_CALENDAR_AUTO_SCROLL_EDGE_PX) direction = -1;
    if (rect.bottom - clientY < FAMILY_CALENDAR_AUTO_SCROLL_EDGE_PX) direction = 1;
    if (!direction) {
      stopAutoScroll();
      return;
    }
    autoScrollDirectionRef.current = direction;
    if (autoScrollIntervalRef.current) return;
    autoScrollIntervalRef.current = window.setInterval(() => {
      const current = editScrollRef.current;
      if (!current || !autoScrollDirectionRef.current) return;
      current.scrollTop += autoScrollDirectionRef.current * FAMILY_CALENDAR_AUTO_SCROLL_STEP_PX;
    }, 40);
  }

  function startDatedDrag(event, item) {
    if (event.button !== undefined && event.button !== 0) return;
    clearPendingLongPress();
    clearRoniChoiceTimer();
    const sourceItem = datedItems.find((candidate) => candidate.id === item.id) || item;
    dragStartRef.current = {
      item: sourceItem,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setDragState(null);
  }

  function startRoniChoice(event, item) {
    if (event.button !== undefined && event.button !== 0) return;
    clearPendingLongPress();
    clearRoniChoiceTimer();
    roniChoiceTimerRef.current = window.setTimeout(() => {
      setRoniChoiceItem(item);
      clearRoniChoiceTimer();
    }, FAMILY_CALENDAR_LONG_PRESS_MS);
  }

  function moveDatedDrag(event) {
    const pending = dragStartRef.current;
    if (!pending || pending.pointerId !== event.pointerId) {
      moveSlotLongPress(event);
      return;
    }
    const moved = Math.hypot(event.clientX - pending.x, event.clientY - pending.y);
    if (moved < FAMILY_CALENDAR_DRAG_START_MOVE_LIMIT && !dragState) return;
    event.preventDefault();
    const target = findDropTarget(event.clientX, event.clientY);
    updateAutoScroll(event.clientY);
    setDragState({
      itemId: pending.item.id,
      title: pending.item.title,
      x: event.clientX,
      y: event.clientY,
      target,
    });
  }

  function finishDatedDrag(event) {
    clearRoniChoiceTimer();
    const pending = dragStartRef.current;
    const currentDragState = dragState;
    stopAutoScroll();
    dragStartRef.current = null;
    setDragState(null);
    if (!pending || pending.pointerId !== event.pointerId) {
      clearPendingLongPress();
      return;
    }
    if (!currentDragState?.target) return;
    event.preventDefault();
    onMoveDatedItem(pending.item.id, currentDragState.target);
  }

  function chooseThisWeekOnly() {
    if (!roniChoiceItem) return;
    onCreateRoniOverride(roniChoiceItem);
    setRoniChoiceItem(null);
  }

  const targetDay = dragState?.target?.dayIndex;
  const targetSlotTop = dragState?.target?.type === "time"
    ? dragState.target.startMinutes - FAMILY_CALENDAR_EDIT_START_HOUR * 60
    : null;

  return (
    <div className="familyCalendarEditWeek" aria-label="고치까 주간 시간표" ref={editScrollRef}>
      <p className="familyCalendarEditHelp">길게 눌러 뭔날 추가</p>
      <div
        className="familyCalendarEditGrid"
        onPointerCancel={finishDatedDrag}
        onPointerMove={moveDatedDrag}
        onPointerUp={finishDatedDrag}
        style={{ "--family-calendar-edit-body-height": `${FAMILY_CALENDAR_EDIT_BODY_HEIGHT}px` }}
      >
        <span className="familyCalendarEditCorner" aria-hidden="true" />
        {FAMILY_CALENDAR_DAY_LABELS.map((label, dayIndex) => (
          <span
            className={`familyCalendarEditDayHeader${dragState?.target?.type === "date" && targetDay === dayIndex ? " familyCalendarDropTargetActive" : ""}`}
            data-day-index={dayIndex}
            data-family-calendar-drop="date"
            key={label}
          >
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
          <div
            className="familyCalendarEditDayColumn"
            data-day-index={dayIndex}
            data-family-calendar-drop="time"
            key={label}
            onPointerCancel={clearPendingLongPress}
            onPointerDown={(event) => startSlotLongPress(event, dayIndex)}
            onPointerLeave={clearPendingLongPress}
            onPointerMove={moveSlotLongPress}
            onPointerUp={clearPendingLongPress}
          >
            {FAMILY_CALENDAR_EDIT_VISIBLE_HOURS.map((hour) => (
              <div className="familyCalendarEditHour" key={hour} style={{ top: `${(hour - FAMILY_CALENDAR_EDIT_START_HOUR) * FAMILY_CALENDAR_EDIT_HOUR_HEIGHT}px` }}>
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            ))}
            {pendingSlotKey.startsWith(`${dayIndex}-`) ? (
              <span
                className="familyCalendarLongPressTarget"
                aria-hidden="true"
                style={{ top: `${Number(pendingSlotKey.split("-")[1]) - FAMILY_CALENDAR_EDIT_START_HOUR * 60}px` }}
              />
            ) : null}
            {dragState?.target?.type === "time" && targetDay === dayIndex ? (
              <span
                className="familyCalendarDropSlotTarget"
                aria-hidden="true"
                style={{ top: `${targetSlotTop}px` }}
              />
            ) : null}
            {selectedWeekItems
              .filter((item) => item.dayIndex === dayIndex)
              .map((item) => (
                <CalendarItemLink
                  className="familyCalendarEditItem"
                  dragging={dragState?.itemId === item.id}
                  item={item}
                  key={`${item.type}-${item.id}`}
                  onStartDatedDrag={startDatedDrag}
                  onStartRoniChoice={startRoniChoice}
                  roniChoiceItemId={roniChoiceItem?.id || ""}
                />
              ))}
          </div>
        ))}
        {dragState ? (
          <span className="familyCalendarDragGhost" style={{ left: `${dragState.x}px`, top: `${dragState.y}px` }}>
            {dragState.title}
          </span>
        ) : null}
      </div>
      {roniChoiceItem ? (
        <div className="familyCalendarRoniChoiceSheet" role="dialog" aria-label="로니 예외">
          <p>로니 예외</p>
          <button type="button" onClick={chooseThisWeekOnly}>이번 주만 바꾸기</button>
          <button type="button" onClick={() => router.push("/family/calendar/roni")}>로니도 바꾸기</button>
          <button type="button" onClick={() => setRoniChoiceItem(null)}>고마하자</button>
        </div>
      ) : null}
    </div>
  );
}

export default function FamilyCalendarClient() {
  const [datedItems, setDatedItems] = useState([]);
  const [roniItems, setRoniItems] = useState([]);
  const [roniOverrides, setRoniOverrides] = useState([]);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedWeekKey, setSelectedWeekKey] = useState(() => formatFamilyDateKey(getFamilyWeekStart(new Date())));
  const [calendarMode, setCalendarMode] = useState(FAMILY_CALENDAR_MODE_VIEW);

  useEffect(() => {
    setDatedItems(loadFamilyCalendarItems());
    setRoniItems(loadFamilyRoniItems());
    setRoniOverrides(loadFamilyRoniOverrides());
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
    () => buildSelectedWeekItems(selectedWeekStart, datedItems, roniItems, roniOverrides),
    [selectedWeekStart, datedItems, roniItems, roniOverrides],
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

  function moveDatedItem(itemId, target) {
    setDatedItems((current) => {
      const nextItems = current.map((item) => {
        if (item.id !== itemId) return item;
        if (target.type === "date") return { ...item, date: target.date };
        const duration = eventDurationMinutes(item);
        const startTime = minutesToFamilyTime(target.startMinutes);
        const endTime = minutesToFamilyTime(target.startMinutes + duration);
        return {
          ...item,
          date: target.date,
          startTime,
          endTime,
        };
      });
      saveFamilyCalendarItems(nextItems);
      return nextItems;
    });
  }

  function createRoniOverride(roniItem) {
    setRoniOverrides((current) => {
      const sourceRoniId = roniItem.sourceId;
      const date = roniItem.date;
      const nextOverride = {
        id: createFamilyCalendarId(),
        sourceRoniId,
        date,
        startTime: roniItem.startTime,
        endTime: roniItem.endTime,
        title: roniItem.title,
        deleted: false,
      };
      const nextOverrides = current
        .filter((override) => roniOverrideKey(override.sourceRoniId, override.date) !== roniOverrideKey(sourceRoniId, date))
        .concat(nextOverride);
      saveFamilyRoniOverrides(nextOverrides);
      return nextOverrides;
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
                <FamilyCalendarEditWeek
                  datedItems={datedItems}
                  onCreateRoniOverride={createRoniOverride}
                  onMoveDatedItem={moveDatedItem}
                  selectedWeekItems={selectedWeekItems}
                  selectedWeekStart={selectedWeekStart}
                />
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
