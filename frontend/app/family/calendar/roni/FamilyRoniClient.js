"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import FamilyHeader from "../../FamilyHeader";
import {
  FAMILY_CALENDAR_WEEKDAY_OPTIONS,
  createDefaultFamilyRoniItem,
  loadFamilyRoniItems,
  normalizeFamilyRoniItem,
  saveFamilyRoniItems,
} from "../familyCalendarData";

function roniToDraft(item) {
  return {
    id: item.id || "",
    title: item.title || "",
    dayOfWeek: String(item.dayOfWeek ?? 0),
    startTime: item.startTime || "09:00",
    endTime: item.endTime || "09:40",
    memo: item.memo || "",
    color: item.color || "pink",
    active: item.active !== false,
  };
}

function weekdayLabel(dayOfWeek) {
  return FAMILY_CALENDAR_WEEKDAY_OPTIONS.find((option) => option.dayOfWeek === Number(dayOfWeek))?.label || "월요일";
}

export default function FamilyRoniClient() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(loadFamilyRoniItems());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveFamilyRoniItems(items);
  }, [items, loaded]);

  const visibleItems = useMemo(() => {
    return items
      .filter((item) => item.active !== false)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || String(a.startTime).localeCompare(String(b.startTime)));
  }, [items]);

  function startNewRoni() {
    setDraft(roniToDraft(createDefaultFamilyRoniItem()));
    setError("");
  }

  function startEditRoni(item) {
    setDraft(roniToDraft(item));
    setError("");
  }

  function cancelEdit() {
    setDraft(null);
    setError("");
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "title" && value.trim()) setError("");
  }

  function saveRoni(event) {
    event.preventDefault();
    if (!draft?.title?.trim()) {
      setError("일정 이름을 입력해주세요.");
      return;
    }

    const normalized = normalizeFamilyRoniItem({ ...draft, title: draft.title.trim(), dayOfWeek: Number(draft.dayOfWeek) });
    if (!normalized) {
      setError("일정 이름을 입력해주세요.");
      return;
    }

    setItems((current) => {
      const exists = current.some((item) => item.id === normalized.id);
      if (exists) return current.map((item) => (item.id === normalized.id ? normalized : item));
      return [...current, normalized];
    });
    cancelEdit();
  }

  function deleteRoni(itemId = draft?.id) {
    if (!itemId) return;
    setItems((current) => current.filter((item) => item.id !== itemId));
    if (draft?.id === itemId) cancelEdit();
  }

  return (
    <section className="familyPage" aria-label="로우니 시간표">
      <div className="familyCard familyCalendarPageCard">
        <FamilyHeader active="calendar" />
        <main className="familyCalendarFormPage">
          <section className="familyRoniPanel">
            <div className="familyCalendarFormHeader">
              <div>
                <h2>로우니 시간표</h2>
                <p>매주 반복되는 일정을 적어두는 곳이에요.</p>
              </div>
              <div className="familyCalendarFormActions familyCalendarFormActionsInline">
                <button className="familyTaskActionButton familyTaskActionButtonPrimary" type="button" onClick={startNewRoni}>
                  + 일정
                </button>
                <Link className="familyTaskActionButton" href="/family/calendar">
                  취소
                </Link>
              </div>
            </div>

            <div className="familyRoniList">
              {visibleItems.length ? (
                visibleItems.map((item) => (
                  <article className="familyRoniRow" key={item.id}>
                    <div>
                      <h3>{item.title}</h3>
                      <p>
                        {weekdayLabel(item.dayOfWeek)} {item.startTime} - {item.endTime}
                      </p>
                    </div>
                    <div className="familyRoniRowActions">
                      <button type="button" onClick={() => startEditRoni(item)}>
                        수정
                      </button>
                      <button type="button" onClick={() => deleteRoni(item.id)}>
                        삭제
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="familyTaskEmpty">아직 로우니 시간표가 없어요.</p>
              )}
            </div>
          </section>

          {draft ? (
            <form className="familyCalendarForm" onSubmit={saveRoni}>
              <div className="familyCalendarFormHeader">
                <h2>{draft.id && visibleItems.some((item) => item.id === draft.id) ? "일정 수정" : "일정 추가"}</h2>
                {draft.id && visibleItems.some((item) => item.id === draft.id) ? (
                  <button className="familyTaskDelete" type="button" onClick={() => deleteRoni()}>
                    삭제
                  </button>
                ) : null}
              </div>

              <label>
                <span>일정 이름</span>
                <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
              </label>
              {error ? <p className="familyCalendarFormError">{error}</p> : null}

              <div className="familyCalendarFormGrid">
                <label>
                  <span>요일</span>
                  <select value={draft.dayOfWeek} onChange={(event) => updateDraft("dayOfWeek", event.target.value)}>
                    {FAMILY_CALENDAR_WEEKDAY_OPTIONS.map((option) => (
                      <option value={option.dayOfWeek} key={option.dayOfWeek}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
                <span>메모</span>
                <textarea rows={3} value={draft.memo} onChange={(event) => updateDraft("memo", event.target.value)} />
              </label>

              <div className="familyCalendarFormActions">
                <button className="familyTaskSave" type="submit">
                  저장
                </button>
                <button className="familyTaskCancel" type="button" onClick={cancelEdit}>
                  취소
                </button>
              </div>
            </form>
          ) : null}
        </main>
      </div>
    </section>
  );
}
