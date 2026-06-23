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
  normalizeFamilyWeatherDailyItems,
  normalizeFamilyWeatherDayparts,
} from "../../lib/weather-client";
import FamilyCalendarWeatherRows from "./FamilyCalendarWeatherRows";
import FamilyCalendarWeatherDebugPanel from "./FamilyCalendarWeatherDebugPanel";
import {
  FAMILY_SCHEDULE_DRAG_MOVE_LIMIT,
  familyScheduleSlotMinutesFromPoint,
  familyScheduleSlotMinutesFromRowPoint,
  formatFamilyScheduleDragTimeLabel,
  minutesToFamilyScheduleTime,
  parseFamilyScheduleTimeMinutes,
} from "./familyCalendarDrag";
import {
  FAMILY_CALENDAR_DAY_LABELS,
  addFamilyDays,
  calculateFamilyCaregiverExtraTotal,
  calculateFamilyCaregiverHours,
  createFamilyCalendarId,
  familyCalendarColorClassName,
  formatFamilyCaregiverHours,
  formatFamilyCaregiverWon,
  formatFamilyDateKey,
  getDefaultSelectedWeekKeyForMonth,
  getFamilyMonthWeeks,
  getFamilyWeekStart,
  loadFamilyCaregiverHours,
  loadFamilyCalendarItems,
  loadFamilyRoniOverrides,
  loadFamilyRounState,
  minutesToFamilyCaregiverTime,
  normalizeFamilyCaregiverDayRecord,
  normalizeFamilyCaregiverExtras,
  normalizeFamilyCaregiverSessions,
  parseFamilyCaregiverTime,
  parseFamilyDateKey,
  padFamilyDatePart,
  resolveFamilyRounPlanForDate,
  saveFamilyCaregiverHours,
  saveFamilyCalendarItems,
  saveFamilyRoniOverrides,
} from "./familyCalendarData";

const FAMILY_CALENDAR_MODE_VIEW = "view";
const FAMILY_CALENDAR_MODE_EDIT = "edit";
const FAMILY_CALENDAR_EDIT_START_HOUR = 8;
const FAMILY_CALENDAR_EDIT_END_HOUR = 22;
const FAMILY_CALENDAR_EDIT_HOUR_HEIGHT = 60;
const FAMILY_CALENDAR_LONG_PRESS_MS = 600;
const FAMILY_CALENDAR_LONG_PRESS_MOVE_LIMIT = 10;
const FAMILY_CALENDAR_DRAG_START_MOVE_LIMIT = FAMILY_SCHEDULE_DRAG_MOVE_LIMIT;
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

function formatEditHourLabel(hour) {
  return `${hour}`;
}

function formatDragTargetLabel(target) {
  if (!target) return "";
  if (target.type === "allDay") {
    const weekday = FAMILY_CALENDAR_DAY_LABELS[target.dayIndex] || "";
    return `${weekday} 종일`.trim();
  }
  if (target.type !== "time") return "";
  return formatFamilyScheduleDragTimeLabel(target.dayIndex, target.startMinutes);
}

const minutesToFamilyTime = minutesToFamilyScheduleTime;
const parseTimeMinutes = parseFamilyScheduleTimeMinutes;

function eventDurationMinutes(item) {
  const start = parseTimeMinutes(item.startTime);
  const end = parseTimeMinutes(item.endTime);
  if (start === null || end === null || end <= start) return FAMILY_CALENDAR_DEFAULT_EVENT_DURATION_MINUTES;
  return end - start;
}

function movedItemValues(item, target) {
  if (target.type === "allDay" || (target.type === "date" && item.allDay)) {
    return {
      allDay: true,
      date: target.date,
      dayIndex: target.dayIndex,
    };
  }

  if (target.type === "date") {
    return {
      date: target.date,
      dayIndex: target.dayIndex,
      startTime: item.startTime,
      endTime: item.endTime,
    };
  }

  const rangeStart = FAMILY_CALENDAR_EDIT_START_HOUR * 60;
  const rangeEnd = FAMILY_CALENDAR_EDIT_END_HOUR * 60;
  const duration = Math.min(eventDurationMinutes(item), rangeEnd - rangeStart);
  const boundedStartMinutes = Math.max(rangeStart, Math.min(rangeEnd - duration, target.startMinutes));
  const startTime = minutesToFamilyTime(boundedStartMinutes);
  const endTime = minutesToFamilyTime(boundedStartMinutes + duration);
  return {
    date: target.date,
    dayIndex: target.dayIndex,
    startTime,
    endTime,
  };
}

function timedItemRange(item) {
  const rangeStart = FAMILY_CALENDAR_EDIT_START_HOUR * 60;
  const rangeEnd = FAMILY_CALENDAR_EDIT_END_HOUR * 60;
  const parsedStart = parseTimeMinutes(item.startTime);
  if (parsedStart === null) return null;
  const parsedEnd = parseTimeMinutes(item.endTime);
  const start = Math.max(rangeStart, Math.min(rangeEnd - 10, parsedStart ?? rangeStart));
  const fallbackEnd = start + 40;
  const end = Math.max(start + 10, Math.min(rangeEnd, parsedEnd ?? fallbackEnd));

  return { start, end };
}

function itemAxisStyle(item, visibleStartMinutes, visibleEndMinutes) {
  const range = timedItemRange(item);
  if (!range) return { top: "0px", height: "18px" };
  const start = Math.max(visibleStartMinutes, Math.min(visibleEndMinutes - 10, range.start));
  const end = Math.max(start + 10, Math.min(visibleEndMinutes, range.end));

  return {
    top: `${start - visibleStartMinutes}px`,
    height: `${Math.max(18, end - start)}px`,
  };
}

function editItemStyle(item) {
  return itemAxisStyle(
    item,
    FAMILY_CALENDAR_EDIT_START_HOUR * 60,
    FAMILY_CALENDAR_EDIT_END_HOUR * 60,
  );
}

function slotTimeFromPointer(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return slotTimeFromPoint(event.clientY, rect);
}

function slotTimeFromPoint(clientY, rect) {
  return familyScheduleSlotMinutesFromPoint(
    clientY,
    rect,
    FAMILY_CALENDAR_EDIT_START_HOUR,
    FAMILY_CALENDAR_EDIT_HOUR_HEIGHT,
  );
}

function slotTimeFromRowPoint(clientY, rect, rowStartMinutes) {
  return familyScheduleSlotMinutesFromRowPoint(clientY, rect, rowStartMinutes);
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

function timedItemCoveredHours(item) {
  const range = timedItemRange(item);
  if (!range) return [];
  const startHour = Math.max(FAMILY_CALENDAR_EDIT_START_HOUR, Math.floor(range.start / 60));
  const endHour = Math.min(FAMILY_CALENDAR_EDIT_END_HOUR - 1, Math.ceil(range.end / 60) - 1);
  if (endHour < startHour) return [];
  return Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
}

function itemIntersectsTimedSegment(item, segmentStartMinutes, segmentEndMinutes) {
  const range = timedItemRange(item);
  return Boolean(range && range.end > segmentStartMinutes && range.start < segmentEndMinutes);
}

function buildTimedWeekSegments(items) {
  const hours = new Set();
  for (const item of items) {
    timedItemCoveredHours(item).forEach((hour) => hours.add(hour));
  }

  const sortedHours = [...hours].sort((a, b) => a - b);
  const segments = [];
  for (const hour of sortedHours) {
    const current = segments.at(-1);
    if (!current || current.hours.at(-1) + 1 !== hour) {
      segments.push({ hours: [hour] });
    } else {
      current.hours.push(hour);
    }
  }

  return segments.map((segment) => {
    const startMinutes = segment.hours[0] * 60;
    const endMinutes = (segment.hours.at(-1) + 1) * 60;
    return {
      ...segment,
      startMinutes,
      endMinutes,
      items: items.filter((item) => itemIntersectsTimedSegment(item, startMinutes, endMinutes)),
    };
  });
}

function buildEditTimedWeekSegments(items) {
  return [{
    hours: FAMILY_CALENDAR_EDIT_VISIBLE_HOURS,
    startMinutes: FAMILY_CALENDAR_EDIT_START_HOUR * 60,
    endMinutes: FAMILY_CALENDAR_EDIT_END_HOUR * 60,
    items: items.filter((item) => itemIntersectsTimedSegment(
      item,
      FAMILY_CALENDAR_EDIT_START_HOUR * 60,
      FAMILY_CALENDAR_EDIT_END_HOUR * 60,
    )),
  }];
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
  const allDayEditItem = className.includes("familyCalendarAllDayItemEditable");
  const dragEnabledItem = editItem || allDayEditItem;
  const editableDatedItem = dragEnabledItem && item.type === "dated";
  const editableRoniItem = dragEnabledItem && item.type === "roni";
  const suppressRoniNavigation = editableRoniItem && roniChoiceItemId === item.id;
  const cancelRoniChoice = editableRoniItem && onCancelRoniChoice ? onCancelRoniChoice : undefined;
  return (
    <Link
      className={`familyCalendarItem familyCalendarItem${item.type === "roni" ? "Roni" : "Dated"} familyTimetableEntry${familyCalendarColorClassName(item.color)}${className ? ` ${className}` : ""}${dragging ? " familyCalendarEditItemDragging" : ""}`}
      draggable={dragEnabledItem ? false : undefined}
      href={href}
      key={`${item.type}-${item.id}`}
      onClick={dragging || suppressRoniNavigation ? (event) => event.preventDefault() : undefined}
      onDragStart={dragEnabledItem ? (event) => event.preventDefault() : undefined}
      onPointerCancel={cancelRoniChoice}
      onPointerDown={dragEnabledItem ? (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
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
      <span>{item.type === "roni" && item.overridden ? `!${item.title}` : item.title}</span>
      {item.overridden ? <span className="familyCalendarRoniOverrideBadge">예외</span> : null}
    </Link>
  );
}

function FamilyCaregiverHoursRow({
  activeDate,
  caregiverHoursByDate,
  onChangeHours,
  onToggleDate,
  selectedWeekDates,
}) {
  const [draftSessions, setDraftSessions] = useState([]);
  const [draftExtras, setDraftExtras] = useState([]);
  const [draftError, setDraftError] = useState("");

  useEffect(() => {
    if (!activeDate) {
      setDraftSessions([]);
      setDraftExtras([]);
      setDraftError("");
      return;
    }
    const storedValue = caregiverHoursByDate[activeDate];
    const normalizedRecord = normalizeFamilyCaregiverDayRecord(storedValue);
    const normalizedSessions = normalizedRecord.sessions;
    if (normalizedSessions.length) {
      setDraftSessions(normalizedSessions);
      setDraftExtras(normalizedRecord.extras);
      setDraftError("");
      return;
    }
    const legacyHours = normalizedRecord.legacyHours || 0;
    const legacyEnd = legacyHours > 0 ? minutesToFamilyCaregiverTime(9 * 60 + Math.round(legacyHours * 60)) : "10:00";
    setDraftSessions([{ start: "09:00", end: legacyEnd }]);
    setDraftExtras(normalizedRecord.extras);
    setDraftError("");
  }, [activeDate, caregiverHoursByDate]);

  function updateDraftSession(index, field, value) {
    setDraftSessions((current) => current.map((session, sessionIndex) => (
      sessionIndex === index ? { ...session, [field]: value } : session
    )));
    setDraftError("");
  }

  function addDraftSession() {
    setDraftSessions((current) => {
      const previous = current.at(-1);
      const previousEnd = parseFamilyCaregiverTime(previous?.end) ?? 9 * 60;
      const start = Math.min(previousEnd, 23 * 60 - 60);
      const end = Math.min(start + 60, 23 * 60 + 59);
      return [...current, { start: minutesToFamilyCaregiverTime(start), end: minutesToFamilyCaregiverTime(end) }];
    });
    setDraftError("");
  }

  function removeDraftSession(index) {
    setDraftSessions((current) => current.filter((_, sessionIndex) => sessionIndex !== index));
    setDraftError("");
  }

  function addDraftExtra() {
    setDraftExtras((current) => [...current, { label: "", amount: "" }]);
  }

  function updateDraftExtra(index, field, value) {
    setDraftExtras((current) => current.map((extra, extraIndex) => (
      extraIndex === index
        ? { ...extra, [field]: field === "amount" ? value.replace(/[^\d]/g, "") : value }
        : extra
    )));
  }

  function removeDraftExtra(index) {
    setDraftExtras((current) => current.filter((_, extraIndex) => extraIndex !== index));
  }

  function saveDraftSessions() {
    const normalized = normalizeFamilyCaregiverSessions(draftSessions);
    if (normalized.length !== draftSessions.length) {
      setDraftError("끝 시간이 시작 시간보다 늦어야 해요.");
      return;
    }
    onChangeHours(activeDate, {
      sessions: normalized,
      extras: normalizeFamilyCaregiverExtras(draftExtras),
    });
  }

  const draftTotal = calculateFamilyCaregiverHours(draftSessions);
  const draftExtraTotal = calculateFamilyCaregiverExtraTotal({ extras: draftExtras });

  return (
    <>
      <div className="familyCalendarTimeRow familyCalendarCaregiverRow">
        <span className="familyCalendarTimeLabel familyCalendarCaregiverLabel">•</span>
        {selectedWeekDates.map((date) => {
          const displayValue = formatFamilyCaregiverHours(caregiverHoursByDate[date]);
          return (
            <button
              aria-label={`${date} 돌봄 시간`}
              className={`familyCalendarDaySlot familyCalendarCaregiverSlot${activeDate === date ? " familyCalendarCaregiverSlotActive" : ""}`}
              key={date}
              type="button"
              onClick={() => onToggleDate(activeDate === date ? "" : date)}
            >
              {displayValue}
            </button>
          );
        })}
      </div>
      {activeDate ? (
        <div className="familyCalendarTimeRow familyCalendarCaregiverPickerRow">
          <span className="familyCalendarTimeLabel familyCalendarCaregiverPickerLabel">•</span>
          <div className="familyCalendarCaregiverPicker" aria-label={`${activeDate} 돌봄 시간`}>
            <div className="familyCalendarCaregiverEditorGrid">
              <section className="familyCalendarCaregiverEditorSection" aria-label="돌봄 시간">
                <strong className="familyCalendarCaregiverPickerTitle">돌봄 시간</strong>
                <div className="familyCalendarCaregiverSessions">
                  {draftSessions.map((session, index) => (
                    <div className="familyCalendarCaregiverSessionRow" key={`${activeDate}-${index}`}>
                      <span className="familyCalendarCaregiverSessionNumber">{index + 1}</span>
                      <label className="familyCalendarCaregiverTimeButton">
                        {session.start}
                        <input
                          aria-label="돌봄 시작 시간 선택"
                          className="familyCalendarNativePickerInput"
                          type="time"
                          value={session.start}
                          onChange={(event) => updateDraftSession(index, "start", event.target.value)}
                        />
                      </label>
                      <span className="familyCalendarCaregiverSessionSeparator" aria-hidden="true">~</span>
                      <label className="familyCalendarCaregiverTimeButton">
                        {session.end}
                        <input
                          aria-label="돌봄 끝 시간 선택"
                          className="familyCalendarNativePickerInput"
                          type="time"
                          value={session.end}
                          onChange={(event) => updateDraftSession(index, "end", event.target.value)}
                        />
                      </label>
                      <span className="familyCalendarCaregiverSessionHours">
                        {formatFamilyCaregiverHours([session]) || "0"}시간
                      </span>
                      {draftSessions.length > 1 ? (
                        <button aria-label="돌봄 시간 삭제" className="familyCalendarCaregiverRemoveSession" type="button" onClick={() => removeDraftSession(index)}>
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {draftError ? <p className="familyCalendarCaregiverError">{draftError}</p> : null}
                <div className="familyCalendarCaregiverPickerFooter">
                  <button className="familyCalendarCaregiverAddSession" type="button" onClick={addDraftSession}>
                    + 추가
                  </button>
                  <span className="familyCalendarCaregiverTotal">총 {formatFamilyCaregiverHours(draftTotal) || "0"}시간</span>
                </div>
              </section>
              <section className="familyCalendarCaregiverEditorSection" aria-label="추가 요금">
                <strong className="familyCalendarCaregiverPickerTitle">추가 요금</strong>
                <div className="familyCalendarCaregiverExtras">
                  {draftExtras.map((extra, index) => (
                    <div className="familyCalendarCaregiverExtraRow" key={`${activeDate}-extra-${index}`}>
                      <input
                        aria-label="추가 요금 내용"
                        className="familyCalendarCaregiverExtraLabelInput"
                        type="text"
                        value={extra.label}
                        placeholder="내용"
                        onChange={(event) => updateDraftExtra(index, "label", event.target.value)}
                      />
                      <input
                        aria-label="추가 요금 금액"
                        className="familyCalendarCaregiverExtraAmountInput"
                        inputMode="numeric"
                        type="text"
                        value={extra.amount}
                        placeholder="금액"
                        onChange={(event) => updateDraftExtra(index, "amount", event.target.value)}
                      />
                      <button aria-label="추가 요금 삭제" className="familyCalendarCaregiverRemoveExtra" type="button" onClick={() => removeDraftExtra(index)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="familyCalendarCaregiverPickerFooter">
                  <button className="familyCalendarCaregiverAddExtra" type="button" onClick={addDraftExtra}>
                    + 요금 추가
                  </button>
                  <span className="familyCalendarCaregiverExtraTotal">추가 {formatFamilyCaregiverWon(draftExtraTotal)}</span>
                </div>
              </section>
            </div>
            <div className="familyCalendarCaregiverPickerActions">
              <button className="familyCalendarCaregiverSave" type="button" onClick={saveDraftSessions}>
                저장
              </button>
              <button className="familyCalendarCaregiverCancel" type="button" onClick={() => onToggleDate("")}>
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FamilyCalendarTimedArea({
  deletedRoniOverridesByDate = {},
  dragState = null,
  editable = false,
  onCancelRoniChoice = null,
  onRestoreRoniOverride = null,
  onStartDatedDrag = null,
  onStartRoniChoice = null,
  onStartRoniDrag = null,
  pendingSlotKey = "",
  roniChoiceItemId = "",
  segment,
  selectedWeekStart,
  startSlotLongPress = null,
  clearPendingLongPress = null,
  moveSlotLongPress = null,
}) {
  const segmentHeight = segment.hours.length * FAMILY_CALENDAR_EDIT_HOUR_HEIGHT;
  const itemsByDay = FAMILY_CALENDAR_DAY_LABELS.map((_, dayIndex) => (
    segment.items.filter((item) => item.dayIndex === dayIndex)
  ));
  const targetDay = dragState?.target?.dayIndex;
  const targetSlotTop = dragState?.target?.type === "time"
    ? dragState.target.startMinutes % 60
    : null;

  return (
    <div
      className={`familyCalendarTimedArea${editable ? " familyCalendarTimedAreaEditable" : ""}`}
      style={{ "--family-calendar-timed-area-height": `${segmentHeight}px` }}
    >
      <div className="familyCalendarTimedRows">
        {segment.hours.map((hour) => (
          <div className={`familyCalendarTimeRow${editable ? " familyCalendarTimeRowEditable" : ""}`} key={hour}>
            <span className={`familyCalendarTimeLabel${editable ? " familyCalendarTimeLabelEditable" : ""}`}>
              {formatEditHourLabel(hour)}
            </span>
            {FAMILY_CALENDAR_DAY_LABELS.map((_, dayIndex) => {
              const date = formatFamilyDateKey(addFamilyDays(selectedWeekStart, dayIndex));
              const deletedOverrides = deletedRoniOverridesByDate[date] || [];
              const hourStartMinutes = hour * 60;
              return (
                <div
                  className={`familyCalendarDaySlot${editable ? " familyCalendarDaySlotEditable" : " familyCalendarTimedDaySlot"}`}
                  data-day-index={editable ? dayIndex : undefined}
                  data-family-calendar-drop={editable ? "time" : undefined}
                  data-slot-start-minutes={editable ? hourStartMinutes : undefined}
                  key={`${hour}-${dayIndex}`}
                  onPointerCancel={editable ? clearPendingLongPress : undefined}
                  onPointerDown={editable && startSlotLongPress ? (event) => startSlotLongPress(event, dayIndex) : undefined}
                  onPointerLeave={editable ? clearPendingLongPress : undefined}
                  onPointerMove={editable ? moveSlotLongPress : undefined}
                  onPointerUp={editable ? clearPendingLongPress : undefined}
                >
                  {editable ? (
                    <span className="familyCalendarDaySlotGuides" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : null}
                  {editable && hour === FAMILY_CALENDAR_EDIT_START_HOUR && deletedOverrides.length ? (
                    <div className="familyCalendarRoniRestoreStack">
                      {deletedOverrides.map((override) => (
                        <button
                          className="familyCalendarRoniRestoreButton"
                          key={override.id}
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRestoreRoniOverride?.(override.id);
                          }}
                        >
                          되돌리기
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {editable && pendingSlotKey.startsWith(`${dayIndex}-`) && Math.floor(Number(pendingSlotKey.split("-")[1]) / 60) === hour ? (
                    <span
                      className="familyCalendarLongPressTarget"
                      aria-hidden="true"
                      style={{ top: `${Number(pendingSlotKey.split("-")[1]) % 60}px` }}
                    />
                  ) : null}
                  {editable && dragState?.target?.type === "time" && targetDay === dayIndex && Math.floor(dragState.target.startMinutes / 60) === hour ? (
                    <span
                      className="familyCalendarDropSlotTarget"
                      aria-hidden="true"
                      style={{ top: `${targetSlotTop}px` }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="familyCalendarTimedItemsLayer">
        <span className="familyCalendarTimedLayerRail" aria-hidden="true" />
        {itemsByDay.map((items, dayIndex) => (
          <div className="familyCalendarTimedDayLayer" key={dayIndex}>
            {items.map((item) => (
              <CalendarItemLink
                className={editable ? "familyCalendarEditItem familyCalendarEditItemInline" : "familyCalendarTimedItem"}
                dragging={dragState?.itemId === item.id}
                item={item}
                key={`${item.type}-${item.id}`}
                onCancelRoniChoice={onCancelRoniChoice}
                onStartDatedDrag={onStartDatedDrag}
                onStartRoniChoice={onStartRoniChoice}
                onStartRoniDrag={onStartRoniDrag}
                roniChoiceItemId={roniChoiceItemId}
                style={itemAxisStyle(item, segment.startMinutes, segment.endMinutes)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FamilyCalendarEditWeek({
  allDayItems,
  activeCaregiverDate,
  caregiverHoursByDate,
  datedItems,
  deletedRoniOverridesByDate,
  onChangeCaregiverHours,
  onCreateRoniOverride,
  onDeleteRoniThisWeek,
  onMoveDatedItem,
  onRestoreRoniOverride,
  onSelectDragWeek,
  onToggleCaregiverDate,
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
  const [roniChoiceItem, setRoniChoiceItem] = useState(null);
  const editSegments = useMemo(
    () => buildEditTimedWeekSegments(selectedWeekItems.filter((item) => !item.allDay)),
    [selectedWeekItems],
  );
  const hasWeatherRows = selectedWeekDates.some((date) => {
    const summary = weatherByDate.get(date);
    const dayparts = weatherDaypartsByDate[date] || [];
    return Boolean(summary) || dayparts.some((item) => item.weatherLabel || item.temp_min_c !== "" || item.temp_max_c !== "");
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
    const weekDropElement = elements.find((element) => element instanceof HTMLElement && element.dataset.familyCalendarWeekDrop);
    if (weekDropElement) {
      const direction = weekDropElement.dataset.familyCalendarWeekDrop === "next" ? 1 : -1;
      return { type: "week", direction };
    }
    const dropElement = elements.find((element) => element instanceof HTMLElement && element.dataset.familyCalendarDrop);
    if (!dropElement) return null;
    const dayIndex = Number(dropElement.dataset.dayIndex);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return null;
    const date = formatFamilyDateKey(addFamilyDays(selectedWeekStart, dayIndex));
    if (dropElement.dataset.familyCalendarDrop === "allDay") {
      return { type: "allDay", dayIndex, date };
    }
    if (dropElement.dataset.familyCalendarDrop === "date") {
      return { type: "date", dayIndex, date };
    }
    const rowStartMinutes = Number(dropElement.dataset.slotStartMinutes);
    const startMinutes = Number.isFinite(rowStartMinutes)
      ? slotTimeFromRowPoint(clientY, dropElement.getBoundingClientRect(), rowStartMinutes)
      : slotTimeFromPoint(clientY, dropElement.getBoundingClientRect());
    return { type: "time", dayIndex, date, startMinutes };
  }

  function itemBaseDragTarget(item) {
    const parsedDate = parseFamilyDateKey(item.date);
    const dayIndex = Number.isInteger(item.dayIndex)
      ? item.dayIndex
      : parsedDate
        ? parsedDate.getDay()
        : 0;
    const date = item.date || formatFamilyDateKey(addFamilyDays(selectedWeekStart, dayIndex));
    if (item.allDay) return { type: "allDay", dayIndex, date };
    const startMinutes = parseTimeMinutes(item.startTime) ?? FAMILY_CALENDAR_EDIT_START_HOUR * 60;
    return { type: "time", dayIndex, date, startMinutes };
  }

  function adjacentWeekTarget(item, currentTarget, direction) {
    const baseTarget = currentTarget && currentTarget.type !== "week" ? currentTarget : itemBaseDragTarget(item);
    if (item.allDay && baseTarget.type === "time") return null;
    const baseDate = parseFamilyDateKey(baseTarget.date) || addFamilyDays(selectedWeekStart, baseTarget.dayIndex || 0);
    const nextDate = addFamilyDays(baseDate, direction * 7);
    const date = formatFamilyDateKey(nextDate);
    const weekStart = getFamilyWeekStart(nextDate);
    return {
      ...baseTarget,
      type: item.allDay ? "allDay" : baseTarget.type,
      date,
      weekKey: formatFamilyDateKey(weekStart),
      weekOffset: direction,
    };
  }

  function dragTargetForItem(item, target) {
    if (!target) return null;
    if (target.type === "week") return adjacentWeekTarget(item, dragState?.target, target.direction);
    if (target.type === "allDay" && !item.allDay) return null;
    if (item.allDay) {
      if (target.type === "time") return null;
      return { type: "allDay", dayIndex: target.dayIndex, date: target.date };
    }
    return target;
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
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const sourceItem = item.type === "dated" ? datedItems.find((candidate) => candidate.id === item.id) || item : item;
    dragStartRef.current = {
      dragElement: event.currentTarget,
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
    const target = dragTargetForItem(pending.item, findDropTarget(event.clientX, event.clientY));
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
    pending?.dragElement?.releasePointerCapture?.(event.pointerId);
    if (!pending || pending.pointerId !== event.pointerId) {
      clearPendingLongPress();
      return;
    }
    if (!currentDragState?.target) return;
    event.preventDefault();
    if (pending.itemType === "roni") {
      onCreateRoniOverride(pending.item, currentDragState.target);
      if (currentDragState.target.weekKey) onSelectDragWeek?.(currentDragState.target);
      return;
    }
    onMoveDatedItem(pending.item.id, currentDragState.target);
    if (currentDragState.target.weekKey) onSelectDragWeek?.(currentDragState.target);
  }

  function chooseThisWeekOnly() {
    if (!roniChoiceItem) return;
    onCreateRoniOverride(roniChoiceItem);
    closeRoniChoiceSheet();
  }

  function chooseDeleteThisWeek() {
    if (!roniChoiceItem) return;
    onDeleteRoniThisWeek(roniChoiceItem);
    closeRoniChoiceSheet();
  }

  function chooseRoniTemplate() {
    router.push("/family/roun");
  }

  const hasAllDayItems = allDayItems.some((items) => items.length);

  return (
    <div
      className="familyCalendarExpandedWeek familyCalendarExpandedWeekEditable familyCalendarExpandedWeekEditing"
      aria-label="수정 주간 시간표"
      onPointerCancel={finishDatedDrag}
      onPointerMove={moveDatedDrag}
      onPointerUp={finishDatedDrag}
      ref={editScrollRef}
    >
      <div className="familyCalendarEditModeBadgeRow">
        <span className="familyCalendarEditModeBadge">편집 중</span>
      </div>
      {hasWeatherRows ? (
        <FamilyCalendarWeatherRows
          expanded={weatherExpanded}
          onToggle={onToggleWeather}
          selectedWeekDates={selectedWeekDates}
          weatherByDate={weatherByDate}
          weatherDaypartsByDate={weatherDaypartsByDate}
        />
      ) : null}
      <FamilyCaregiverHoursRow
        activeDate={activeCaregiverDate}
        caregiverHoursByDate={caregiverHoursByDate}
        onChangeHours={onChangeCaregiverHours}
        onToggleDate={onToggleCaregiverDate}
        selectedWeekDates={selectedWeekDates}
      />
      {hasAllDayItems ? (
        <div className="familyCalendarTimeRow familyCalendarAllDayRow" key="all-day">
          <span className="familyCalendarTimeLabel familyCalendarAllDayLabel">•</span>
          {allDayItems.map((items, dayIndex) => (
            <div
              className={`familyCalendarDaySlot familyCalendarAllDaySlot${dragState?.target?.type === "allDay" && dragState.target.dayIndex === dayIndex ? " familyCalendarAllDaySlotDropTarget" : ""}`}
              data-day-index={dayIndex}
              data-family-calendar-drop="allDay"
              key={`all-day-${dayIndex}`}
            >
              {items.map((item) => (
                <CalendarItemLink
                  className="familyCalendarAllDayItem familyCalendarAllDayItemEditable"
                  dragging={dragState?.itemId === item.id}
                  item={item}
                  key={`${item.type}-${item.id}`}
                  onStartDatedDrag={startDatedDrag}
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {editSegments.map((segment) => (
        <FamilyCalendarTimedArea
          clearPendingLongPress={clearPendingLongPress}
          deletedRoniOverridesByDate={deletedRoniOverridesByDate}
          dragState={dragState}
          editable
          key={`${segment.startMinutes}-${segment.endMinutes}`}
          moveSlotLongPress={moveSlotLongPress}
          onCancelRoniChoice={clearRoniChoiceTimer}
          onRestoreRoniOverride={onRestoreRoniOverride}
          onStartDatedDrag={startDatedDrag}
          onStartRoniChoice={startRoniChoice}
          onStartRoniDrag={startRoniDrag}
          pendingSlotKey={pendingSlotKey}
          roniChoiceItemId={roniChoiceItem?.id || ""}
          segment={segment}
          selectedWeekStart={selectedWeekStart}
          startSlotLongPress={startSlotLongPress}
        />
      ))}
      {dragState ? (
        <span className="familyCalendarDragGhost" style={{ left: `${dragState.x}px`, top: `${dragState.y}px` }}>
          {dragState.title}
        </span>
      ) : null}
      {dragState ? (
        <>
          <span
            className={`familyCalendarWeekDragTarget familyCalendarWeekDragTargetPrev${dragState.target?.weekOffset === -1 ? " familyCalendarWeekDragTargetActive" : ""}`}
            data-family-calendar-week-drop="previous"
          >
            지난주
          </span>
          <span
            className={`familyCalendarWeekDragTarget familyCalendarWeekDragTargetNext${dragState.target?.weekOffset === 1 ? " familyCalendarWeekDragTargetActive" : ""}`}
            data-family-calendar-week-drop="next"
          >
            다음주
          </span>
        </>
      ) : null}
      {dragState?.target?.type === "time" || dragState?.target?.type === "allDay" ? (
        <span
          className="familyCalendarDragReadout"
          style={{ left: `${dragState.x}px`, top: `${dragState.y - 64}px` }}
        >
          {formatDragTargetLabel(dragState.target)}
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
  const router = useRouter();
  const dateLongPressTimerRef = useRef(null);
  const dateLongPressStartRef = useRef(null);
  const suppressDateClickRef = useRef("");
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
  const [caregiverHoursByDate, setCaregiverHoursByDate] = useState({});
  const [activeCaregiverDate, setActiveCaregiverDate] = useState("");
  const [pressedDateKey, setPressedDateKey] = useState("");

  useEffect(() => {
    setDatedItems(loadFamilyCalendarItems());
    setRounState(loadFamilyRounState());
    setRoniOverrides(loadFamilyRoniOverrides());
    setCaregiverHoursByDate(loadFamilyCaregiverHours());
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
  const selectedWeekDailyWeatherItems = useMemo(
    () => selectedWeekDates.map((date) => weatherByDate.get(date) || null),
    [selectedWeekDates, weatherByDate],
  );
  const selectedWeekDaypartWeatherItems = useMemo(
    () => selectedWeekDates.map((date) => ({ date, items: selectedWeekWeatherDayparts[date] || [] })),
    [selectedWeekDates, selectedWeekWeatherDayparts],
  );
  const caregiverReviewHref = `/family/calendar/caregiver?month=${monthDate.getFullYear()}-${padFamilyDatePart(monthDate.getMonth() + 1)}`;
  const selectedWeekWeatherByDate = useMemo(
    () => Object.fromEntries(selectedWeekDates.map((date) => [date, weatherByDate.get(date) || null])),
    [selectedWeekDates, weatherByDate],
  );
  const selectedWeekWeatherDaypartsByDate = useMemo(
    () => Object.fromEntries(selectedWeekDates.map((date) => [date, selectedWeekWeatherDayparts[date] || []])),
    [selectedWeekDates, selectedWeekWeatherDayparts],
  );
  const deletedRoniOverridesByDate = useMemo(() => groupDeletedRoniOverridesByDate(roniOverrides), [roniOverrides]);
  const selectedWeekItems = useMemo(
    () => buildSelectedWeekItems(selectedWeekStart, datedItems, rounState, roniOverrides),
    [selectedWeekStart, datedItems, rounState, roniOverrides],
  );
  const selectedWeekAllDayItems = useMemo(() => groupAllDayItems(selectedWeekItems), [selectedWeekItems]);
  const selectedWeekTimedSegments = useMemo(
    () => buildTimedWeekSegments(selectedWeekItems.filter((item) => !item.allDay)),
    [selectedWeekItems],
  );
  const hasSelectedWeekWeatherRows = useMemo(
    () => selectedWeekDates.some((date) => {
      const summary = weatherByDate.get(date);
      const dayparts = selectedWeekWeatherDayparts[date] || [];
      return Boolean(summary) || dayparts.some((item) => item.weatherLabel || item.temp_min_c !== "" || item.temp_max_c !== "");
    }),
    [selectedWeekDates, selectedWeekWeatherDayparts, weatherByDate],
  );

  useEffect(() => {
    setWeatherExpanded(false);
    setActiveCaregiverDate("");
  }, [selectedWeekKey, calendarMode, monthDate]);

  useEffect(() => {
    return () => {
      if (dateLongPressTimerRef.current) window.clearTimeout(dateLongPressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!editingCalendar) return;
    console.log("Family daily weather", weatherItems);
    console.log("Family selected week weatherByDate", selectedWeekWeatherByDate);
    console.log("Family selected week dayparts", selectedWeekWeatherDayparts);
  }, [editingCalendar, selectedWeekWeatherByDate, selectedWeekWeatherDayparts, weatherItems]);

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
        setWeatherItems(normalizeFamilyWeatherDailyItems(Array.isArray(data.items) ? data.items : []));
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

  function clearDateLongPress() {
    if (dateLongPressTimerRef.current) window.clearTimeout(dateLongPressTimerRef.current);
    dateLongPressTimerRef.current = null;
    dateLongPressStartRef.current = null;
    setPressedDateKey("");
  }

  function startDateLongPress(event, dateKey) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    clearDateLongPress();
    dateLongPressStartRef.current = {
      dateKey,
      x: touch.clientX,
      y: touch.clientY,
    };
    setPressedDateKey(dateKey);
    dateLongPressTimerRef.current = window.setTimeout(() => {
      suppressDateClickRef.current = dateKey;
      dateLongPressTimerRef.current = null;
      dateLongPressStartRef.current = null;
      setPressedDateKey("");
      router.push(`/family/calendar/events/new?date=${dateKey}`);
    }, FAMILY_CALENDAR_LONG_PRESS_MS);
  }

  function moveDateLongPress(event) {
    const pending = dateLongPressStartRef.current;
    if (!pending || event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (
      Math.abs(touch.clientX - pending.x) > FAMILY_CALENDAR_LONG_PRESS_MOVE_LIMIT ||
      Math.abs(touch.clientY - pending.y) > FAMILY_CALENDAR_LONG_PRESS_MOVE_LIMIT
    ) {
      clearDateLongPress();
    }
  }

  function endDateLongPress() {
    clearDateLongPress();
  }

  function clickDateCell(event, weekKey, dateKey) {
    if (suppressDateClickRef.current === dateKey) {
      suppressDateClickRef.current = "";
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    selectWeek(weekKey);
  }

  function toggleWeekSelection(weekKey) {
    setSelectedWeekKey((current) => (current === weekKey ? "" : weekKey));
  }

  function moveDatedItem(itemId, target) {
    setDatedItems((current) => {
      const nextItems = current.map((item) => {
        if (item.id !== itemId) return item;
        const moved = movedItemValues(item, target);
        if (moved.allDay) {
          const nextItem = {
            ...item,
            allDay: true,
            date: moved.date,
          };
          delete nextItem.startTime;
          delete nextItem.endTime;
          return nextItem;
        }
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
        overrideType: values.deleted === true ? "deleted" : "moved",
      };
      const nextOverrides = current
        .filter((override) => override.id !== roniItem.overrideId)
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

  function selectDragWeek(target) {
    const targetDate = parseFamilyDateKey(target?.date);
    if (!targetDate) return;
    setMonthDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 12, 0, 0, 0));
    setSelectedWeekKey(formatFamilyDateKey(getFamilyWeekStart(targetDate)));
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

  function changeCaregiverHours(date, value) {
    setCaregiverHoursByDate((current) => {
      const nextHours = { ...current };
      const normalized = normalizeFamilyCaregiverDayRecord(value);
      if (!normalized.sessions.length && !normalized.extras.length && !normalized.legacyHours) {
        delete nextHours[date];
      } else {
        nextHours[date] = {
          sessions: normalized.sessions,
          extras: normalized.extras,
        };
      }
      saveFamilyCaregiverHours(nextHours);
      return nextHours;
    });
    setActiveCaregiverDate("");
  }

  const hasSelectedWeekAllDayItems = selectedWeekAllDayItems.some((items) => items.length);
  const hasSelectedWeekContent = hasSelectedWeekAllDayItems || selectedWeekTimedSegments.length;

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
      {editingCalendar ? (
        <FamilyCalendarWeatherDebugPanel
          debugData={{
            selectedWeekDailyWeatherItems,
            selectedWeekDaypartWeatherItems,
            weatherByDate: selectedWeekWeatherByDate,
            weatherDaypartsByDate: selectedWeekWeatherDaypartsByDate,
          }}
        />
      ) : null}

      <div className="familyCalendarGrid" aria-label="달력 월간 보기">
        <section className="familyCalendarWeek familyCalendarWeekHeaderRow" aria-label="달력 요일">
          <div className="familyCalendarWeekDates familyCalendarWeekHeader">
            <Link className="familyCalendarCaregiverReviewGutter" href={caregiverReviewHref}>
              ♥
            </Link>
            {FAMILY_CALENDAR_DAY_LABELS.map((label) => (
              <span className="familyCalendarWeekDay familyCalendarWeekHeaderDay" key={label}>{label}</span>
            ))}
          </div>
        </section>

        {weeks.map((week) => {
          const selected = Boolean(selectedWeekKey) && week.key === selectedWeekKey;
          const weekClassName = [
            "familyCalendarWeek",
            selected ? "familyCalendarWeekSelected" : "",
            selected && editingCalendar ? "familyCalendarWeekEditingSelected" : "",
          ].filter(Boolean).join(" ");
          return (
            <section className={weekClassName} key={week.key}>
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
                      className={`familyCalendarWeekDay familyCalendarWeekDateButton${day.inMonth ? "" : " familyCalendarDateOutside"}${selected ? "" : " familyCalendarWeekDateButtonCollapsed"}${pressedDateKey === day.dateKey ? " familyCalendarWeekDateButtonPressed" : ""}`}
                      data-day-index={selected && editingCalendar ? dayIndex : undefined}
                      data-family-calendar-drop={selected && editingCalendar ? "date" : undefined}
                      key={day.dateKey}
                      type="button"
                      onClick={(event) => clickDateCell(event, week.key, day.dateKey)}
                      onTouchCancel={endDateLongPress}
                      onTouchEnd={endDateLongPress}
                      onTouchMove={moveDateLongPress}
                      onTouchStart={(event) => startDateLongPress(event, day.dateKey)}
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
                  activeCaregiverDate={activeCaregiverDate}
                  caregiverHoursByDate={caregiverHoursByDate}
                  datedItems={datedItems}
                  deletedRoniOverridesByDate={deletedRoniOverridesByDate}
                  onChangeCaregiverHours={changeCaregiverHours}
                  onCreateRoniOverride={createRoniOverride}
                  onDeleteRoniThisWeek={deleteRoniThisWeek}
                  onMoveDatedItem={moveDatedItem}
                  onRestoreRoniOverride={restoreRoniOverride}
                  onSelectDragWeek={selectDragWeek}
                  onToggleCaregiverDate={setActiveCaregiverDate}
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
                  <FamilyCaregiverHoursRow
                    activeDate={activeCaregiverDate}
                    caregiverHoursByDate={caregiverHoursByDate}
                    onChangeHours={changeCaregiverHours}
                    onToggleDate={setActiveCaregiverDate}
                    selectedWeekDates={selectedWeekDates}
                  />
                  {hasSelectedWeekContent ? (
                    <>
                      {hasSelectedWeekAllDayItems ? (
                        <div className="familyCalendarTimeRow familyCalendarAllDayRow">
                          <span className="familyCalendarTimeLabel familyCalendarAllDayLabel">•</span>
                          {selectedWeekAllDayItems.map((items, dayIndex) => (
                            <div className="familyCalendarDaySlot familyCalendarAllDaySlot" key={`all-day-${dayIndex}`}>
                              {items.map((item) => (
                                <CalendarItemLink className="familyCalendarAllDayItem" item={item} key={`${item.type}-${item.id}`} />
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {selectedWeekTimedSegments.map((segment) => (
                        <FamilyCalendarTimedArea
                          key={`${segment.startMinutes}-${segment.endMinutes}`}
                          segment={segment}
                          selectedWeekStart={selectedWeekStart}
                        />
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
