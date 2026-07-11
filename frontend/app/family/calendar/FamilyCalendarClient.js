"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  DEFAULT_WEATHER_LOCATION,
  fetchSharedWeather,
  getStoredWeatherLocation,
  listenWeatherLocationChange,
  normalizeFamilyWeatherDailyItems,
  normalizeFamilyWeatherDayparts,
  sharedWeatherDailyFromPayload,
  sharedWeatherDaypartsFromPayload,
} from "../../lib/weather-client";
import FamilyCalendarWeatherRows from "./FamilyCalendarWeatherRows";
import FamilyCalendarWeatherDebugPanel from "./FamilyCalendarWeatherDebugPanel";
import {
  FAMILY_SCHEDULE_DRAG_MOVE_LIMIT,
  beginFamilyScheduleDragSelectionLock,
  endFamilyScheduleDragSelectionLock,
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
  fetchFamilyCaregiverHours,
  fetchFamilyCalendarItems,
  fetchFamilyRounState,
  fetchFamilyRounyOverrides,
  getDefaultSelectedWeekKeyForMonth,
  getFamilyMonthWeeks,
  getFamilyWeekStart,
  minutesToFamilyCaregiverTime,
  normalizeFamilyCaregiverDayRecord,
  normalizeFamilyCaregiverExtras,
  normalizeFamilyCaregiverSessions,
  parseFamilyCaregiverTime,
  parseFamilyDateKey,
  padFamilyDatePart,
  resolveFamilyRounPlanForDate,
  persistFamilyCaregiverHours,
  persistFamilyCalendarItems,
  persistFamilyRounyOverrides,
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

function isRounyCalendarItem(item) {
  return item?.type === "rouny" || item?.type === "roni";
}

function normalizedCalendarItemType(item) {
  return isRounyCalendarItem(item) ? "rouny" : item?.type;
}

function formatTimedCalendarItemTitle(item, itemType) {
  const title = itemType === "rouny" && item.overridden ? `!${item.title}` : item.title;
  if (item.allDay || !item.startTime) return title;
  return `${item.startTime} ${title}`;
}

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

function rounySourceKeys(item) {
  return [item.sourceRounyId, item.sourceId].filter(Boolean);
}

function rounyOverrideKey(sourceRounyId, date) {
  return `${sourceRounyId}|${date}`;
}

function groupDeletedRounyOverridesByDate(overrides) {
  return overrides
    .filter((override) => override.deleted)
    .reduce((grouped, override) => {
      if (!grouped[override.date]) grouped[override.date] = [];
      grouped[override.date].push(override);
      return grouped;
    }, {});
}

function applyRounyOverrideToItem(item, override, weekDates) {
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

function applyRounyOverrides(generatedRounyItems, rounyOverrides, weekDates) {
  const weekOverrides = rounyOverrides.filter((override) => weekDates.includes(override.date));
  const overrideByRounyDate = new Map(
    weekOverrides.map((override) => [rounyOverrideKey(override.sourceRounyId, override.date), override]),
  );
  const overriddenSources = new Set(weekOverrides.map((override) => override.sourceRounyId));
  const appliedOverrideKeys = new Set();

  const baseItems = generatedRounyItems.flatMap((item) => {
    const sourceKeys = rounySourceKeys(item);
    const exactOverride = sourceKeys
      .map((sourceKey) => overrideByRounyDate.get(rounyOverrideKey(sourceKey, item.date)))
      .find(Boolean);
    if (exactOverride) {
      appliedOverrideKeys.add(rounyOverrideKey(exactOverride.sourceRounyId, exactOverride.date));
      if (exactOverride.deleted) return [];
      const overriddenItem = applyRounyOverrideToItem(item, exactOverride, weekDates);
      return overriddenItem ? [overriddenItem] : [];
    }
    if (sourceKeys.some((sourceKey) => overriddenSources.has(sourceKey))) return [];
    return [item];
  });

  const movedOverrideItems = weekOverrides.flatMap((override) => {
    const overrideKey = rounyOverrideKey(override.sourceRounyId, override.date);
    if (appliedOverrideKeys.has(overrideKey) || override.deleted) return [];
    const sourceItem = generatedRounyItems.find((item) => rounySourceKeys(item).includes(override.sourceRounyId));
    if (!sourceItem) return [];
    const overriddenItem = applyRounyOverrideToItem(sourceItem, override, weekDates);
    return overriddenItem ? [overriddenItem] : [];
  });

  return [...baseItems, ...movedOverrideItems];
}

function buildSelectedWeekItems(selectedWeekStart, datedItems, rounState, rounyOverrides) {
  const weekDates = FAMILY_CALENDAR_DAY_LABELS.map((_, dayIndex) => formatFamilyDateKey(addFamilyDays(selectedWeekStart, dayIndex)));
  const weekDatedItems = datedItems
    .filter((item) => weekDates.includes(item.date) && (item.allDay || item.startTime))
    .map((item) => ({ ...item, type: "dated", dayIndex: weekDates.indexOf(item.date) }));

  const weekGeneratedRounyItems = weekDates.flatMap((date, dayIndex) => {
    const plan = resolveFamilyRounPlanForDate(date, rounState);
    return (plan?.items || []).flatMap((item) =>
      (item.slots || [item]).flatMap((slot, slotIndex) => {
        if (slot.dayOfWeek !== dayIndex) return [];
        return [{
          ...item,
          id: `${plan.id}-${item.id}-${slotIndex}-${date}`,
          planId: plan.id,
          sourceId: item.id,
          sourceRounyId: `${plan.id}:${item.id}:${slotIndex}`,
          sourceSlotIndex: slotIndex,
          date,
          dayIndex,
          startTime: slot.startTime,
          endTime: slot.endTime,
          type: "rouny",
        }];
      }),
    );
  });
  const weekRounyItems = applyRounyOverrides(weekGeneratedRounyItems, rounyOverrides, weekDates);

  return [...weekRounyItems, ...weekDatedItems]
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
  onCancelRounyChoice = null,
  onStartDatedDrag = null,
  onStartRounyChoice = null,
  onStartRounyDrag = null,
  rounyChoiceItemId = "",
  style = undefined,
}) {
  const itemType = normalizedCalendarItemType(item);
  const href = itemType === "rouny" ? "/family/roun" : `/family/calendar/events/${item.id}/edit`;
  const editItem = className.includes("familyCalendarEditItem");
  const allDayEditItem = className.includes("familyCalendarAllDayItemEditable");
  const dragEnabledItem = editItem || allDayEditItem;
  const editableDatedItem = dragEnabledItem && itemType === "dated";
  const editableRounyItem = dragEnabledItem && itemType === "rouny";
  const suppressRounyNavigation = editableRounyItem && rounyChoiceItemId === item.id;
  const cancelRounyChoice = editableRounyItem && onCancelRounyChoice ? onCancelRounyChoice : undefined;
  const displayTitle = formatTimedCalendarItemTitle(item, itemType);
  return (
    <Link
      className={`familyCalendarItem familyCalendarItem${itemType === "rouny" ? "Rouny" : "Dated"} familyTimetableEntry${familyCalendarColorClassName(item.color)}${className ? ` ${className}` : ""}${dragging ? " familyCalendarEditItemDragging" : ""}`}
      draggable={dragEnabledItem ? false : undefined}
      href={href}
      key={`${itemType}-${item.id}`}
      onClick={dragging || suppressRounyNavigation ? (event) => event.preventDefault() : undefined}
      onDragStart={dragEnabledItem ? (event) => event.preventDefault() : undefined}
      onPointerCancel={cancelRounyChoice}
      onPointerDown={dragEnabledItem ? (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.stopPropagation();
        if (editableDatedItem && onStartDatedDrag) onStartDatedDrag(event, item);
        if (editableRounyItem && onStartRounyDrag) onStartRounyDrag(event, item);
        if (editableRounyItem && onStartRounyChoice) onStartRounyChoice(event, item);
      } : undefined}
      onPointerLeave={cancelRounyChoice}
      onPointerUp={cancelRounyChoice}
      style={style ?? (editItem ? editItemStyle(item) : undefined)}
      title={item.allDay ? item.title : `${item.title} ${item.startTime}`}
    >
      <span>{displayTitle}</span>
      {item.overridden ? <span className="familyCalendarRounyOverrideBadge">예외</span> : null}
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
              {displayValue || "이모"}
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

function FamilyCalendarRounyWeekToggle({ expanded, onToggle }) {
  return (
    <button
      className="familyCalendarTimeRow familyCalendarRounyWeekToggleRow"
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
    >
      <span className="familyCalendarTimeLabel familyCalendarRounyWeekToggleRail">•</span>
      <span className="familyCalendarRounyWeekToggleText">이 주의 스케줄.</span>
    </button>
  );
}

function FamilyCalendarTimedArea({
  deletedRounyOverridesByDate = {},
  dragState = null,
  editable = false,
  onCancelRounyChoice = null,
  onRestoreRounyOverride = null,
  onStartDatedDrag = null,
  onStartRounyChoice = null,
  onStartRounyDrag = null,
  pendingSlotKey = "",
  rounyChoiceItemId = "",
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
              const deletedOverrides = deletedRounyOverridesByDate[date] || [];
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
                    <div className="familyCalendarRounyRestoreStack">
                      {deletedOverrides.map((override) => (
                        <button
                          className="familyCalendarRounyRestoreButton"
                          key={override.id}
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRestoreRounyOverride?.(override.id);
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
                key={`${normalizedCalendarItemType(item)}-${item.id}`}
                onCancelRounyChoice={onCancelRounyChoice}
                onStartDatedDrag={onStartDatedDrag}
                onStartRounyChoice={onStartRounyChoice}
                onStartRounyDrag={onStartRounyDrag}
                rounyChoiceItemId={rounyChoiceItemId}
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
  activeCaregiverDate,
  caregiverHoursByDate,
  datedItems,
  deletedRounyOverridesByDate,
  onChangeCaregiverHours,
  onCreateRounyOverride,
  onDeleteRounyThisWeek,
  onMoveDatedItem,
  onRestoreRounyOverride,
  onSelectDragWeek,
  onToggleRounyTimetable,
  onToggleCaregiverDate,
  onToggleWeather,
  rounyTimetableExpanded,
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
  const rounyChoiceTimerRef = useRef(null);
  const dragStartRef = useRef(null);
  const autoScrollIntervalRef = useRef(null);
  const autoScrollDirectionRef = useRef(0);
  const [pendingSlotKey, setPendingSlotKey] = useState("");
  const [dragState, setDragState] = useState(null);
  const [rounyChoiceItem, setRounyChoiceItem] = useState(null);
  const visibleAllDayItems = useMemo(() => groupAllDayItems(selectedWeekItems), [selectedWeekItems]);
  const editSegments = useMemo(
    () => (rounyTimetableExpanded ? buildEditTimedWeekSegments(selectedWeekItems.filter((item) => !item.allDay)) : []),
    [rounyTimetableExpanded, selectedWeekItems],
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

  function clearRounyChoiceTimer() {
    if (rounyChoiceTimerRef.current) window.clearTimeout(rounyChoiceTimerRef.current);
    rounyChoiceTimerRef.current = null;
  }

  function closeRounyChoiceSheet() {
    clearRounyChoiceTimer();
    setRounyChoiceItem(null);
  }

  function stopAutoScroll() {
    if (autoScrollIntervalRef.current) window.clearInterval(autoScrollIntervalRef.current);
    autoScrollIntervalRef.current = null;
    autoScrollDirectionRef.current = 0;
  }

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      if (rounyChoiceTimerRef.current) window.clearTimeout(rounyChoiceTimerRef.current);
      longPressTimerRef.current = null;
      longPressStartRef.current = null;
      rounyChoiceTimerRef.current = null;
      stopAutoScroll();
      endFamilyScheduleDragSelectionLock();
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
    const editContainer = editScrollRef.current;
    const container =
      editContainer && editContainer.scrollHeight > editContainer.clientHeight + 2
        ? editContainer
        : document.scrollingElement || document.documentElement;
    if (!container) return;
    const rect =
      container === document.scrollingElement || container === document.documentElement
        ? { top: 0, bottom: window.innerHeight }
        : container.getBoundingClientRect();
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
      const editCurrent = editScrollRef.current;
      const current =
        editCurrent && editCurrent.scrollHeight > editCurrent.clientHeight + 2
          ? editCurrent
          : document.scrollingElement || document.documentElement;
      if (!current || !autoScrollDirectionRef.current) return;
      current.scrollTop += autoScrollDirectionRef.current * FAMILY_CALENDAR_AUTO_SCROLL_STEP_PX;
    }, 40);
  }

  function startCalendarItemDrag(event, item) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.button !== undefined && event.button !== 0) return;
    clearPendingLongPress();
    clearRounyChoiceTimer();
    beginFamilyScheduleDragSelectionLock();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const itemType = normalizedCalendarItemType(item);
    const sourceItem = itemType === "dated" ? datedItems.find((candidate) => candidate.id === item.id) || item : item;
    dragStartRef.current = {
      dragElement: event.currentTarget,
      item: sourceItem,
      itemType,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setDragState(null);
  }

  function startDatedDrag(event, item) {
    startCalendarItemDrag(event, item);
  }

  function startRounyDrag(event, item) {
    startCalendarItemDrag(event, item);
  }

  function startRounyChoice(event, item) {
    if (event.button !== undefined && event.button !== 0) return;
    clearPendingLongPress();
    clearRounyChoiceTimer();
    rounyChoiceTimerRef.current = window.setTimeout(() => {
      setRounyChoiceItem(item);
      clearRounyChoiceTimer();
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
    clearRounyChoiceTimer();
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
    clearRounyChoiceTimer();
    const pending = dragStartRef.current;
    const currentDragState = dragState;
    stopAutoScroll();
    endFamilyScheduleDragSelectionLock();
    dragStartRef.current = null;
    setDragState(null);
    pending?.dragElement?.releasePointerCapture?.(event.pointerId);
    if (!pending || pending.pointerId !== event.pointerId) {
      clearPendingLongPress();
      return;
    }
    if (!currentDragState?.target) return;
    event.preventDefault();
    if (pending.itemType === "rouny") {
      onCreateRounyOverride(pending.item, currentDragState.target);
      if (currentDragState.target.weekKey) onSelectDragWeek?.(currentDragState.target);
      return;
    }
    onMoveDatedItem(pending.item.id, currentDragState.target);
    if (currentDragState.target.weekKey) onSelectDragWeek?.(currentDragState.target);
  }

  function chooseThisWeekOnly() {
    if (!rounyChoiceItem) return;
    onCreateRounyOverride(rounyChoiceItem);
    closeRounyChoiceSheet();
  }

  function chooseDeleteThisWeek() {
    if (!rounyChoiceItem) return;
    onDeleteRounyThisWeek(rounyChoiceItem);
    closeRounyChoiceSheet();
  }

  function chooseRounyTemplate() {
    router.push("/family/roun");
  }

  const hasAllDayItems = visibleAllDayItems.some((items) => items.length);

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
          {visibleAllDayItems.map((items, dayIndex) => (
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
                  key={`${normalizedCalendarItemType(item)}-${item.id}`}
                  onStartDatedDrag={startDatedDrag}
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}
      <FamilyCalendarRounyWeekToggle
        expanded={rounyTimetableExpanded}
        onToggle={onToggleRounyTimetable}
      />
      {editSegments.map((segment) => (
        <FamilyCalendarTimedArea
          clearPendingLongPress={clearPendingLongPress}
          deletedRounyOverridesByDate={deletedRounyOverridesByDate}
          dragState={dragState}
          editable
          key={`${segment.startMinutes}-${segment.endMinutes}`}
          moveSlotLongPress={moveSlotLongPress}
          onCancelRounyChoice={clearRounyChoiceTimer}
          onRestoreRounyOverride={onRestoreRounyOverride}
          onStartDatedDrag={startDatedDrag}
          onStartRounyChoice={startRounyChoice}
          onStartRounyDrag={startRounyDrag}
          pendingSlotKey={pendingSlotKey}
          rounyChoiceItemId={rounyChoiceItem?.id || ""}
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
      {rounyChoiceItem ? (
        <div className="familyCalendarRounyChoiceSheet" role="dialog" aria-label="일정 옵션">
          <p>일정 옵션</p>
          <button type="button" onClick={chooseThisWeekOnly}>이번 주만 변경</button>
          <button type="button" onClick={chooseDeleteThisWeek}>이번 주만 일정 취소</button>
          <button type="button" onClick={chooseRounyTemplate}>로운이 시간표 변경</button>
          <button type="button" onClick={closeRounyChoiceSheet}>취소</button>
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
  const [rounyOverrides, setRounyOverrides] = useState([]);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedWeekKey, setSelectedWeekKey] = useState(() => formatFamilyDateKey(getFamilyWeekStart(new Date())));
  const [calendarMode, setCalendarMode] = useState(FAMILY_CALENDAR_MODE_VIEW);
  const [weatherLocation, setWeatherLocation] = useState(DEFAULT_WEATHER_LOCATION);
  const [weatherItems, setWeatherItems] = useState([]);
  const [selectedWeekWeatherDayparts, setSelectedWeekWeatherDayparts] = useState({});
  const [weatherExpanded, setWeatherExpanded] = useState(false);
  const [rounyTimetableExpanded, setRounyTimetableExpanded] = useState(false);
  const [caregiverHoursByDate, setCaregiverHoursByDate] = useState({});
  const [activeCaregiverDate, setActiveCaregiverDate] = useState("");
  const [pressedDateKey, setPressedDateKey] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchFamilyCalendarItems(),
      fetchFamilyRounState(),
      fetchFamilyRounyOverrides(),
      fetchFamilyCaregiverHours(),
    ]).then(([loadedDatedItems, loadedRounState, loadedOverrides, loadedCaregiverHours]) => {
      if (cancelled) return;
      setDatedItems(loadedDatedItems);
      setRounState(loadedRounState);
      setRounyOverrides(loadedOverrides);
      setCaregiverHoursByDate(loadedCaregiverHours);
    });
    return () => {
      cancelled = true;
    };
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
  const deletedRounyOverridesByDate = useMemo(() => groupDeletedRounyOverridesByDate(rounyOverrides), [rounyOverrides]);
  const selectedWeekItems = useMemo(
    () => buildSelectedWeekItems(selectedWeekStart, datedItems, rounState, rounyOverrides),
    [selectedWeekStart, datedItems, rounState, rounyOverrides],
  );
  const selectedWeekAllDayItems = useMemo(() => groupAllDayItems(selectedWeekItems), [selectedWeekItems]);
  const selectedWeekTimedSegments = useMemo(
    () => (rounyTimetableExpanded ? buildTimedWeekSegments(selectedWeekItems.filter((item) => !item.allDay)) : []),
    [rounyTimetableExpanded, selectedWeekItems],
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
    setRounyTimetableExpanded(false);
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

    fetchSharedWeather()
      .then((sharedWeather) => {
        if (cancelled) return;
        const data = sharedWeatherDailyFromPayload(sharedWeather, { location: weatherLocation, startDate: weatherStart, endDate: weatherEnd });
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

    fetchSharedWeather()
      .then((sharedWeather) => {
        if (cancelled) return;
        const entries = selectedWeekDates.map((date) => {
          const payload = sharedWeatherDaypartsFromPayload(sharedWeather, { location: weatherLocation, date });
          return [date, normalizeFamilyWeatherDayparts(payload)];
        });
        setSelectedWeekWeatherDayparts(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedWeekWeatherDayparts(
            Object.fromEntries(selectedWeekDates.map((date) => [date, normalizeFamilyWeatherDayparts(null)])),
          );
        }
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
      persistFamilyCalendarItems(nextItems);
      return nextItems;
    });
  }

  function upsertRounyOverride(rounyItem, values) {
    setRounyOverrides((current) => {
      const sourceRounyId = rounyItem.sourceRounyId || rounyItem.sourceId;
      const nextOverride = {
        id: createFamilyCalendarId(),
        sourceRounyId,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        title: rounyItem.title,
        deleted: values.deleted === true,
        overrideType: values.deleted === true ? "deleted" : "moved",
      };
      const nextOverrides = current
        .filter((override) => override.id !== rounyItem.overrideId)
        .filter((override) => rounyOverrideKey(override.sourceRounyId, override.date) !== rounyOverrideKey(sourceRounyId, values.date))
        .concat(nextOverride);
      persistFamilyRounyOverrides(nextOverrides);
      return nextOverrides;
    });
  }

  function createRounyOverride(rounyItem, target = null) {
    const moved = target ? movedItemValues(rounyItem, target) : {
      date: rounyItem.date,
      startTime: rounyItem.startTime,
      endTime: rounyItem.endTime,
    };
    upsertRounyOverride(rounyItem, { ...moved, deleted: false });
  }

  function selectDragWeek(target) {
    const targetDate = parseFamilyDateKey(target?.date);
    if (!targetDate) return;
    setMonthDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 12, 0, 0, 0));
    setSelectedWeekKey(formatFamilyDateKey(getFamilyWeekStart(targetDate)));
  }

  function deleteRounyThisWeek(rounyItem) {
    upsertRounyOverride(rounyItem, {
      date: rounyItem.date,
      startTime: rounyItem.startTime,
      endTime: rounyItem.endTime,
      deleted: true,
    });
  }

  function restoreRounyOverride(overrideId) {
    setRounyOverrides((current) => {
      const nextOverrides = current.filter((override) => override.id !== overrideId);
      persistFamilyRounyOverrides(nextOverrides);
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
      persistFamilyCaregiverHours(nextHours);
      return nextHours;
    });
    setActiveCaregiverDate("");
  }

  const hasSelectedWeekAllDayItems = selectedWeekAllDayItems.some((items) => items.length);
  const hasSelectedWeekTimedItems = selectedWeekItems.some((item) => !item.allDay);
  const hasSelectedWeekContent = hasSelectedWeekAllDayItems || hasSelectedWeekTimedItems;

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
                  activeCaregiverDate={activeCaregiverDate}
                  caregiverHoursByDate={caregiverHoursByDate}
                  datedItems={datedItems}
                  deletedRounyOverridesByDate={deletedRounyOverridesByDate}
                  onChangeCaregiverHours={changeCaregiverHours}
                  onCreateRounyOverride={createRounyOverride}
                  onDeleteRounyThisWeek={deleteRounyThisWeek}
                  onMoveDatedItem={moveDatedItem}
                  onRestoreRounyOverride={restoreRounyOverride}
                  onSelectDragWeek={selectDragWeek}
                  onToggleRounyTimetable={() => setRounyTimetableExpanded((current) => !current)}
                  onToggleCaregiverDate={setActiveCaregiverDate}
                  onToggleWeather={() => setWeatherExpanded((current) => !current)}
                  rounyTimetableExpanded={rounyTimetableExpanded}
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
                  {hasSelectedWeekAllDayItems ? (
                    <div className="familyCalendarTimeRow familyCalendarAllDayRow">
                      <span className="familyCalendarTimeLabel familyCalendarAllDayLabel">•</span>
                      {selectedWeekAllDayItems.map((items, dayIndex) => (
                        <div className="familyCalendarDaySlot familyCalendarAllDaySlot" key={`all-day-${dayIndex}`}>
                          {items.map((item) => (
                            <CalendarItemLink className="familyCalendarAllDayItem" item={item} key={`${normalizedCalendarItemType(item)}-${item.id}`} />
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <FamilyCalendarRounyWeekToggle
                    expanded={rounyTimetableExpanded}
                    onToggle={() => setRounyTimetableExpanded((current) => !current)}
                  />
                  {selectedWeekTimedSegments.length ? (
                    selectedWeekTimedSegments.map((segment) => (
                      <FamilyCalendarTimedArea
                        key={`${segment.startMinutes}-${segment.endMinutes}`}
                        segment={segment}
                        selectedWeekStart={selectedWeekStart}
                      />
                    ))
                  ) : hasSelectedWeekContent ? null : (
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
