"use client";

import { useEffect, useMemo, useState } from "react";

export const FAMILY_TIMETABLE_STORAGE_KEY = "kaosgdd.family.defaultTimetable.v1";
export const TIMETABLE_START_HOUR = 8;
export const TIMETABLE_END_HOUR = 22;
export const TIMETABLE_SLOT_MINUTES = 10;
export const DEFAULT_TIMETABLE_DURATION_MINUTES = 40;
export const TIMETABLE_SLOT_PIXEL_HEIGHT = 10;
export const FAMILY_TIMETABLE_COLORS = ["pink", "cream", "yellow", "mint", "blue", "lavender"];

const DAY_LABELS = [
  { dayOfWeek: 1, label: "월" },
  { dayOfWeek: 2, label: "화" },
  { dayOfWeek: 3, label: "수" },
  { dayOfWeek: 4, label: "목" },
  { dayOfWeek: 5, label: "금" },
  { dayOfWeek: 6, label: "토" },
  { dayOfWeek: 7, label: "일" },
];

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

export function timeToMinutes(timeString) {
  const [rawHour, rawMinute] = String(timeString || "0:00").split(":");
  const hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return TIMETABLE_START_HOUR * 60;
  return hour * 60 + minute;
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

export function createDefaultTimetableEntry({ dayOfWeek, startMinutes, title = "" }) {
  const now = new Date().toISOString();
  const start = clampTimetableMinutes(startMinutes);
  const end = Math.min(TIMETABLE_END_HOUR * 60, start + DEFAULT_TIMETABLE_DURATION_MINUTES);

  return {
    id: createId(),
    title: title.trim() || "새 일정",
    dayOfWeek,
    startTime: minutesToTime(start),
    endTime: minutesToTime(end),
    memo: "",
    color: "pink",
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeTimetableEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const dayOfWeek = Number(entry.dayOfWeek);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) return null;

  return {
    id: String(entry.id || createId()),
    title: String(entry.title || "새 일정"),
    dayOfWeek,
    startTime: minutesToTime(clampTimetableMinutes(timeToMinutes(entry.startTime))),
    endTime: minutesToTime(clampTimetableMinutes(timeToMinutes(entry.endTime))),
    memo: String(entry.memo || ""),
    color: FAMILY_TIMETABLE_COLORS.includes(entry.color) ? entry.color : "pink",
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
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
}

function getEntryStyle(entry) {
  const start = timeToMinutes(entry.startTime);
  const end = Math.max(start + TIMETABLE_SLOT_MINUTES, timeToMinutes(entry.endTime));
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
    dayOfWeek: String(entry.dayOfWeek),
    startTime: entry.startTime,
    endTime: entry.endTime,
    memo: entry.memo || "",
    color: entry.color || "pink",
  };
}

export default function FamilyTimetable() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editorDraft, setEditorDraft] = useState(null);

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

  function addTimetableEntry(dayOfWeek, startMinutes) {
    const title = window.prompt("일정 이름");
    if (title === null) return;

    const nextEntry = createDefaultTimetableEntry({ dayOfWeek, startMinutes, title });
    setEntries((current) => sortTimetableEntries([...current, nextEntry]));
    setEditingEntryId(nextEntry.id);
    setEditorDraft(entryToEditor(nextEntry));
  }

  function startEditEntry(entry) {
    setEditingEntryId(entry.id);
    setEditorDraft(entryToEditor(entry));
  }

  function cancelEditEntry() {
    setEditingEntryId(null);
    setEditorDraft(null);
  }

  function updateEditorDraft(field, value) {
    setEditorDraft((current) => ({ ...current, [field]: value }));
  }

  function saveEditingEntry() {
    if (!editorDraft) return;
    const start = clampTimetableMinutes(timeToMinutes(editorDraft.startTime));
    const end = Math.max(start + TIMETABLE_SLOT_MINUTES, clampTimetableMinutes(timeToMinutes(editorDraft.endTime)));

    setEntries((current) =>
      sortTimetableEntries(
        current.map((entry) => {
          if (entry.id !== editingEntryId) return entry;

          return {
            ...entry,
            title: editorDraft.title.trim() || "새 일정",
            dayOfWeek: Number(editorDraft.dayOfWeek),
            startTime: minutesToTime(start),
            endTime: minutesToTime(Math.min(TIMETABLE_END_HOUR * 60, end)),
            memo: editorDraft.memo,
            color: FAMILY_TIMETABLE_COLORS.includes(editorDraft.color) ? editorDraft.color : "pink",
            updatedAt: new Date().toISOString(),
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
        <span className="familyTimetableBadge">08:00-22:00</span>
      </div>

      <div className="familyTimetableScroller">
        <div className="familyTimetableGrid" style={{ "--family-timetable-body-height": `${TIMETABLE_BODY_HEIGHT}px` }}>
          <div className="familyTimetableCorner" aria-hidden="true" />
          {DAY_LABELS.map((day) => (
            <div className="familyTimetableDayHeader" key={day.dayOfWeek}>
              {day.label}
            </div>
          ))}

          <div className="familyTimetableTimeColumn">
            {TIMETABLE_HOURS.map((hour) => (
              <div className="familyTimetableHourLabel" key={hour} style={{ top: `${(hour - TIMETABLE_START_HOUR) * 60}px` }}>
                {minutesToTime(hour * 60)}
              </div>
            ))}
          </div>

          {DAY_LABELS.map((day) => (
            <div className="familyTimetableDayColumn" key={day.dayOfWeek}>
              {TIMETABLE_VISIBLE_HOURS.map((hour) => (
                <div className="familyTimetableHour" key={hour} style={{ top: `${(hour - TIMETABLE_START_HOUR) * 60}px` }}>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ))}

              {Array.from({ length: TIMETABLE_TOTAL_SLOTS }, (_, index) => {
                const startMinutes = TIMETABLE_START_HOUR * 60 + index * TIMETABLE_SLOT_MINUTES;
                return (
                  <button
                    className="familyTimetableSlot"
                    type="button"
                    aria-label={`${day.label} ${minutesToTime(startMinutes)} 일정 추가`}
                    key={startMinutes}
                    style={{ top: `${index * TIMETABLE_SLOT_PIXEL_HEIGHT}px` }}
                    onClick={() => addTimetableEntry(day.dayOfWeek, startMinutes)}
                  />
                );
              })}

              {visibleEntries
                .filter((entry) => entry.dayOfWeek === day.dayOfWeek)
                .map((entry) => (
                  <button
                    className={`familyTimetableEntry familyTimetableEntry${entry.color[0].toUpperCase()}${entry.color.slice(1)}${
                      entry.id === editingEntryId ? " familyTimetableEntryEditing" : ""
                    }`}
                    type="button"
                    key={entry.id}
                    style={getEntryStyle(entry)}
                    onClick={(event) => {
                      event.stopPropagation();
                      startEditEntry(entry);
                    }}
                  >
                    <span className="familyTimetableEntryTitle">{entry.title}</span>
                    <span className="familyTimetableEntryTime">
                      {entry.startTime} - {entry.endTime}
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
            <h3>일정 수정</h3>
            <button className="familyTimetableEditorDelete" type="button" onClick={() => deleteTimetableEntry()}>
              삭제
            </button>
          </div>

          <label>
            <span>이름</span>
            <input value={editorDraft.title} onChange={(event) => updateEditorDraft("title", event.target.value)} />
          </label>

          <div className="familyTimetableEditorGrid">
            <label>
              <span>요일</span>
              <select value={editorDraft.dayOfWeek} onChange={(event) => updateEditorDraft("dayOfWeek", event.target.value)}>
                {DAY_LABELS.map((day) => (
                  <option value={day.dayOfWeek} key={day.dayOfWeek}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>시작</span>
              <input type="time" step={TIMETABLE_SLOT_MINUTES * 60} value={editorDraft.startTime} onChange={(event) => updateEditorDraft("startTime", event.target.value)} />
            </label>
            <label>
              <span>끝</span>
              <input type="time" step={TIMETABLE_SLOT_MINUTES * 60} value={editorDraft.endTime} onChange={(event) => updateEditorDraft("endTime", event.target.value)} />
            </label>
            <label>
              <span>색</span>
              <select value={editorDraft.color} onChange={(event) => updateEditorDraft("color", event.target.value)}>
                {FAMILY_TIMETABLE_COLORS.map((color) => (
                  <option value={color} key={color}>
                    {color}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            <span>메모</span>
            <textarea value={editorDraft.memo} rows={2} onChange={(event) => updateEditorDraft("memo", event.target.value)} />
          </label>

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
