"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import FamilyHeader from "../../FamilyHeader";
import {
  FAMILY_CALENDAR_COLOR_KEYS,
  FAMILY_CALENDAR_COLOR_LABELS,
  createDefaultFamilyCalendarItem,
  familyCalendarColorClassName,
  loadFamilyCalendarItems,
  normalizeFamilyCalendarItem,
  saveFamilyCalendarItems,
} from "../familyCalendarData";

const FAMILY_CALENDAR_EVENT_DEFAULT_DURATION_MINUTES = 40;
const FAMILY_CALENDAR_WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function addMinutesToTime(timeString, minutesToAdd) {
  const match = String(timeString || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "09:40";
  const totalMinutes = Number(match[1]) * 60 + Number(match[2]) + minutesToAdd;
  const minutesInDay = 24 * 60;
  const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function validDateParam(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? value : "";
}

function validTimeParam(value) {
  return /^\d{2}:\d{2}$/.test(String(value || "")) ? value : "";
}

function formatKoreanDate(dateString) {
  const date = validDateParam(dateString);
  if (!date) return "날짜 선택";
  const [year, month, day] = date.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  const weekday = FAMILY_CALENDAR_WEEKDAY_LABELS[localDate.getDay()] || "";
  return `${String(year).slice(-2)}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}(${weekday})`;
}

function openNativePicker(inputRef) {
  const input = inputRef.current;
  if (!input) return;
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch {
      // Fall through to focus/click for browsers that gate showPicker.
    }
  }
  input.focus();
  input.click();
}

function eventToDraft(item) {
  return {
    id: item.id,
    title: item.title || "",
    date: item.date || "",
    allDay: item.allDay === true,
    startTime: item.startTime || "09:00",
    endTime: item.endTime || "09:40",
    memo: item.memo || "",
    color: item.color || "pink",
  };
}

function eventPrefillFromLocation() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const date = validDateParam(params.get("date"));
  const startTime = validTimeParam(params.get("start"));
  const endTime = validTimeParam(params.get("end")) || (startTime ? addMinutesToTime(startTime, FAMILY_CALENDAR_EVENT_DEFAULT_DURATION_MINUTES) : "");
  const allDay = params.get("allDay") === "1";
  return {
    ...(date ? { date } : {}),
    ...(allDay ? { allDay: true } : {}),
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  };
}

export default function FamilyCalendarEventFormClient({ eventId = "" }) {
  const router = useRouter();
  const dateInputRef = useRef(null);
  const startTimeInputRef = useRef(null);
  const endTimeInputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState(() => eventToDraft(createDefaultFamilyCalendarItem()));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const editing = Boolean(eventId);

  useEffect(() => {
    const loadedItems = loadFamilyCalendarItems();
    setItems(loadedItems);
    if (editing) {
      const existing = loadedItems.find((item) => item.id === eventId);
      if (existing) setDraft(eventToDraft(existing));
    } else {
      setDraft((current) => ({ ...current, ...eventPrefillFromLocation() }));
    }
    setLoaded(true);
  }, [editing, eventId]);

  useEffect(() => {
    if (!loaded) return;
    saveFamilyCalendarItems(items);
  }, [items, loaded]);

  const pageTitle = useMemo(() => (editing ? "일정 수정" : "일정 추가"), [editing]);
  const selectedColorClass = familyCalendarColorClassName(draft.color);
  const selectedColorLabel = FAMILY_CALENDAR_COLOR_LABELS[draft.color] || FAMILY_CALENDAR_COLOR_LABELS.pink;

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "title" && value.trim()) setError("");
  }

  function toggleAllDay(nextAllDay) {
    setDraft((current) => ({
      ...current,
      allDay: nextAllDay,
      startTime: nextAllDay ? current.startTime : (current.startTime || "09:00"),
      endTime: nextAllDay ? current.endTime : (current.endTime || addMinutesToTime(current.startTime || "09:00", FAMILY_CALENDAR_EVENT_DEFAULT_DURATION_MINUTES)),
    }));
  }

  function goBack() {
    router.push("/family/calendar");
  }

  function saveEvent(event) {
    event.preventDefault();
    const normalized = normalizeFamilyCalendarItem({ ...draft, title: draft.title.trim() });
    if (!normalized) {
      setError("일정 이름을 입력해주세요.");
      return;
    }

    setItems((current) => {
      if (editing) {
        return current.map((item) => (item.id === eventId ? { ...normalized, id: eventId } : item));
      }

      return [...current, normalized];
    });
    router.push("/family/calendar");
  }

  function deleteEvent() {
    if (!editing) return;
    setItems((current) => current.filter((item) => item.id !== eventId));
    router.push("/family/calendar");
  }

  return (
    <section className="familyPage" aria-label={pageTitle}>
      <div className="familyCard familyCalendarPageCard">
        <FamilyHeader active="calendar" />
        <main className="familyCalendarFormPage">
          <form className="familyCalendarForm" onSubmit={saveEvent}>
            <div className="familyCalendarFormHeader">
              <div>
                <h2>{pageTitle}</h2>
                <p>달력에 적어둘 일정을 써요.</p>
              </div>
            </div>

            <label className="familyCalendarFormTitleField">
              <span>제목</span>
              <input placeholder="새 일정" value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
            </label>
            {error ? <p className="familyCalendarFormError">{error}</p> : null}

            <div className="familyCalendarFormMeta">
              <div className="familyCalendarFormMetaRow">
                <div className={`familyTimetableColorField familyCalendarColorPicker${colorPickerOpen ? " familyCalendarColorPickerOpen" : ""}`}>
                  <button
                    aria-expanded={colorPickerOpen}
                    className="familyCalendarColorPickerToggle"
                    onClick={() => setColorPickerOpen((current) => !current)}
                    type="button"
                  >
                    <span className="familyCalendarColorPickerTitle">색상</span>
                    <span className="familyCalendarColorPickerValue">{selectedColorLabel}</span>
                    <span className={`familyCalendarColorPickerSwatch familyTimetableColorChip${selectedColorClass}`} aria-hidden="true" />
                    <span className="familyCalendarColorPickerChevron" aria-hidden="true">
                      {colorPickerOpen ? "▴" : "▾"}
                    </span>
                  </button>
                </div>
                <label className="familyCalendarFormToggle familyCalendarFormAllDayInline">
                  <span>종일 일정</span>
                  <input
                    checked={draft.allDay}
                    className="familyCalendarFormToggleControl"
                    type="checkbox"
                    onChange={(event) => toggleAllDay(event.target.checked)}
                  />
                </label>
              </div>
              {colorPickerOpen ? (
                <div className="familyTimetableColorChips" role="radiogroup" aria-label="색상">
                  {FAMILY_CALENDAR_COLOR_KEYS.map((color) => (
                    <button
                      aria-label={FAMILY_CALENDAR_COLOR_LABELS[color]}
                      aria-pressed={draft.color === color}
                      className={`familyTimetableColorChip familyTimetableColorChip${familyCalendarColorClassName(color)}${draft.color === color ? " familyTimetableColorChipActive" : ""}`}
                      key={color}
                      onClick={() => updateDraft("color", color)}
                      title={FAMILY_CALENDAR_COLOR_LABELS[color]}
                      type="button"
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div className={`familyCalendarFormGrid${draft.allDay ? " familyCalendarFormGridAllDay" : ""}`}>
              <div className="familyCalendarDateTimeSection">
                <span className="familyCalendarDateTimeTitle">날짜/시간</span>
                <div className="familyCalendarDateTimeRow">
                  <span className="familyCalendarPickerValue">{formatKoreanDate(draft.date)}</span>
                  <button aria-label="날짜 선택" className="familyCalendarPickerButton" onClick={() => openNativePicker(dateInputRef)} type="button">
                    달력
                  </button>
                  <input
                    aria-hidden="true"
                    className="familyCalendarNativePickerInput"
                    ref={dateInputRef}
                    tabIndex={-1}
                    type="date"
                    value={draft.date}
                    onChange={(event) => updateDraft("date", event.target.value)}
                  />
                  {draft.allDay ? null : (
                    <>
                      <span className="familyCalendarDateTimeCluster">
                        <span className="familyCalendarPickerValue">{draft.startTime}</span>
                        <button aria-label="시작 시간 선택" className="familyCalendarPickerButton" onClick={() => openNativePicker(startTimeInputRef)} type="button">
                          시간
                        </button>
                        <input
                          aria-hidden="true"
                          className="familyCalendarNativePickerInput"
                          ref={startTimeInputRef}
                          tabIndex={-1}
                          type="time"
                          value={draft.startTime}
                          onChange={(event) => updateDraft("startTime", event.target.value)}
                        />
                      </span>
                      <span className="familyCalendarFormTimeSeparator" aria-hidden="true">~</span>
                      <span className="familyCalendarDateTimeCluster">
                        <span className="familyCalendarPickerValue">{draft.endTime}</span>
                        <button aria-label="끝 시간 선택" className="familyCalendarPickerButton" onClick={() => openNativePicker(endTimeInputRef)} type="button">
                          시간
                        </button>
                        <input
                          aria-hidden="true"
                          className="familyCalendarNativePickerInput"
                          ref={endTimeInputRef}
                          tabIndex={-1}
                          type="time"
                          value={draft.endTime}
                          onChange={(event) => updateDraft("endTime", event.target.value)}
                        />
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <label>
              <span>메모</span>
              <textarea rows={3} value={draft.memo} onChange={(event) => updateDraft("memo", event.target.value)} />
            </label>

            <div className="familyCalendarFormActions">
              <button className="familyTaskSave" type="submit">
                저장
              </button>
              <button className="familyTaskCancel" type="button" onClick={goBack}>
                취소
              </button>
              {editing ? (
                <button className="familyTaskDelete" type="button" onClick={deleteEvent}>
                  삭제
                </button>
              ) : null}
            </div>
          </form>
        </main>
      </div>
    </section>
  );
}
