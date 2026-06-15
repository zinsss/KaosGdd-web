"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import FamilyHeader from "../../FamilyHeader";
import {
  FAMILY_CALENDAR_WEEKDAY_OPTIONS,
  FAMILY_RONI_DEFAULT_TEMPLATE_NAME,
  createDefaultFamilyRoniItem,
  createFamilyRoniTemplate,
  loadFamilyRoniTemplateState,
  normalizeFamilyRoniItem,
  saveFamilyRoniTemplateState,
  updateFamilyRoniTemplateEntries,
} from "../familyCalendarData";
import {
  FAMILY_TIMETABLE_DEFAULT_FONT,
  FAMILY_TIMETABLE_FONT_PRESETS,
  getFamilyTimetableFontFamily,
  normalizeFamilyTimetableFont,
} from "../../familyTimetableFonts";

function roniToDraft(item) {
  return {
    id: item.id || "",
    title: item.title || "",
    dayOfWeek: String(item.dayOfWeek ?? 0),
    startTime: item.startTime || "09:00",
    endTime: item.endTime || "09:40",
    memo: item.memo || "",
    color: item.color || "pink",
    fontFamily: normalizeFamilyTimetableFont(item.fontFamily || FAMILY_TIMETABLE_DEFAULT_FONT),
    active: item.active !== false,
  };
}

function weekdayLabel(dayOfWeek) {
  return FAMILY_CALENDAR_WEEKDAY_OPTIONS.find((option) => option.dayOfWeek === Number(dayOfWeek))?.label || "월요일";
}

export default function FamilyRoniClient() {
  const [templateState, setTemplateState] = useState({ activeTemplateId: "", templates: [] });
  const [openedTemplateId, setOpenedTemplateId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);

  useEffect(() => {
    const loadedState = loadFamilyRoniTemplateState();
    setTemplateState(loadedState);
    setOpenedTemplateId(loadedState.activeTemplateId || loadedState.templates[0]?.id || "");
    setLoaded(true);
  }, []);

  const openedTemplate = useMemo(() => {
    return templateState.templates.find((template) => template.id === openedTemplateId) || templateState.templates[0] || null;
  }, [openedTemplateId, templateState.templates]);

  const visibleItems = useMemo(() => {
    return (openedTemplate?.entries || [])
      .filter((item) => item.active !== false)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || String(a.startTime).localeCompare(String(b.startTime)));
  }, [openedTemplate]);

  const activeTemplateName = templateState.templates.find((template) => template.id === templateState.activeTemplateId)?.name || FAMILY_RONI_DEFAULT_TEMPLATE_NAME;
  const openedTemplateIsActive = Boolean(openedTemplate?.id && openedTemplate.id === templateState.activeTemplateId);

  function persistTemplateState(nextState) {
    const savedState = saveFamilyRoniTemplateState(nextState);
    setTemplateState(savedState);
    return savedState;
  }

  function updateOpenedTemplateEntries(entries) {
    if (!openedTemplate) return;
    const nextState = updateFamilyRoniTemplateEntries(templateState, openedTemplate.id, entries);
    persistTemplateState(nextState);
  }

  function startNewTemplate() {
    const name = window.prompt("시간표 이름");
    if (name === null) return;
    if (!name.trim()) {
      setTemplateError("시간표 이름을 입력해주세요.");
      return;
    }

    const nextTemplate = createFamilyRoniTemplate(name.trim(), []);
    const nextState = persistTemplateState({
      ...templateState,
      templates: [...templateState.templates, nextTemplate],
    });
    setOpenedTemplateId(nextTemplate.id);
    setDraft(null);
    setConfirmApply(false);
    setTemplateError("");
    setShowTemplateList(false);
    if (!nextState.activeTemplateId) {
      persistTemplateState({ ...nextState, activeTemplateId: nextTemplate.id });
    }
  }

  function saveOpenedTemplate() {
    if (!openedTemplate?.name?.trim()) {
      setTemplateError("시간표 이름을 입력해주세요.");
      return;
    }
    const now = new Date().toISOString();
    persistTemplateState({
      ...templateState,
      templates: templateState.templates.map((template) => (
        template.id === openedTemplate.id
          ? { ...template, name: template.name.trim(), updatedAt: now }
          : template
      )),
    });
    setTemplateError("");
  }

  function openTemplate(templateId) {
    setOpenedTemplateId(templateId);
    setShowTemplateList(false);
    setConfirmApply(false);
    setDraft(null);
    setError("");
    setTemplateError("");
  }

  function confirmApplyTemplate() {
    if (!openedTemplate) return;
    persistTemplateState({ ...templateState, activeTemplateId: openedTemplate.id });
    setConfirmApply(false);
  }

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

    const normalized = normalizeFamilyRoniItem({
      ...draft,
      title: draft.title.trim(),
      dayOfWeek: Number(draft.dayOfWeek),
      fontFamily: normalizeFamilyTimetableFont(draft.fontFamily),
    });
    if (!normalized) {
      setError("일정 이름을 입력해주세요.");
      return;
    }

    const currentEntries = openedTemplate?.entries || [];
    const exists = currentEntries.some((item) => item.id === normalized.id);
    const nextEntries = exists
      ? currentEntries.map((item) => (item.id === normalized.id ? normalized : item))
      : [...currentEntries, normalized];
    updateOpenedTemplateEntries(nextEntries);
    cancelEdit();
  }

  function deleteRoni(itemId = draft?.id) {
    if (!itemId || !openedTemplate) return;
    updateOpenedTemplateEntries((openedTemplate.entries || []).filter((item) => item.id !== itemId));
    if (draft?.id === itemId) cancelEdit();
  }

  if (!loaded) return null;

  return (
    <section className="familyPage" aria-label="로운이 시간표">
      <div className="familyCard familyCalendarPageCard">
        <FamilyHeader active="calendar" />
        <main className="familyCalendarFormPage">
          <section className="familyRoniPanel">
            <div className="familyCalendarFormHeader">
              <div>
                <h2>로운이 시간표</h2>
                <p>여러 시간표를 저장해두고 필요한 시간표만 달력에 적용해요.</p>
              </div>
              <div className="familyCalendarFormActions familyCalendarFormActionsInline">
                <button className="familyTaskActionButton" type="button" onClick={() => setShowTemplateList((current) => !current)}>
                  시간표 열기
                </button>
                <button className="familyTaskActionButton" type="button" onClick={saveOpenedTemplate}>
                  시간표 저장
                </button>
                <button className="familyTaskActionButton" type="button" onClick={startNewTemplate}>
                  새 시간표
                </button>
                <button className="familyTaskActionButton familyTaskActionButtonPrimary" type="button" onClick={startNewRoni}>
                  + 시간표
                </button>
                <Link className="familyTaskActionButton" href="/family/calendar">
                  취소
                </Link>
              </div>
            </div>

            <div className="familyRoniTemplateStatus">
              <p>현재 시간표: {openedTemplate?.name || FAMILY_RONI_DEFAULT_TEMPLATE_NAME}</p>
              {openedTemplateIsActive ? (
                <span>현재 적용 중</span>
              ) : (
                <button type="button" onClick={() => setConfirmApply(true)}>
                  이 시간표 적용
                </button>
              )}
              <small>달력 적용 시간표: {activeTemplateName}</small>
            </div>
            {templateError ? <p className="familyCalendarFormError">{templateError}</p> : null}

            {showTemplateList ? (
              <div className="familyRoniTemplateSheet" aria-label="시간표 열기">
                {templateState.templates.map((template) => (
                  <div className="familyRoniTemplateRow" key={template.id}>
                    <strong>{template.name}</strong>
                    {template.id === templateState.activeTemplateId ? <span>현재 적용 중</span> : null}
                    <button type="button" onClick={() => openTemplate(template.id)}>
                      열기
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {confirmApply ? (
              <div className="familyRoniApplyConfirm" role="dialog" aria-label="적용할까요?">
                <p>이 시간표를 달력에 적용할까요?</p>
                <button type="button" onClick={confirmApplyTemplate}>적용</button>
                <button type="button" onClick={() => setConfirmApply(false)}>취소</button>
              </div>
            ) : null}

            <div className="familyRoniList">
              {visibleItems.length ? (
                visibleItems.map((item) => (
                  <article className="familyRoniRow" key={item.id}>
                    <div>
                      <h3 style={{ fontFamily: getFamilyTimetableFontFamily(item.fontFamily) || undefined }}>{item.title}</h3>
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
                <p className="familyTaskEmpty">아직 로운이 시간표가 없어요.</p>
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
                <span>글씨체</span>
                <select value={draft.fontFamily} onChange={(event) => updateDraft("fontFamily", event.target.value)}>
                  {FAMILY_TIMETABLE_FONT_PRESETS.map((preset) => (
                    <option value={preset.value} key={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>

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
