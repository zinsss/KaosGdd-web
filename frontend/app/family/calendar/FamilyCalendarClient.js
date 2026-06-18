"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  DEFAULT_WEATHER_LOCATION,
  fetchWeatherDaily,
  fetchWeatherDayparts,
  getStoredWeatherLocation,
  listenWeatherLocationChange,
  normalizeFamilyWeatherDayparts,
} from "../../lib/weather-client";
import FamilyCalendarWeatherRows from "./FamilyCalendarWeatherRows";
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
  return `${hour}`;
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

function editItemStyleForHour(item, hour) {
  const startMinutes = parseTimeMinutes(item.startTime);
  const duration = eventDurationMinutes(item);
  const top = Math.max(0, (startMinutes ?? hour * 60) - hour * 60);
  return {
    top: `${top}px`,
    height: `${Math.max(18, duration)}px`,
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

function slotTimeFromRowPoint(clientY, rect, rowStartMinutes) {
  const y = Math.max(0, Math.min(rect.height - 1, clientY - rect.top));
  const snappedMinutes = Math.floor(y / 10) * 10;
  return rowStartMinutes + snappedMinutes;
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
    .filter((item) => weekDates.includes(item.date) && (item.allDay || item.startTime))
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
    .filter((item) => item.dayIndex >= 0 && item.dayIndex <= 6 && (item.allDay || item.startTime))
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return String(a.startTime).localeCompare(String(b.startTime)) || a.dayIndex - b.dayIndex;
    });
}

function groupAllDayItems(items) {
  return items.reduce((grouped, item) => {
    if (item.allDay && grouped[item.dayIndex]) grouped[item.dayIndex].push(item);
    return grouped;
  }, FAMILY_CALENDAR_DAY_LABELS.map(() => []));
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

function buildEditWeekRows(items) {
  return FAMILY_CALENDAR_EDIT_VISIBLE_HOURS.map((hour) => ([
    String(hour),
    FAMILY_CALENDAR_DAY_LABELS.map((_, dayIndex) => (
      items.filter((item) => item.dayIndex === dayIndex && parseTimeMinutes(item.startTime) !== null && Math.floor(parseTimeMinutes(item.startTime) / 60) === hour)
    )),
  ]));
}

function buildWeekDateKeys(weekStart) {
  return FAMILY_CALENDAR_DAY_LABELS.map((_, dayIndex) => formatFamilyDateKey(addFamilyDays(weekStart, dayIndex)));
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
  style = undefined,
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
      style={style ?? (editItem ? editItemStyle(item) : undefined)}
      title={item.allDay ? item.title : `${item.title} ${item.startTime}`}
    >
      <span>{item.title}</span>
      {item.overridden ? <span className="familyCalendarRoniOverrideBadge">예외</span> : null}
    </Link>
  );
}

function FamilyCalendarEditWeek({
  allDayItems,
  datedItems,
  deletedRoniOverridesByDate,
  onCreateRoniOverride,
  onDeleteRoniThisWeek,
  onMoveDatedItem,
  onMoveRoniTemplate,
  onRestoreRoniOverride,
  onToggleWeather,
  selectedWeekDates,
  selectedWeekItems,
  selectedWeekStart,
  weatherByDate,
  weatherDaypartsByDate,
  weatherExpanded,
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
  const editRows = useMemo(() => buildEditWeekRows(selectedWeekItems.filter((item) => !item.allDay)), [selectedWeekItems]);
  const hasWeatherRows = selectedWeekDates.some((date) => {
    const summary = weatherByDate.get(date);
    const dayparts = weatherDaypartsByDate[date] || [];
    return Boolean(summary) || dayparts.some((item) => item.glyph || item.temp_min_c !== "" || item.temp_max_c !== "");
  });

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
    const rowStartMinutes = Number(event.currentTarget.dataset.slotStartMinutes);
    const startMinutes = Number.isFinite(rowStartMinutes)
      ? slotTimeFromRowPoint(event.clientY, event.currentTarget.getBoundingClientRect(), rowStartMinutes)
      : slotTimeFromPointer(event);
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
    const rowStartMinutes = Number(dropElement.dataset.slotStartMinutes);
    const startMinutes = Number.isFinite(rowStartMinutes)
      ? slotTimeFromRowPoint(clientY, dropElement.getBoundingClientRect(), rowStartMinutes)
      : slotTimeFromPoint(clientY, dropElement.getBoundingClientRect());
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
    ? dragState.target.startMinutes % 60
    : null;
  const hasAllDayItems = allDayItems.some((items) => items.length);

  return (
    <div
      className="familyCalendarExpandedWeek familyCalendarExpandedWeekEditable"
      aria-label="수정 주간 시간표"
      onPointerCancel={finishDatedDrag}
      onPointerMove={moveDatedDrag}
      onPointerUp={finishDatedDrag}
      ref={editScrollRef}
    >
      {hasWeatherRows ? (
        <FamilyCalendarWeatherRows
          expanded={weatherExpanded}
          onToggle={onToggleWeather}
          selectedWeekDates={selectedWeekDates}
          weatherByDate={weatherByDate}
          weatherDaypartsByDate={weatherDaypartsByDate}
        />
      ) : null}
      {hasAllDayItems ? (
        <div className="familyCalendarTimeRow familyCalendarAllDayRow" key="all-day">
          <span className="familyCalendarTimeLabel familyCalendarAllDayLabel">종일</span>
          {allDayItems.map((items, dayIndex) => (
            <div className="familyCalendarDaySlot familyCalendarAllDaySlot" key={`all-day-${dayIndex}`}>
              {items.map((item) => (
                <CalendarItemLink className="familyCalendarAllDayItem" item={item} key={`${item.type}-${item.id}`} />
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {editRows.map(([hour, dayItems]) => (
        <div className="familyCalendarTimeRow familyCalendarTimeRowEditable" key={hour}>
          <span className="familyCalendarTimeLabel familyCalendarTimeLabelEditable">{formatEditHourLabel(Number(hour))}</span>
          {dayItems.map((items, dayIndex) => {
            const date = formatFamilyDateKey(addFamilyDays(selectedWeekStart, dayIndex));
            const deletedOverrides = deletedRoniOverridesByDate[date] || [];
            const hourStartMinutes = Number(hour) * 60;
            return (
              <div
                className="familyCalendarDaySlot familyCalendarDaySlotEditable"
                data-day-index={dayIndex}
                data-family-calendar-drop="time"
                data-slot-start-minutes={hourStartMinutes}
                key={`${hour}-${dayIndex}`}
                onPointerCancel={clearPendingLongPress}
                onPointerDown={(event) => startSlotLongPress(event, dayIndex)}
                onPointerLeave={clearPendingLongPress}
                onPointerMove={moveSlotLongPress}
                onPointerUp={clearPendingLongPress}
              >
                <span className="familyCalendarDaySlotGuides" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
                {hour === String(FAMILY_CALENDAR_EDIT_START_HOUR) && deletedOverrides.length ? (
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
                {pendingSlotKey.startsWith(`${dayIndex}-`) && Math.floor(Number(pendingSlotKey.split("-")[1]) / 60) === Number(hour) ? (
                  <span
                    className="familyCalendarLongPressTarget"
                    aria-hidden="true"
                    style={{ top: `${Number(pendingSlotKey.split("-")[1]) % 60}px` }}
                  />
                ) : null}
                {dragState?.target?.type === "time" && targetDay === dayIndex && Math.floor(dragState.target.startMinutes / 60) === Number(hour) ? (
                  <span
                    className="familyCalendarDropSlotTarget"
                    aria-hidden="true"
                    style={{ top: `${targetSlotTop}px` }}
                  />
                ) : null}
                {items.map((item) => (
                  <CalendarItemLink
                    className="familyCalendarEditItem familyCalendarEditItemInline"
                    dragging={dragState?.itemId === item.id}
                    item={item}
                    key={`${item.type}-${item.id}`}
                    onCancelRoniChoice={clearRoniChoiceTimer}
                    onStartDatedDrag={startDatedDrag}
                    onStartRoniChoice={startRoniChoice}
                    onStartRoniDrag={startRoniDrag}
                    roniChoiceItemId={roniChoiceItem?.id || ""}
                    style={editItemStyleForHour(item, Number(hour))}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ))}
      {dragState ? (
        <span className="familyCalendarDragGhost" style={{ left: `${dragState.x}px`, top: `${dragState.y}px` }}>
          {dragState.title}
        </span>
      ) : null}
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
  const [weatherLocation, setWeatherLocation] = useState(DEFAULT_WEATHER_LOCATION);
  const [weatherItems, setWeatherItems] = useState([]);
  const [selectedWeekWeatherDayparts, setSelectedWeekWeatherDayparts] = useState({});
  const [weatherExpanded, setWeatherExpanded] = useState(false);

  useEffect(() => {
    setDatedItems(loadFamilyCalendarItems());
    setRounState(loadFamilyRounState());
    setRoniOverrides(loadFamilyRoniOverrides());
  }, []);

  useEffect(() => {
    setWeatherLocation(getStoredWeatherLocation());
    return listenWeatherLocationChange(setWeatherLocation);
  }, []);

  const selectedWeekStart = useMemo(
    () => parseFamilyDateKey(selectedWeekKey) || getFamilyWeekStart(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12, 0, 0, 0)),
    [selectedWeekKey, monthDate],
  );
  const weeks = useMemo(() => getFamilyMonthWeeks(monthDate), [monthDate]);
  const editingCalendar = calendarMode === FAMILY_CALENDAR_MODE_EDIT;
  const monthDateKeys = useMemo(() => weeks.flatMap((week) => week.days.map((day) => day.dateKey)), [weeks]);
  const weatherStart = monthDateKeys[0] || "";
  const weatherEnd = monthDateKeys[monthDateKeys.length - 1] || "";
  const selectedWeekDates = useMemo(() => buildWeekDateKeys(selectedWeekStart), [selectedWeekStart]);
  const datedItemsByDate = useMemo(() => {
    return datedItems.reduce((counts, item) => {
      counts[item.date] = (counts[item.date] || 0) + 1;
      return counts;
    }, {});
  }, [datedItems]);
  const weatherByDate = useMemo(() => {
    const nextWeather = new Map();
    weatherItems.forEach((item) => {
      if (item?.date) nextWeather.set(item.date, item);
    });
    return nextWeather;
  }, [weatherItems]);
  const deletedRoniOverridesByDate = useMemo(() => groupDeletedRoniOverridesByDate(roniOverrides), [roniOverrides]);
  const selectedWeekItems = useMemo(
    () => buildSelectedWeekItems(selectedWeekStart, datedItems, rounState, roniOverrides),
    [selectedWeekStart, datedItems, rounState, roniOverrides],
  );
  const selectedWeekAllDayItems = useMemo(() => groupAllDayItems(selectedWeekItems), [selectedWeekItems]);
  const selectedWeekRows = useMemo(
    () => groupItemsByHour(selectedWeekItems.filter((item) => !item.allDay)),
    [selectedWeekItems],
  );
  const hasSelectedWeekWeatherRows = useMemo(
    () => selectedWeekDates.some((date) => {
      const summary = weatherByDate.get(date);
      const dayparts = selectedWeekWeatherDayparts[date] || [];
      return Boolean(summary) || dayparts.some((item) => item.glyph || item.temp_min_c !== "" || item.temp_max_c !== "");
    }),
    [selectedWeekDates, selectedWeekWeatherDayparts, weatherByDate],
  );

  useEffect(() => {
    setWeatherExpanded(false);
  }, [selectedWeekKey, calendarMode, monthDate]);

  useEffect(() => {
    let cancelled = false;
    if (!weatherLocation || !weatherStart || !weatherEnd) return () => {};

    fetchWeatherDaily({ location: weatherLocation, startDate: weatherStart, endDate: weatherEnd })
      .then((data) => {
        if (cancelled) return;
        if (!data?.ok) {
          setWeatherItems([]);
          return;
        }
        setWeatherItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setWeatherItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [weatherEnd, weatherLocation, weatherStart]);

  useEffect(() => {
    let cancelled = false;
    if (!weatherLocation || !selectedWeekDates.length) return () => {};

    Promise.all(
      selectedWeekDates.map(async (date) => {
        try {
          const payload = await fetchWeatherDayparts({ location: weatherLocation, date });
          return [date, normalizeFamilyWeatherDayparts(payload)];
        } catch {
          return [date, normalizeFamilyWeatherDayparts(null)];
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setSelectedWeekWeatherDayparts(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [selectedWeekDates, weatherLocation]);

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

  function selectWeek(weekKey) {
    setSelectedWeekKey(weekKey);
  }

  function toggleWeekSelection(weekKey) {
    setSelectedWeekKey((current) => (current === weekKey ? "" : weekKey));
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

  const hasSelectedWeekAllDayItems = selectedWeekAllDayItems.some((items) => items.length);
  const hasSelectedWeekContent = hasSelectedWeekAllDayItems || selectedWeekRows.length;

  return (
    <main className="familyCalendar" aria-label="달력">
      <div className="familyCalendarIntro">
        <h2>달력</h2>
        <div className="familyCalendarActions">
          <div className="familyCalendarMonthControls">
            <button className="familyCalendarMonthButtonPrev" type="button" onClick={() => changeMonth(-1)} aria-label="이전 달">
              ‹
            </button>
            <span className="familyCalendarMonthLabel">{monthDate.getFullYear()}.{padFamilyDatePart(monthDate.getMonth() + 1)}</span>
            <button className="familyCalendarMonthButtonNext" type="button" onClick={() => changeMonth(1)} aria-label="다음 달">
              ›
            </button>
          </div>
          <Link className="familyCalendarActionLink familyCalendarActionLinkPrimary" href="/family/calendar/events/new?allDay=1">
            + 일정
          </Link>
          <label className="familyCalendarEditToggle" htmlFor="family-calendar-edit-mode">
            <span className="familyCalendarEditToggleLabel">편집 모드</span>
            <input
              checked={editingCalendar}
              className="familyCalendarEditToggleInput"
              id="family-calendar-edit-mode"
              onChange={(event) => (event.target.checked ? setCalendarMode(FAMILY_CALENDAR_MODE_EDIT) : exitEditMode())}
              role="switch"
              type="checkbox"
            />
            <span aria-hidden="true" className="familyCalendarEditToggleTrack">
              <span className="familyCalendarEditToggleThumb" />
            </span>
          </label>
        </div>
      </div>

      <div className="familyCalendarGrid" aria-label="달력 월간 보기">
        <section className="familyCalendarWeek familyCalendarWeekHeaderRow" aria-hidden="true">
          <div className="familyCalendarWeekDates familyCalendarWeekHeader">
            <span className="familyCalendarTimeRailSpacer familyCalendarTimeRailSpacerEmpty" aria-hidden="true" />
            {FAMILY_CALENDAR_DAY_LABELS.map((label) => (
              <span className="familyCalendarWeekDay familyCalendarWeekHeaderDay" key={label}>{label}</span>
            ))}
          </div>
        </section>

        {weeks.map((week) => {
          const selected = Boolean(selectedWeekKey) && week.key === selectedWeekKey;
          return (
            <section className={`familyCalendarWeek${selected ? " familyCalendarWeekSelected" : ""}`} key={week.key}>
              <div className="familyCalendarWeekDates">
                <button
                  className="familyCalendarWeekToggle"
                  type="button"
                  onClick={() => toggleWeekSelection(week.key)}
                  aria-label={selected ? "이번 주 접기" : "이번 주 펼치기"}
                >
                  <span className="familyCalendarTimeRailSpacer" aria-hidden="true" />
                </button>
                {week.days.map((day, dayIndex) => {
                  const count = datedItemsByDate[day.dateKey] || 0;
                  return (
                    <button
                      className={`familyCalendarWeekDay familyCalendarWeekDateButton${day.inMonth ? "" : " familyCalendarDateOutside"}${selected ? "" : " familyCalendarWeekDateButtonCollapsed"}`}
                      data-day-index={selected && editingCalendar ? dayIndex : undefined}
                      data-family-calendar-drop={selected && editingCalendar ? "date" : undefined}
                      key={day.dateKey}
                      type="button"
                      onClick={() => selectWeek(week.key)}
                    >
                      <span className="familyCalendarWeekDateNumber">{day.date.getDate()}</span>
                      {!selected ? (
                        <span className="familyCalendarWeekDateMeta">
                          {count ? `일정 ${count}` : ""}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {!selected ? null : editingCalendar ? (
                <FamilyCalendarEditWeek
                  allDayItems={selectedWeekAllDayItems}
                  datedItems={datedItems}
                  deletedRoniOverridesByDate={deletedRoniOverridesByDate}
                  onCreateRoniOverride={createRoniOverride}
                  onDeleteRoniThisWeek={deleteRoniThisWeek}
                  onMoveDatedItem={moveDatedItem}
                  onMoveRoniTemplate={moveRoniTemplate}
                  onRestoreRoniOverride={restoreRoniOverride}
                  onToggleWeather={() => setWeatherExpanded((current) => !current)}
                  selectedWeekDates={selectedWeekDates}
                  selectedWeekItems={selectedWeekItems}
                  selectedWeekStart={selectedWeekStart}
                  weatherByDate={weatherByDate}
                  weatherDaypartsByDate={selectedWeekWeatherDayparts}
                  weatherExpanded={weatherExpanded}
                />
              ) : (
                <div className="familyCalendarExpandedWeek" aria-label="선택한 주">
                  {hasSelectedWeekWeatherRows ? (
                    <FamilyCalendarWeatherRows
                      expanded={weatherExpanded}
                      onToggle={() => setWeatherExpanded((current) => !current)}
                      selectedWeekDates={selectedWeekDates}
                      weatherByDate={weatherByDate}
                      weatherDaypartsByDate={selectedWeekWeatherDayparts}
                    />
                  ) : null}
                  {hasSelectedWeekContent ? (
                    <>
                      {hasSelectedWeekAllDayItems ? (
                        <div className="familyCalendarTimeRow familyCalendarAllDayRow">
                          <span className="familyCalendarTimeLabel familyCalendarAllDayLabel">종일</span>
                          {selectedWeekAllDayItems.map((items, dayIndex) => (
                            <div className="familyCalendarDaySlot familyCalendarAllDaySlot" key={`all-day-${dayIndex}`}>
                              {items.map((item) => (
                                <CalendarItemLink className="familyCalendarAllDayItem" item={item} key={`${item.type}-${item.id}`} />
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {selectedWeekRows.map(([hour, dayItems]) => (
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
                      ))}
                    </>
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
