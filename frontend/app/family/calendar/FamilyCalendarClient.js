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
  loadFamilyRoniOverrides,
  loadFamilyRounState,
  parseFamilyDateKey,
  padFamilyDatePart,
  resolveFamilyRounPlanForDate,
  saveFamilyCalendarItems,
  saveFamilyRoniOverrides,
  saveFamilyRounState,
  timeHourLabel,
  updateFamilyRounPlanItems,
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
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function eventDurationMinutes(item) {
  const start = parseTimeMinutes(item.startTime);
  const end = parseTimeMinutes(item.endTime);
  if (start === null || end === null || end <= start) return FAMILY_CALENDAR_DEFAULT_EVENT_DURATION_MINUTES;
  return end - start;
}

function movedItemValues(item, target) {
  if (target.type === "date") {
    return {
      date: target.date,
      dayIndex: target.dayIndex,
      startTime: item.startTime,
      endTime: item.endTime,
    };
  }

  const duration = eventDurationMinutes(item);
  const startTime = minutesToFamilyTime(target.startMinutes);
  const endTime = minutesToFamilyTime(target.startMinutes + duration);
  return {
    date: target.date,
    dayIndex: target.dayIndex,
    startTime,
    endTime,
  };
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

function roniSourceKeys(item) {
  return [item.sourceRoniId, item.sourceId].filter(Boolean);
}

function roniOverrideKey(sourceRoniId, date) {
  return `${sourceRoniId}|${date}`;
}

function groupDeletedRoniOverridesByDate(overrides) {
  return overrides
    .filter((override) => override.deleted)
    .reduce((grouped, override) => {
      if (!grouped[override.date]) grouped[override.date] = [];
      grouped[override.date].push(override);
      return grouped;
    }, {});
}

function applyRoniOverrideToItem(item, override, weekDates) {
  const dayIndex = weekDates.indexOf(override.date);
  if (dayIndex < 0) return null;
  return {
    ...item,
    id: `${item.id}-override-${override.id}`,
    overrideId: override.id,
    date: override.date,
    dayIndex,
    title: override.title || item.title,
    startTime: override.startTime || item.startTime,
    endTime: override.endTime || item.endTime,
    overridden: true,
  };
}

function applyRoniOverrides(generatedRoniItems, roniOverrides, weekDates) {
  const weekOverrides = roniOverrides.filter((override) => weekDates.includes(override.date));
  const overrideByRoniDate = new Map(
    weekOverrides.map((override) => [roniOverrideKey(override.sourceRoniId, override.date), override]),
  );
  const overriddenSources = new Set(weekOverrides.map((override) => override.sourceRoniId));
  const appliedOverrideKeys = new Set();

  const baseItems = generatedRoniItems.flatMap((item) => {
    const sourceKeys = roniSourceKeys(item);
    const exactOverride = sourceKeys
      .map((sourceKey) => overrideByRoniDate.get(roniOverrideKey(sourceKey, item.date)))
      .find(Boolean);
    if (exactOverride) {
      appliedOverrideKeys.add(roniOverrideKey(exactOverride.sourceRoniId, exactOverride.date));
      if (exactOverride.deleted) return [];
      const overriddenItem = applyRoniOverrideToItem(item, exactOverride, weekDates);
      return overriddenItem ? [overriddenItem] : [];
    }
    if (sourceKeys.some((sourceKey) => overriddenSources.has(sourceKey))) return [];
    return [item];
  });

  const movedOverrideItems = weekOverrides.flatMap((override) => {
    const overrideKey = roniOverrideKey(override.sourceRoniId, override.date);
    if (appliedOverrideKeys.has(overrideKey) || override.deleted) return [];
    const sourceItem = generatedRoniItems.find((item) => roniSourceKeys(item).includes(override.sourceRoniId));
    if (!sourceItem) return [];
    const overriddenItem = applyRoniOverrideToItem(sourceItem, override, weekDates);
    return overriddenItem ? [overriddenItem] : [];
  });

  return [...baseItems, ...movedOverrideItems];
}

function buildSelectedWeekItems(selectedWeekStart, datedItems, rounState, roniOverrides) {
  const weekDates = FAMILY_CALENDAR_DAY_LABELS.map((_, dayIndex) => formatFamilyDateKey(addFamilyDays(selectedWeekStart, dayIndex)));
  const weekDatedItems = datedItems
    .filter((item) => weekDates.includes(item.date) && item.startTime)
    .map((item) => ({ ...item, type: "dated", dayIndex: weekDates.indexOf(item.date) }));

  const weekGeneratedRoniItems = weekDates.flatMap((date, dayIndex) => {
    const plan = resolveFamilyRounPlanForDate(date, rounState);
    return (plan?.items || []).flatMap((item) =>
      (item.slots || [item]).flatMap((slot, slotIndex) => {
        if (slot.dayOfWeek !== dayIndex) return [];
        return [{
          ...item,
          id: `${plan.id}-${item.id}-${slotIndex}-${date}`,
          planId: plan.id,
          sourceId: item.id,
          sourceRoniId: `${plan.id}:${item.id}:${slotIndex}`,
          sourceSlotIndex: slotIndex,
          date,
          dayIndex,
          startTime: slot.startTime,
          endTime: slot.endTime,
          type: "roni",
        }];
      }),
    );
  });
  const weekRoniItems = applyRoniOverrides(weekGeneratedRoniItems, roniOverrides, weekDates);

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

function CalendarItemLink({
  dragging = false,
  item,
  className = "",
  onCancelRoniChoice = null,
  onStartDatedDrag = null,
  onStartRoniChoice = null,
  onStartRoniDrag = null,
  roniChoiceItemId = "",
}) {
  const href = item.type === "roni" ? "/family/roun" : `/family/calendar/events/${item.id}/edit`;
  const editItem = className.includes("familyCalendarEditItem");
  const editableDatedItem = editItem && item.type === "dated";
  const editableRoniItem = editItem && item.type === "roni";
  const suppressRoniNavigation = editableRoniItem && roniChoiceItemId === item.id;
  const cancelRoniChoice = editableRoniItem && onCancelRoniChoice ? onCancelRoniChoice : undefined;
  return (
    <Link
      className={`familyCalendarItem familyCalendarItem${item.type === "roni" ? "Roni" : "Dated"} familyTimetableEntry${familyCalendarColorClassName(item.color)}${className ? ` ${className}` : ""}${dragging ? " familyCalendarEditItemDragging" : ""}`}
      href={href}
      key={`${item.type}-${item.id}`}
      onClick={dragging || suppressRoniNavigation ? (event) => event.preventDefault() : undefined}
      onPointerCancel={cancelRoniChoice}
      onPointerDown={editItem ? (event) => {
        event.stopPropagation();
        if (editableDatedItem && onStartDatedDrag) onStartDatedDrag(event, item);
        if (editableRoniItem && onStartRoniDrag) onStartRoniDrag(event, item);
        if (editableRoniItem && onStartRoniChoice) onStartRoniChoice(event, item);
      } : undefined}
      onPointerLeave={cancelRoniChoice}
      onPointerUp={cancelRoniChoice}
      style={editItem ? editItemStyle(item) : undefined}
      title={`${item.title} ${item.startTime}`}
    >
      <span>{item.title}</span>
      {item.overridden ? <span className="familyCalendarRoniOverrideBadge">예외</span> : null}
    </Link>
  );
}

function FamilyCalendarEditWeek({
  datedItems,
  deletedRoniOverridesByDate,
  onCreateRoniOverride,
  onDeleteRoniThisWeek,
  onMoveDatedItem,
  onMoveRoniTemplate,
  onRestoreRoniOverride,
  selectedWeekItems,
  selectedWeekStart,
}) {
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
  const [pendingRoniMove, setPendingRoniMove] = useState(null);
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

  function closeRoniChoiceSheet() {
    clearRoniChoiceTimer();
    setPendingRoniMove(null);
    setRoniChoiceItem(null);
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

  function startCalendarItemDrag(event, item) {
    if (event.button !== undefined && event.button !== 0) return;
    clearPendingLongPress();
    clearRoniChoiceTimer();
    const sourceItem = item.type === "dated" ? datedItems.find((candidate) => candidate.id === item.id) || item : item;
    dragStartRef.current = {
      item: sourceItem,
      itemType: item.type,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setDragState(null);
  }

  function startDatedDrag(event, item) {
    startCalendarItemDrag(event, item);
  }

  function startRoniDrag(event, item) {
    startCalendarItemDrag(event, item);
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
    clearRoniChoiceTimer();
    event.preventDefault();
    const target = findDropTarget(event.clientX, event.clientY);
    updateAutoScroll(event.clientY);
    setDragState({
      itemId: pending.item.id,
      itemType: pending.itemType,
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
    if (pending.itemType === "roni") {
      setPendingRoniMove({ item: pending.item, target: currentDragState.target });
      setRoniChoiceItem(pending.item);
      return;
    }
    onMoveDatedItem(pending.item.id, currentDragState.target);
  }

  function chooseThisWeekOnly() {
    if (!roniChoiceItem) return;
    if (pendingRoniMove) {
      onCreateRoniOverride(pendingRoniMove.item, pendingRoniMove.target);
      closeRoniChoiceSheet();
      return;
    }
    onCreateRoniOverride(roniChoiceItem);
    closeRoniChoiceSheet();
  }

  function chooseDeleteThisWeek() {
    if (!roniChoiceItem) return;
    onDeleteRoniThisWeek(roniChoiceItem);
    closeRoniChoiceSheet();
  }

  function chooseRoniTemplate() {
    if (pendingRoniMove) {
      onMoveRoniTemplate(pendingRoniMove.item, pendingRoniMove.target);
      closeRoniChoiceSheet();
      return;
    }
    router.push("/family/roun");
  }

  const targetDay = dragState?.target?.dayIndex;
  const targetSlotTop = dragState?.target?.type === "time"
    ? dragState.target.startMinutes - FAMILY_CALENDAR_EDIT_START_HOUR * 60
    : null;

  return (
    <div className="familyCalendarEditWeek" aria-label="수정 주간 시간표" ref={editScrollRef}>
      <p className="familyCalendarEditHelp">길게 눌러 일정 추가</p>
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
        {FAMILY_CALENDAR_DAY_LABELS.map((label, dayIndex) => {
          const date = formatFamilyDateKey(addFamilyDays(selectedWeekStart, dayIndex));
          const deletedOverrides = deletedRoniOverridesByDate[date] || [];
          return (
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
              {deletedOverrides.length ? (
                <div className="familyCalendarRoniRestoreStack">
                  {deletedOverrides.map((override) => (
                    <button
                      className="familyCalendarRoniRestoreButton"
                      key={override.id}
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRestoreRoniOverride(override.id);
                      }}
                    >
                      되돌리기
                    </button>
                  ))}
                </div>
              ) : null}
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
                    onCancelRoniChoice={clearRoniChoiceTimer}
                    onStartDatedDrag={startDatedDrag}
                    onStartRoniChoice={startRoniChoice}
                    onStartRoniDrag={startRoniDrag}
                    roniChoiceItemId={roniChoiceItem?.id || ""}
                  />
                ))}
            </div>
          );
        })}
        {dragState ? (
          <span className="familyCalendarDragGhost" style={{ left: `${dragState.x}px`, top: `${dragState.y}px` }}>
            {dragState.title}
          </span>
        ) : null}
      </div>
      {roniChoiceItem ? (
        <div className="familyCalendarRoniChoiceSheet" role="dialog" aria-label="일정 옵션">
          <p>일정 옵션</p>
          <button type="button" onClick={chooseThisWeekOnly}>이번 주만 변경</button>
          <button type="button" onClick={chooseDeleteThisWeek}>이번 주만 일정 취소</button>
          <button type="button" onClick={chooseRoniTemplate}>로운이 시간표 변경</button>
          <button type="button" onClick={closeRoniChoiceSheet}>취소</button>
        </div>
      ) : null}
    </div>
  );
}

export default function FamilyCalendarClient() {
  const [datedItems, setDatedItems] = useState([]);
  const [rounState, setRounState] = useState({ plans: [], assignments: [] });
  const [roniOverrides, setRoniOverrides] = useState([]);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedWeekKey, setSelectedWeekKey] = useState(() => formatFamilyDateKey(getFamilyWeekStart(new Date())));
  const [calendarMode, setCalendarMode] = useState(FAMILY_CALENDAR_MODE_VIEW);

  useEffect(() => {
    setDatedItems(loadFamilyCalendarItems());
    setRounState(loadFamilyRounState());
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
  const deletedRoniOverridesByDate = useMemo(() => groupDeletedRoniOverridesByDate(roniOverrides), [roniOverrides]);
  const selectedWeekItems = useMemo(
    () => buildSelectedWeekItems(selectedWeekStart, datedItems, rounState, roniOverrides),
    [selectedWeekStart, datedItems, rounState, roniOverrides],
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
        const moved = movedItemValues(item, target);
        return {
          ...item,
          date: moved.date,
          startTime: moved.startTime,
          endTime: moved.endTime,
        };
      });
      saveFamilyCalendarItems(nextItems);
      return nextItems;
    });
  }

  function upsertRoniOverride(roniItem, values) {
    setRoniOverrides((current) => {
      const sourceRoniId = roniItem.sourceRoniId || roniItem.sourceId;
      const nextOverride = {
        id: createFamilyCalendarId(),
        sourceRoniId,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        title: roniItem.title,
        deleted: values.deleted === true,
      };
      const nextOverrides = current
        .filter((override) => roniOverrideKey(override.sourceRoniId, override.date) !== roniOverrideKey(sourceRoniId, values.date))
        .concat(nextOverride);
      saveFamilyRoniOverrides(nextOverrides);
      return nextOverrides;
    });
  }

  function createRoniOverride(roniItem, target = null) {
    const moved = target ? movedItemValues(roniItem, target) : {
      date: roniItem.date,
      startTime: roniItem.startTime,
      endTime: roniItem.endTime,
    };
    upsertRoniOverride(roniItem, { ...moved, deleted: false });
  }

  function deleteRoniThisWeek(roniItem) {
    upsertRoniOverride(roniItem, {
      date: roniItem.date,
      startTime: roniItem.startTime,
      endTime: roniItem.endTime,
      deleted: true,
    });
  }

  function restoreRoniOverride(overrideId) {
    setRoniOverrides((current) => {
      const nextOverrides = current.filter((override) => override.id !== overrideId);
      saveFamilyRoniOverrides(nextOverrides);
      return nextOverrides;
    });
  }

  function moveRoniTemplate(roniItem, target) {
    const moved = movedItemValues(roniItem, target);
    const sourceId = roniItem.sourceId;
    const sourceSlotIndex = Number.isInteger(roniItem.sourceSlotIndex) ? roniItem.sourceSlotIndex : 0;
    setRounState((current) => {
      const plan = current.plans.find((candidate) => candidate.id === roniItem.planId) || resolveFamilyRounPlanForDate(roniItem.date, current);
      if (!plan) return current;
      const nextItems = plan.items.map((item) => {
        if (item.id !== sourceId) return item;
        const currentSlots = Array.isArray(item.slots) && item.slots.length ? item.slots : [{
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
        }];
        const nextSlots = currentSlots.map((slot, slotIndex) => (
          slotIndex === sourceSlotIndex
            ? {
              ...slot,
              dayOfWeek: moved.dayIndex,
              startTime: moved.startTime,
              endTime: moved.endTime,
            }
            : slot
        ));
        const firstSlot = nextSlots[0];
        return {
          ...item,
          dayOfWeek: firstSlot.dayOfWeek,
          startTime: firstSlot.startTime,
          endTime: firstSlot.endTime,
          slots: nextSlots,
        };
      });
      const nextState = updateFamilyRounPlanItems(current, plan.id, nextItems);
      saveFamilyRounState(nextState);
      return nextState;
    });
  }

  return (
    <main className="familyCalendar" aria-label="달력">
      <div className="familyCalendarIntro">
        <div>
          <h2>달력</h2>
          <p>일정과 로운이 시간표를 함께 봐요.</p>
        </div>
        <div className="familyCalendarActions">
          <Link className="familyCalendarActionLink familyCalendarActionLinkPrimary" href="/family/calendar/events/new">
            + 일정
          </Link>
          <Link className="familyCalendarActionLink" href="/family/roun">
            로운이 시간표 수정
          </Link>
          {editingCalendar ? (
            <>
              <span className="familyCalendarEditStatus">수정 중</span>
              <button type="button" onClick={exitEditMode}>
                저장
              </button>
              <button type="button" onClick={exitEditMode}>
                취소
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setCalendarMode(FAMILY_CALENDAR_MODE_EDIT)}>
              수정
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
                <button className="familyCalendarWeekCounts" type="button" onClick={() => setSelectedWeekKey(week.key)} aria-label="일정 개수">
                  {week.days.map((day) => {
                    const count = datedItemsByDate[day.dateKey] || 0;
                    return <span key={day.dateKey}>{count ? count : ""}</span>;
                  })}
                </button>
              ) : editingCalendar ? (
                <FamilyCalendarEditWeek
                  datedItems={datedItems}
                  deletedRoniOverridesByDate={deletedRoniOverridesByDate}
                  onCreateRoniOverride={createRoniOverride}
                  onDeleteRoniThisWeek={deleteRoniThisWeek}
                  onMoveDatedItem={moveDatedItem}
                  onMoveRoniTemplate={moveRoniTemplate}
                  onRestoreRoniOverride={restoreRoniOverride}
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
                    <p className="familyCalendarEmptyWeek">이번 주에는 아직 적힌 일정이 없어요.</p>
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
