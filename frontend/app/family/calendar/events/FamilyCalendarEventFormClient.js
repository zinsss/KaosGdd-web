"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import FamilyHeader from "../../FamilyHeader";
import { FamilyDatePickerButton, FamilyTimePickerButton } from "../FamilyPickerButton";
import {
  FAMILY_CALENDAR_COLOR_KEYS,
  FAMILY_CALENDAR_COLOR_LABELS,
  createDefaultFamilyCalendarItem,
  familyCalendarColorClassName,
  fetchFamilyCalendarItems,
  normalizeFamilyCalendarItem,
  persistFamilyCalendarItems,
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
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")} (${weekday})`;
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
    sharedWithSong: item.sharedWithSong === true,
    mainItemId: item.mainItemId || "",
    adoptedFromMain: item.adoptedFromMain === true,
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
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState(() => eventToDraft(createDefaultFamilyCalendarItem()));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(eventId);

  useEffect(() => {
    let cancelled = false;
    fetchFamilyCalendarItems().then((loadedItems) => {
      if (cancelled) return;
      setItems(loadedItems);
      if (editing) {
        const existing = loadedItems.find((item) => item.id === eventId);
        if (existing) setDraft(eventToDraft(existing));
      } else {
        setDraft((current) => ({ ...current, ...eventPrefillFromLocation() }));
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [editing, eventId]);

  useEffect(() => {
    if (!loaded) return;
    persistFamilyCalendarItems(items);
  }, [items, loaded]);

  const pageTitle = useMemo(() => (editing ? "일정 수정" : "일정 추가"), [editing]);
  const selectedColorClass = familyCalendarColorClassName(draft.color);
  const selectedColorLabel = FAMILY_CALENDAR_COLOR_LABELS[draft.color] || FAMILY_CALENDAR_COLOR_LABELS.pink;
  const sharedWithSong = draft.sharedWithSong === true;

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

  async function saveEvent(event) {
    event.preventDefault();
    const normalized = normalizeFamilyCalendarItem({ ...draft, title: draft.title.trim() });
    if (!normalized) {
      setError("일정 이름을 입력해주세요.");
      return;
    }

    const nextItems = editing
      ? items.map((item) => (item.id === eventId ? { ...normalized, id: eventId } : item))
      : [...items, normalized];
    setSaving(true);
    setItems(nextItems);
    try {
      await persistFamilyCalendarItems(nextItems);
      router.push("/family/calendar");
    } catch {
      setError("일정을 저장하지 못했어요.");
      setSaving(false);
    }
  }

  async function deleteEvent() {
    if (!editing) return;
    const nextItems = items.filter((item) => item.id !== eventId);
    setSaving(true);
    setItems(nextItems);
    try {
      await persistFamilyCalendarItems(nextItems);
      router.push("/family/calendar");
    } catch {
      setError("일정을 삭제하지 못했어요.");
      setSaving(false);
    }
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
                <button
                  aria-pressed={sharedWithSong}
                  className={`familyTaskSongToggle${sharedWithSong ? " familyTaskSongToggleActive" : ""}`}
                  type="button"
                  onClick={() => updateDraft("sharedWithSong", !sharedWithSong)}
                >
                  쏭
                </button>
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
                  <FamilyDatePickerButton
                    ariaLabel="날짜 선택"
                    className="familyCalendarPickerButton familyCalendarDateTimeValueButton familyCalendarDatePickerPill"
                    value={draft.date}
                    onChange={(value) => updateDraft("date", value)}
                  >
                    {formatKoreanDate(draft.date)}
                  </FamilyDatePickerButton>
                  {draft.allDay ? null : (
                    <>
                      <span className="familyCalendarDateTimeCluster">
                        <FamilyTimePickerButton
                          ariaLabel="시작 시간 선택"
                          className="familyCalendarPickerButton familyCalendarDateTimeValueButton familyCalendarTimePickerPill"
                          value={draft.startTime}
                          onChange={(value) => updateDraft("startTime", value)}
                        >
                          {draft.startTime}
                        </FamilyTimePickerButton>
                      </span>
                      <span className="familyCalendarFormTimeSeparator" aria-hidden="true">~</span>
                      <span className="familyCalendarDateTimeCluster">
                        <FamilyTimePickerButton
                          ariaLabel="끝 시간 선택"
                          className="familyCalendarPickerButton familyCalendarDateTimeValueButton familyCalendarTimePickerPill"
                          value={draft.endTime}
                          onChange={(value) => updateDraft("endTime", value)}
                        >
                          {draft.endTime}
                        </FamilyTimePickerButton>
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
                {saving ? "저장 중" : "저장"}
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
