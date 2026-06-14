"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import FamilyHeader from "../../FamilyHeader";
import {
  createDefaultFamilyCalendarItem,
  loadFamilyCalendarItems,
  normalizeFamilyCalendarItem,
  saveFamilyCalendarItems,
} from "../familyCalendarData";

const FAMILY_CALENDAR_EVENT_DEFAULT_DURATION_MINUTES = 40;

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

function eventToDraft(item) {
  return {
    id: item.id,
    title: item.title || "",
    date: item.date || "",
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
  return {
    ...(date ? { date } : {}),
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

  const pageTitle = useMemo(() => (editing ? "뭔날이고" : "+ 뭔날"), [editing]);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "title" && value.trim()) setError("");
  }

  function goBack() {
    router.push("/family/calendar");
  }

  function saveEvent(event) {
    event.preventDefault();
    const normalized = normalizeFamilyCalendarItem({ ...draft, title: draft.title.trim() });
    if (!normalized) {
      setError("모할꼬를 입력해주세요.");
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
    <section className="familyPage" aria-label="뭔날이고">
      <div className="familyCard familyCalendarPageCard">
        <FamilyHeader active="home" />
        <main className="familyCalendarFormPage">
          <form className="familyCalendarForm" onSubmit={saveEvent}>
            <div className="familyCalendarFormHeader">
              <div>
                <h2>{pageTitle}</h2>
                <p>달력에 적어둘 뭔날을 써요.</p>
              </div>
              <Link className="familyTaskActionButton" href="/family/calendar">
                고마하자
              </Link>
            </div>

            <label>
              <span>모할꼬</span>
              <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
            </label>
            {error ? <p className="familyCalendarFormError">{error}</p> : null}

            <div className="familyCalendarFormGrid">
              <label>
                <span>언제고</span>
                <input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} />
              </label>
              <label>
                <span>시작</span>
                <input type="time" value={draft.startTime} onChange={(event) => updateDraft("startTime", event.target.value)} />
              </label>
              <label>
                <span>끝</span>
                <input type="time" value={draft.endTime} onChange={(event) => updateDraft("endTime", event.target.value)} />
              </label>
            </div>

            <label>
              <span>머라? 좀 더 지끼봐라</span>
              <textarea rows={3} value={draft.memo} onChange={(event) => updateDraft("memo", event.target.value)} />
            </label>

            <div className="familyCalendarFormActions">
              <button className="familyTaskSave" type="submit">
                되따
              </button>
              <button className="familyTaskCancel" type="button" onClick={goBack}>
                고마하자
              </button>
              {editing ? (
                <button className="familyTaskDelete" type="button" onClick={deleteEvent}>
                  치아라
                </button>
              ) : null}
            </div>
          </form>
        </main>
      </div>
    </section>
  );
}
