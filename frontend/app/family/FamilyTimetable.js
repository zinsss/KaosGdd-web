"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export const FAMILY_TIMETABLE_STORAGE_KEY = "kaosgdd.family.defaultTimetable.v1";
export const TIMETABLE_START_HOUR = 8;
export const TIMETABLE_END_HOUR = 22;
export const TIMETABLE_SLOT_MINUTES = 10;
export const DEFAULT_TIMETABLE_DURATION_MINUTES = 40;
export const TIMETABLE_SLOT_PIXEL_HEIGHT = 10;
export const FAMILY_TIMETABLE_COLORS = [
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
];

const FAMILY_TIMETABLE_COLOR_LABELS = {
  pink: "분홍",
  rose: "장미",
  peach: "복숭아",
  yellow: "노랑",
  mint: "민트",
  green: "초록",
  sky: "하늘",
  blue: "파랑",
  lavender: "라벤더",
  purple: "보라",
  cream: "크림",
  gray: "회색",
};

const DAY_LABELS = [
  { dayOfWeek: 7, label: "일", optionLabel: "일요일" },
  { dayOfWeek: 1, label: "월", optionLabel: "월요일" },
  { dayOfWeek: 2, label: "화", optionLabel: "화요일" },
  { dayOfWeek: 3, label: "수", optionLabel: "수요일" },
  { dayOfWeek: 4, label: "목", optionLabel: "목요일" },
  { dayOfWeek: 5, label: "금", optionLabel: "금요일" },
  { dayOfWeek: 6, label: "토", optionLabel: "토요일" },
];

function weekendClassSuffix(dayOfWeek) {
  if (dayOfWeek === 7) return "Sunday";
  if (dayOfWeek === 6) return "Saturday";
  return "";
}

function dayClassName(baseClassName, dayOfWeek) {
  const suffix = weekendClassSuffix(dayOfWeek);
  return suffix ? `${baseClassName} ${baseClassName}${suffix}` : baseClassName;
}

const TIMETABLE_HOURS = Array.from(
  { length: TIMETABLE_END_HOUR - TIMETABLE_START_HOUR + 1 },
  (_, index) => TIMETABLE_START_HOUR + index,
);
const TIMETABLE_VISIBLE_HOURS = TIMETABLE_HOURS.slice(0, -1);
const TIMETABLE_TOTAL_MINUTES = (TIMETABLE_END_HOUR - TIMETABLE_START_HOUR) * 60;
const TIMETABLE_TOTAL_SLOTS = TIMETABLE_TOTAL_MINUTES / TIMETABLE_SLOT_MINUTES;
const TIMETABLE_BODY_HEIGHT = TIMETABLE_TOTAL_SLOTS * TIMETABLE_SLOT_PIXEL_HEIGHT;

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function padTimePart(value) {
  return String(value).padStart(2, "0");
}

function normalizeTimetableColor(color, fallback = "pink") {
  return FAMILY_TIMETABLE_COLORS.includes(color) ? color : fallback;
}

function colorClassName(color) {
  const normalizedColor = normalizeTimetableColor(color);
  return `${normalizedColor[0].toUpperCase()}${normalizedColor.slice(1)}`;
}

function getUsedScheduleColors(entries, editingEntryId = null) {
  return new Set(
    entries
      .filter((entry) => entry.active !== false && entry.id !== editingEntryId)
      .map((entry) => normalizeTimetableColor(entry.color)),
  );
}

function getFirstAvailableColor(usedColors, preferredColor = "pink") {
  const preferred = normalizeTimetableColor(preferredColor);
  if (!usedColors.has(preferred)) return preferred;
  return FAMILY_TIMETABLE_COLORS.find((color) => !usedColors.has(color)) || preferred;
}

function hasAvailableColor(usedColors) {
  return FAMILY_TIMETABLE_COLORS.some((color) => !usedColors.has(color));
}

function parseTimeString(timeString) {
  const match = String(timeString || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function timeToMinutes(timeString) {
  const minutes = parseTimeString(timeString);
  return minutes === null ? TIMETABLE_START_HOUR * 60 : minutes;
}

export function minutesToTime(totalMinutes) {
  const minutes = Math.max(0, Math.min(24 * 60 - 1, Number(totalMinutes) || 0));
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${padTimePart(hour)}:${padTimePart(minute)}`;
}

export function snapMinutes(totalMinutes) {
  return Math.round(totalMinutes / TIMETABLE_SLOT_MINUTES) * TIMETABLE_SLOT_MINUTES;
}

function clampTimetableMinutes(totalMinutes) {
  return Math.max(TIMETABLE_START_HOUR * 60, Math.min(TIMETABLE_END_HOUR * 60, snapMinutes(totalMinutes)));
}

function getTodayDayOfWeek() {
  const today = new Date().getDay();
  return today === 0 ? 7 : today;
}

function getDefaultStartMinutes() {
  const fallback = 9 * 60;
  const now = new Date();
  const rawMinutes = now.getHours() * 60 + now.getMinutes() + TIMETABLE_SLOT_MINUTES;
  const snappedMinutes = Math.ceil(rawMinutes / TIMETABLE_SLOT_MINUTES) * TIMETABLE_SLOT_MINUTES;
  const earliest = TIMETABLE_START_HOUR * 60;
  const latest = TIMETABLE_END_HOUR * 60 - DEFAULT_TIMETABLE_DURATION_MINUTES;

  if (snappedMinutes < earliest || snappedMinutes > latest) return fallback;
  return snappedMinutes;
}

function isValidDayOfWeek(dayOfWeek) {
  const value = Number(dayOfWeek);
  return Number.isInteger(value) && value >= 1 && value <= 7;
}

function normalizeDayOfWeek(dayOfWeek) {
  const value = Number(dayOfWeek);
  return isValidDayOfWeek(value) ? value : 1;
}

function normalizeTimetableSlot(slot) {
  const dayOfWeek = normalizeDayOfWeek(slot?.dayOfWeek);
  const start = clampTimetableMinutes(timeToMinutes(slot?.startTime));
  const rawEnd = clampTimetableMinutes(timeToMinutes(slot?.endTime));
  const end = Math.min(TIMETABLE_END_HOUR * 60, Math.max(start + TIMETABLE_SLOT_MINUTES, rawEnd));

  return {
    dayOfWeek,
    startTime: minutesToTime(start),
    endTime: minutesToTime(end),
  };
}

function createDefaultSlot({ dayOfWeek, startMinutes }) {
  const start = clampTimetableMinutes(startMinutes);
  const end = Math.min(TIMETABLE_END_HOUR * 60, start + DEFAULT_TIMETABLE_DURATION_MINUTES);

  return {
    dayOfWeek,
    startTime: minutesToTime(start),
    endTime: minutesToTime(end),
  };
}

function parseEditorSlot(slot) {
  if (!isValidDayOfWeek(slot?.dayOfWeek)) {
    return { error: "요일을 확인해주세요." };
  }

  const startRaw = parseTimeString(slot?.startTime);
  const endRaw = parseTimeString(slot?.endTime);
  if (startRaw === null || endRaw === null) {
    return { error: "시간을 확인해주세요." };
  }

  const start = snapMinutes(startRaw);
  const end = snapMinutes(endRaw);
  const earliest = TIMETABLE_START_HOUR * 60;
  const latest = TIMETABLE_END_HOUR * 60;
  if (start < earliest || start >= latest || end <= start || end > latest) {
    return { error: "시간을 확인해주세요." };
  }

  return {
    slot: {
      dayOfWeek: Number(slot.dayOfWeek),
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
    },
  };
}

function slotsFromEntry(entry) {
  const rawSlots = Array.isArray(entry?.slots) && entry.slots.length > 0
    ? entry.slots
    : [
        {
          dayOfWeek: entry?.dayOfWeek,
          startTime: entry?.startTime,
          endTime: entry?.endTime,
        },
      ];

  return rawSlots.map(normalizeTimetableSlot).filter((slot) => slot.dayOfWeek >= 1 && slot.dayOfWeek <= 7);
}

export function createDefaultTimetableEntry({ dayOfWeek, startMinutes, title = "" }) {
  const now = new Date().toISOString();
  const slot = createDefaultSlot({ dayOfWeek, startMinutes });

  return {
    id: createId(),
    title: title.trim() || "새 일정",
    slots: [slot],
    dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    memo: "",
    color: "pink",
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeTimetableEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const slots = slotsFromEntry(entry);
  if (slots.length === 0) return null;
  const firstSlot = slots[0];

  return {
    id: String(entry.id || createId()),
    title: String(entry.title || "새 일정"),
    slots,
    dayOfWeek: firstSlot.dayOfWeek,
    startTime: firstSlot.startTime,
    endTime: firstSlot.endTime,
    memo: String(entry.memo || ""),
    color: normalizeTimetableColor(entry.color),
    active: entry.active !== false,
    createdAt: String(entry.createdAt || new Date().toISOString()),
    updatedAt: String(entry.updatedAt || entry.createdAt || new Date().toISOString()),
  };
}

function loadTimetableEntries() {
  try {
    const raw = window.localStorage.getItem(FAMILY_TIMETABLE_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTimetableEntry).filter(Boolean);
  } catch {
    return [];
  }
}

function saveTimetableEntries(entries) {
  try {
    window.localStorage.setItem(FAMILY_TIMETABLE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    return;
  }
}

function sortTimetableEntries(entries) {
  return [...entries].sort((a, b) => {
    const firstSlotA = a.slots[0];
    const firstSlotB = b.slots[0];
    if (firstSlotA.dayOfWeek !== firstSlotB.dayOfWeek) return firstSlotA.dayOfWeek - firstSlotB.dayOfWeek;
    return timeToMinutes(firstSlotA.startTime) - timeToMinutes(firstSlotB.startTime);
  });
}

function sortTimetableBlocks(blocks) {
  return [...blocks].sort((a, b) => timeToMinutes(a.slot.startTime) - timeToMinutes(b.slot.startTime));
}

function getEntryStyle(slot) {
  const start = timeToMinutes(slot.startTime);
  const end = Math.max(start + TIMETABLE_SLOT_MINUTES, timeToMinutes(slot.endTime));
  const offset = Math.max(0, start - TIMETABLE_START_HOUR * 60);
  const duration = Math.max(TIMETABLE_SLOT_MINUTES, end - start);

  return {
    top: `${(offset / TIMETABLE_SLOT_MINUTES) * TIMETABLE_SLOT_PIXEL_HEIGHT}px`,
    height: `${(duration / TIMETABLE_SLOT_MINUTES) * TIMETABLE_SLOT_PIXEL_HEIGHT}px`,
  };
}

function entryToEditor(entry) {
  return {
    id: entry.id,
    title: entry.title,
    slots: entry.slots.map((slot) => ({
      dayOfWeek: String(slot.dayOfWeek),
      startTime: slot.startTime,
      endTime: slot.endTime,
    })),
    memo: entry.memo || "",
    color: normalizeTimetableColor(entry.color),
    active: entry.active !== false,
  };
}

function createNewScheduleDraft(color = "pink") {
  const start = getDefaultStartMinutes();
  const slot = createDefaultSlot({ dayOfWeek: getTodayDayOfWeek(), startMinutes: start });

  return {
    id: "",
    title: "",
    dayOfWeek: String(getTodayDayOfWeek()),
    startTime: slot.startTime,
    endTime: slot.endTime,
    slots: [
      {
        dayOfWeek: String(slot.dayOfWeek),
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    ],
    memo: "",
    color: normalizeTimetableColor(color),
    active: true,
    isNew: true,
  };
}

function entryToNewDraft(entry, usedColors = new Set()) {
  const slots = entry.slots.map((slot) => ({
    dayOfWeek: String(slot.dayOfWeek),
    startTime: slot.startTime,
    endTime: slot.endTime,
  }));
  const firstSlot = slots[0];

  return {
    id: "",
    title: entry.title,
    dayOfWeek: firstSlot.dayOfWeek,
    startTime: firstSlot.startTime,
    endTime: firstSlot.endTime,
    slots,
    memo: entry.memo || "",
    color: getFirstAvailableColor(usedColors, entry.color),
    active: entry.active !== false,
    isNew: true,
  };
}

function normalizeEditorSlots(slots) {
  const normalizedSlots = [];
  for (const slot of Array.isArray(slots) ? slots : []) {
    const parsed = parseEditorSlot(slot);
    if (parsed.error) return { error: parsed.error, slots: [] };
    normalizedSlots.push(parsed.slot);
  }

  if (normalizedSlots.length === 0) {
    return { error: "시간을 하나 이상 추가해주세요.", slots: [] };
  }

  return { error: "", slots: normalizedSlots };
}

export default function FamilyTimetable() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editorDraft, setEditorDraft] = useState(null);
  const [editorError, setEditorError] = useState("");
  const [colorNotice, setColorNotice] = useState("");
  const titleInputRef = useRef(null);

  useEffect(() => {
    setEntries(loadTimetableEntries());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveTimetableEntries(entries);
  }, [entries, loaded]);

  const visibleEntries = useMemo(
    () => sortTimetableEntries(entries.filter((entry) => entry.active !== false)),
    [entries],
  );

  const usedEditorColors = useMemo(
    () => getUsedScheduleColors(entries, editorDraft?.isNew ? null : editingEntryId),
    [entries, editorDraft?.isNew, editingEntryId],
  );

  const visibleBlocksByDay = useMemo(() => {
    return DAY_LABELS.reduce((days, day) => {
      days[day.dayOfWeek] = sortTimetableBlocks(
        visibleEntries.flatMap((entry) =>
          entry.slots
            .map((slot, slotIndex) => ({ entry, slot, slotIndex }))
            .filter((block) => block.slot.dayOfWeek === day.dayOfWeek),
        ),
      );
      return days;
    }, {});
  }, [visibleEntries]);

  function colorIsUnavailable(color) {
    if (!editorDraft) return false;
    return usedEditorColors.has(color) && editorDraft.color !== color && hasAvailableColor(usedEditorColors);
  }

  function startNewEntry() {
    const usedColors = getUsedScheduleColors(entries);
    setEditingEntryId(null);
    setEditorDraft(createNewScheduleDraft(getFirstAvailableColor(usedColors, "pink")));
    setEditorError("");
    setColorNotice(usedColors.size > 0 ? "이미 사용 중인 색상은 선택할 수 없어요." : "");
    requestAnimationFrame(() => titleInputRef.current?.focus());
  }

  function copyEntryToNewDraft(entry) {
    const usedColors = getUsedScheduleColors(entries);
    const copiedDraft = entryToNewDraft(entry, usedColors);
    const copiedColor = normalizeTimetableColor(entry.color);
    setEditingEntryId(null);
    setEditorDraft(copiedDraft);
    setEditorError("");
    setColorNotice(
      copiedDraft.color !== copiedColor
        ? "이미 사용 중인 색상이라 다른 색상을 골랐어요."
        : "이미 사용 중인 색상은 선택할 수 없어요.",
    );
    requestAnimationFrame(() => titleInputRef.current?.focus());
  }

  function startEditEntry(entry) {
    setEditingEntryId(entry.id);
    setEditorDraft(entryToEditor(entry));
    setEditorError("");
    setColorNotice("이미 사용 중인 색상은 선택할 수 없어요.");
  }

  function cancelEditEntry() {
    setEditingEntryId(null);
    setEditorDraft(null);
    setEditorError("");
    setColorNotice("");
  }

  function updateEditorDraft(field, value) {
    setEditorDraft((current) => ({ ...current, [field]: value }));
    if (field === "title" && value.trim()) {
      setEditorError("");
    }
    if (field === "color") {
      setColorNotice("이미 사용 중인 색상은 선택할 수 없어요.");
      setEditorError("");
    }
  }

  function updateEditorSlot(slotIndex, field, value) {
    setEditorDraft((current) => ({
      ...current,
      slots: current.slots.map((slot, index) => (index === slotIndex ? { ...slot, [field]: value } : slot)),
    }));
    setEditorError("");
  }

  function addEditorSlot() {
    setEditorDraft((current) => {
      const previousSlot = current.slots[current.slots.length - 1] || createNewScheduleDraft().slots[0];
      return {
        ...current,
        slots: [
          ...current.slots,
          {
            dayOfWeek: previousSlot.dayOfWeek,
            startTime: previousSlot.startTime,
            endTime: previousSlot.endTime,
          },
        ],
      };
    });
    setEditorError("");
  }

  function removeEditorSlot(slotIndex) {
    setEditorDraft((current) => {
      if (current.slots.length <= 1) return current;
      return {
        ...current,
        slots: current.slots.filter((_, index) => index !== slotIndex),
      };
    });
  }

  function saveEditingEntry() {
    if (!editorDraft) return;
    const title = editorDraft.title.trim();
    if (!title) {
      setEditorError("일정 이름을 입력해주세요.");
      requestAnimationFrame(() => titleInputRef.current?.focus());
      return;
    }

    const selectedColor = normalizeTimetableColor(editorDraft.color);
    const saveUsedColors = getUsedScheduleColors(entries, editorDraft.isNew ? null : editingEntryId);
    if (saveUsedColors.has(selectedColor) && hasAvailableColor(saveUsedColors)) {
      const nextColor = getFirstAvailableColor(saveUsedColors, selectedColor);
      setEditorDraft((current) => ({ ...current, color: nextColor }));
      setEditorError("이미 사용 중인 색상은 선택할 수 없어요.");
      setColorNotice("사용 가능한 다른 색상을 골랐어요.");
      return;
    }

    const { slots, error: slotError } = normalizeEditorSlots(editorDraft.slots);
    if (slotError) {
      setEditorError(slotError);
      return;
    }

    const firstSlot = slots[0];
    const now = new Date().toISOString();
    const nextEntry = {
      id: createId(),
      title,
      slots,
      dayOfWeek: firstSlot.dayOfWeek,
      startTime: firstSlot.startTime,
      endTime: firstSlot.endTime,
      memo: editorDraft.memo,
      color: selectedColor,
      active: editorDraft.active !== false,
      createdAt: now,
      updatedAt: now,
    };

    if (editorDraft.isNew) {
      setEntries((current) => sortTimetableEntries([...current, nextEntry]));
      cancelEditEntry();
      return;
    }

    setEntries((current) =>
      sortTimetableEntries(
        current.map((entry) => {
          if (entry.id !== editingEntryId) return entry;

          return {
            ...entry,
            title,
            slots,
            dayOfWeek: firstSlot.dayOfWeek,
            startTime: firstSlot.startTime,
            endTime: firstSlot.endTime,
            memo: editorDraft.memo,
            color: selectedColor,
            active: editorDraft.active !== false,
            updatedAt: now,
          };
        }),
      ),
    );
    cancelEditEntry();
  }

  function deleteTimetableEntry(entryId = editingEntryId) {
    if (!entryId) return;
    if (!window.confirm("삭제할까요?")) return;

    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    cancelEditEntry();
  }

  return (
    <section className="familyTimetable" aria-label="기본 시간표">
      <div className="familyTimetableIntro">
        <div>
          <h2>기본 시간표</h2>
          <p>매주 반복되는 일정을 미리 적어두는 곳이에요.</p>
        </div>
        <div className="familyTimetableIntroActions">
          <button className="familyTimetableAddButton" type="button" onClick={startNewEntry}>
            + 일정
          </button>
          <span className="familyTimetableBadge">08:00-22:00</span>
        </div>
      </div>

      <div className="familyTimetableScroller">
        <div className="familyTimetableGrid" style={{ "--family-timetable-body-height": `${TIMETABLE_BODY_HEIGHT}px` }}>
          <div className="familyTimetableCorner" aria-hidden="true" />
          {DAY_LABELS.map((day) => (
            <div className={dayClassName("familyTimetableDayHeader", day.dayOfWeek)} key={day.dayOfWeek}>
              {day.label}
            </div>
          ))}

          <div className="familyTimetableTimeColumn">
            {TIMETABLE_HOURS.map((hour) => (
              <div className="familyTimetableHourLabel" key={hour} style={{ top: `${(hour - TIMETABLE_START_HOUR) * 60}px` }}>
                <span className="familyTimetableHourFull">{minutesToTime(hour * 60)}</span>
                <span className="familyTimetableHourCompact">{hour}</span>
              </div>
            ))}
          </div>

          {DAY_LABELS.map((day) => (
            <div className={dayClassName("familyTimetableDayColumn", day.dayOfWeek)} key={day.dayOfWeek}>
              {TIMETABLE_VISIBLE_HOURS.map((hour) => (
                <div className="familyTimetableHour" key={hour} style={{ top: `${(hour - TIMETABLE_START_HOUR) * 60}px` }}>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ))}

              {Array.from({ length: TIMETABLE_TOTAL_SLOTS }, (_, index) => (
                <span
                  className="familyTimetableSlot"
                  aria-hidden="true"
                  key={TIMETABLE_START_HOUR * 60 + index * TIMETABLE_SLOT_MINUTES}
                  style={{ top: `${index * TIMETABLE_SLOT_PIXEL_HEIGHT}px` }}
                />
              ))}

              {(visibleBlocksByDay[day.dayOfWeek] || []).map(({ entry, slot, slotIndex }) => (
                <button
                  className={`familyTimetableEntry familyTimetableEntry${colorClassName(entry.color)}${entry.id === editingEntryId ? " familyTimetableEntryEditing" : ""}`}
                  type="button"
                  key={`${entry.id}-${slotIndex}`}
                  style={getEntryStyle(slot)}
                  onClick={(event) => {
                    event.stopPropagation();
                    startEditEntry(entry);
                  }}
                >
                  <span className="familyTimetableEntryTitle">{entry.title}</span>
                  <span className="familyTimetableEntryTime">
                    {slot.startTime} - {slot.endTime}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {editorDraft ? (
        <form
          className="familyTimetableEditor"
          onSubmit={(event) => {
            event.preventDefault();
            saveEditingEntry();
          }}
        >
          <div className="familyTimetableEditorHeader">
            <h3>{editorDraft.isNew ? "일정 추가" : "일정 수정"}</h3>
            {!editorDraft.isNew ? (
              <button className="familyTimetableEditorDelete" type="button" onClick={() => deleteTimetableEntry()}>
                삭제
              </button>
            ) : null}
          </div>

          <label>
            <span>일정 이름</span>
            <input ref={titleInputRef} value={editorDraft.title} onChange={(event) => updateEditorDraft("title", event.target.value)} />
          </label>
          {editorError ? (
            <p className="familyTimetableEditorError" role="alert">
              {editorError}
            </p>
          ) : null}

          <div className="familyTimetableSlotField">
            <span>시간</span>
            <div className="familyTimetableSlotRows">
              {editorDraft.slots.map((slot, slotIndex) => (
                <div className="familyTimetableSlotRow" key={slotIndex}>
                  <label>
                    <span>요일</span>
                    <select value={slot.dayOfWeek} onChange={(event) => updateEditorSlot(slotIndex, "dayOfWeek", event.target.value)}>
                      {DAY_LABELS.map((day) => (
                        <option value={day.dayOfWeek} key={day.dayOfWeek}>
                          {day.optionLabel}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>시작</span>
                    <input type="time" step={TIMETABLE_SLOT_MINUTES * 60} value={slot.startTime} onChange={(event) => updateEditorSlot(slotIndex, "startTime", event.target.value)} />
                  </label>
                  <span className="familyTimetableSlotSeparator" aria-hidden="true">~</span>
                  <label>
                    <span>끝</span>
                    <input type="time" step={TIMETABLE_SLOT_MINUTES * 60} value={slot.endTime} onChange={(event) => updateEditorSlot(slotIndex, "endTime", event.target.value)} />
                  </label>
                  <button
                    className="familyTimetableSlotRemove"
                    type="button"
                    disabled={editorDraft.slots.length <= 1}
                    aria-label="시간 삭제"
                    onClick={() => removeEditorSlot(slotIndex)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button className="familyTimetableAddSlotButton" type="button" onClick={addEditorSlot}>
              + 시간 추가
            </button>
          </div>

          <div className="familyTimetableColorField">
            <span>색상</span>
            <div className="familyTimetableColorChips" role="radiogroup" aria-label="색상">
              {FAMILY_TIMETABLE_COLORS.map((color) => {
                const unavailable = colorIsUnavailable(color);
                return (
                  <button
                    className={`familyTimetableColorChip familyTimetableColorChip${colorClassName(color)}${editorDraft.color === color ? " familyTimetableColorChipActive" : ""}${unavailable ? " familyTimetableColorChipDisabled" : ""}`}
                    type="button"
                    aria-label={FAMILY_TIMETABLE_COLOR_LABELS[color]}
                    aria-pressed={editorDraft.color === color}
                    disabled={unavailable}
                    key={color}
                    title={FAMILY_TIMETABLE_COLOR_LABELS[color]}
                    onClick={() => updateEditorDraft("color", color)}
                  />
                );
              })}
            </div>
            {colorNotice ? <p className="familyTimetableColorHelp">{colorNotice}</p> : null}
          </div>

          <label>
            <span>메모</span>
            <textarea value={editorDraft.memo} rows={2} onChange={(event) => updateEditorDraft("memo", event.target.value)} />
          </label>

          {editorDraft.isNew && visibleEntries.length > 0 ? (
            <div className="familyTimetableCopyField">
              <span>복사해서 만들기</span>
              <div className="familyTimetableCopyPills" aria-label="복사해서 만들기">
                {visibleEntries.map((entry) => (
                  <button
                    className={`familyTimetableCopyPill familyTimetableEntry${colorClassName(entry.color)}`}
                    type="button"
                    key={entry.id}
                    onClick={() => copyEntryToNewDraft(entry)}
                  >
                    {entry.title}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="familyTimetableEditorActions">
            <button className="familyTimetableSave" type="submit">
              저장
            </button>
            <button className="familyTimetableCancel" type="button" onClick={cancelEditEntry}>
              취소
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
