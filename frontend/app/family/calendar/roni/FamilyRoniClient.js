"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import FamilyHeader from "../../FamilyHeader";
import {
  FAMILY_CALENDAR_WEEKDAY_OPTIONS,
  FAMILY_RONI_DEFAULT_TEMPLATE_NAME,
  createDefaultFamilyRoniItem,
  createFamilyCalendarId,
  createFamilyRounPlan,
  familyCalendarColorClassName,
  formatFamilyDateKey,
  loadFamilyRounState,
  normalizeFamilyRoniItem,
  saveFamilyRounState,
  updateFamilyRounPlanItems,
} from "../familyCalendarData.js";
import {
  FAMILY_TIMETABLE_DEFAULT_FONT,
  FAMILY_TIMETABLE_FONT_PRESETS,
  getFamilyTimetableFontFamily,
  normalizeFamilyTimetableFont,
} from "../../familyTimetableFonts.js";

const FAMILY_RONI_COLORS = [
  "pink",
  "rose",
  "cream",
  "yellow",
  "peach",
  "mint",
  "green",
  "sky",
  "blue",
  "purple",
  "lavender",
  "gray",
];

const FAMILY_RONI_COLOR_LABELS = {
  pink: "분홍",
  rose: "연분홍",
  cream: "크림",
  yellow: "노랑",
  peach: "살구",
  mint: "민트",
  green: "초록",
  sky: "하늘",
  blue: "파랑",
  purple: "보라",
  lavender: "라벤더",
  gray: "회색",
};

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

function todayDateKey() {
  return formatFamilyDateKey(new Date());
}

export default function FamilyRoniClient() {
  const [rounState, setRounState] = useState({ plans: [], assignments: [] });
  const [openedPlanId, setOpenedPlanId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [planError, setPlanError] = useState("");
  const [applyPlanId, setApplyPlanId] = useState("");
  const [applyDate, setApplyDate] = useState(todayDateKey());

  useEffect(() => {
    const loadedState = loadFamilyRounState();
    setRounState(loadedState);
    setOpenedPlanId(loadedState.plans[0]?.id || "");
    setLoaded(true);
  }, []);

  const openedPlan = useMemo(() => {
    return rounState.plans.find((plan) => plan.id === openedPlanId) || rounState.plans[0] || null;
  }, [openedPlanId, rounState.plans]);

  const visibleItems = useMemo(() => {
    return (openedPlan?.items || [])
      .filter((item) => item.active !== false)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || String(a.startTime).localeCompare(String(b.startTime)));
  }, [openedPlan]);

  const assignmentRows = useMemo(() => {
    return [...rounState.assignments]
      .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))
      .map((assignment) => ({
        ...assignment,
        planName: rounState.plans.find((plan) => plan.id === assignment.planId)?.name || FAMILY_RONI_DEFAULT_TEMPLATE_NAME,
      }));
  }, [rounState.assignments, rounState.plans]);

  function persistRounState(nextState) {
    const savedState = saveFamilyRounState(nextState);
    setRounState(savedState);
    return savedState;
  }

  function updateOpenedPlanItems(items) {
    if (!openedPlan) return;
    const nextState = updateFamilyRounPlanItems(rounState, openedPlan.id, items);
    persistRounState(nextState);
  }

  function startNewPlan() {
    const name = window.prompt("시간표 이름");
    if (name === null) return;
    if (!name.trim()) {
      setPlanError("시간표 이름을 입력해주세요.");
      return;
    }

    const nextPlan = createFamilyRounPlan(name.trim(), []);
    persistRounState({ ...rounState, plans: [...rounState.plans, nextPlan] });
    setOpenedPlanId(nextPlan.id);
    setDraft(null);
    setPlanError("");
  }

  function saveOpenedPlan() {
    if (!openedPlan?.name?.trim()) {
      setPlanError("시간표 이름을 입력해주세요.");
      return;
    }
    const now = new Date().toISOString();
    persistRounState({
      ...rounState,
      plans: rounState.plans.map((plan) => (
        plan.id === openedPlan.id
          ? { ...plan, name: plan.name.trim(), updatedAt: now }
          : plan
      )),
    });
    setPlanError("");
  }

  function openPlan(planId) {
    setOpenedPlanId(planId);
    setDraft(null);
    setError("");
    setPlanError("");
  }

  function copyPlan(plan) {
    const name = window.prompt("시간표 이름", `${plan.name} 복사`);
    if (name === null) return;
    if (!name.trim()) {
      setPlanError("시간표 이름을 입력해주세요.");
      return;
    }
    const copiedPlan = createFamilyRounPlan(name.trim(), plan.items || []);
    persistRounState({ ...rounState, plans: [...rounState.plans, copiedPlan] });
    setOpenedPlanId(copiedPlan.id);
    setPlanError("");
  }

  function deletePlan(planId) {
    if (rounState.plans.length <= 1) {
      setPlanError("마지막 시간표는 삭제할 수 없습니다.");
      return;
    }
    if (!window.confirm("삭제할까요?")) return;
    const nextPlans = rounState.plans.filter((plan) => plan.id !== planId);
    const nextAssignments = rounState.assignments.filter((assignment) => assignment.planId !== planId);
    const savedState = persistRounState({ plans: nextPlans, assignments: nextAssignments });
    setOpenedPlanId(savedState.plans[0]?.id || "");
    setDraft(null);
    setPlanError("");
  }

  function startApplyPlan(planId) {
    setApplyPlanId(planId);
    setApplyDate(todayDateKey());
  }

  function confirmApplyPlan() {
    if (!applyPlanId || !applyDate) return;
    const nextAssignment = {
      id: createFamilyCalendarId(),
      planId: applyPlanId,
      startDate: applyDate,
    };
    persistRounState({ ...rounState, assignments: [...rounState.assignments, nextAssignment] });
    setApplyPlanId("");
  }

  function deleteAssignment(assignmentId) {
    persistRounState({
      ...rounState,
      assignments: rounState.assignments.filter((assignment) => assignment.id !== assignmentId),
    });
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

    const currentItems = openedPlan?.items || [];
    const exists = currentItems.some((item) => item.id === normalized.id);
    const nextItems = exists
      ? currentItems.map((item) => (item.id === normalized.id ? normalized : item))
      : [...currentItems, normalized];
    updateOpenedPlanItems(nextItems);
    cancelEdit();
  }

  function deleteRoni(itemId = draft?.id) {
    if (!itemId || !openedPlan) return;
    updateOpenedPlanItems((openedPlan.items || []).filter((item) => item.id !== itemId));
    if (draft?.id === itemId) cancelEdit();
  }

  if (!loaded) return null;

  return (
    <section className="familyPage" aria-label="로운이">
      <div className="familyCard familyCalendarPageCard">
        <FamilyHeader active="roun" />
        <main className="familyCalendarFormPage">
          <section className="familyRoniPanel">
            <div className="familyCalendarFormHeader">
              <div>
                <h2>로운이</h2>
                <p>주간시간표를 여러 개 저장하고, 날짜별 적용 이력으로 달력에 반영해요.</p>
              </div>
              <div className="familyCalendarFormActions familyCalendarFormActionsInline">
                <button className="familyTaskActionButton" type="button" onClick={saveOpenedPlan}>
                  시간표 저장
                </button>
                <button className="familyTaskActionButton" type="button" onClick={startNewPlan}>
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

            {planError ? <p className="familyCalendarFormError">{planError}</p> : null}

            <div className="familyRoniTemplateSheet" aria-label="주간시간표 목록">
              {rounState.plans.length ? rounState.plans.map((plan) => (
                <div className="familyRoniTemplateRow" key={plan.id}>
                  <strong>{plan.name}</strong>
                  <div className="familyRoniTemplateActions">
                    <button type="button" onClick={() => openPlan(plan.id)}>고치기</button>
                    <button type="button" onClick={() => copyPlan(plan)}>복사</button>
                    <button type="button" onClick={() => startApplyPlan(plan.id)}>적용하기</button>
                    <button type="button" onClick={() => deletePlan(plan.id)}>삭제</button>
                  </div>
                </div>
              )) : (
                <div className="familyRoniTemplateEmpty">
                  <p>아직 시간표가 없습니다.</p>
                  <button type="button" onClick={startNewPlan}>새 시간표</button>
                </div>
              )}
            </div>

            {applyPlanId ? (
              <div className="familyRoniApplyConfirm" role="dialog" aria-label="적용할까요?">
                <label>
                  <span>몇년 몇월 몇일부터 적용할까요?</span>
                  <input type="date" value={applyDate} onChange={(event) => setApplyDate(event.target.value)} />
                </label>
                <button type="button" onClick={confirmApplyPlan}>적용</button>
                <button type="button" onClick={() => setApplyPlanId("")}>취소</button>
              </div>
            ) : null}

            <div className="familyRoniTemplateStatus">
              <p>주간시간표: {openedPlan?.name || FAMILY_RONI_DEFAULT_TEMPLATE_NAME}</p>
            </div>

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

          <section className="familyRoniPanel" aria-label="적용 이력">
            <div className="familyCalendarFormHeader">
              <h2>적용 이력</h2>
            </div>
            <div className="familyRoniTemplateSheet">
              {assignmentRows.length ? assignmentRows.map((assignment) => (
                <div className="familyRoniTemplateRow" key={assignment.id}>
                  <strong>{assignment.planName}</strong>
                  <span>{assignment.startDate} ~</span>
                  <div className="familyRoniTemplateActions">
                    <button type="button" onClick={() => deleteAssignment(assignment.id)}>삭제</button>
                  </div>
                </div>
              )) : <p className="familyTaskEmpty">적용 이력이 없습니다.</p>}
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

              <div className="familyTimetableColorField">
                <span>색상</span>
                <div className="familyTimetableColorChips" role="radiogroup" aria-label="색상">
                  {FAMILY_RONI_COLORS.map((color) => (
                    <button
                      aria-label={FAMILY_RONI_COLOR_LABELS[color]}
                      className={`familyTimetableColorChip familyTimetableColorChip${familyCalendarColorClassName(color)}${draft.color === color ? " familyTimetableColorChipActive" : ""}`}
                      key={color}
                      onClick={() => updateDraft("color", color)}
                      title={FAMILY_RONI_COLOR_LABELS[color]}
                      type="button"
                    />
                  ))}
                </div>
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
