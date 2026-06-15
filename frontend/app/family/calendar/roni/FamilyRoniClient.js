"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import FamilyHeader from "../../FamilyHeader";
import {
  FAMILY_CALENDAR_DAY_LABELS,
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

const ROUN_TIMETABLE_START_HOUR = 8;
const ROUN_TIMETABLE_END_HOUR = 22;
const ROUN_TIMETABLE_SLOT_MINUTES = 10;
const ROUN_TIMETABLE_DEFAULT_DURATION_MINUTES = 40;
const ROUN_TIMETABLE_HOUR_HEIGHT = 48;
const ROUN_TIMETABLE_DRAG_MOVE_LIMIT = 8;
const ROUN_TIMETABLE_HOURS = Array.from(
  { length: ROUN_TIMETABLE_END_HOUR - ROUN_TIMETABLE_START_HOUR + 1 },
  (_, index) => ROUN_TIMETABLE_START_HOUR + index,
);
const ROUN_TIMETABLE_VISIBLE_HOURS = ROUN_TIMETABLE_HOURS.slice(0, -1);
const ROUN_TIMETABLE_BODY_HEIGHT =
  (ROUN_TIMETABLE_END_HOUR - ROUN_TIMETABLE_START_HOUR) * ROUN_TIMETABLE_HOUR_HEIGHT;

function parseTimeMinutes(timeString) {
  const match = String(timeString || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function minutesToFamilyTime(totalMinutes) {
  const minutesInDay = 24 * 60;
  const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function snapRounMinutes(totalMinutes) {
  return Math.floor(totalMinutes / ROUN_TIMETABLE_SLOT_MINUTES) * ROUN_TIMETABLE_SLOT_MINUTES;
}

function slotMinutesFromPoint(clientY, rect) {
  const y = Math.max(0, Math.min(rect.height - 1, clientY - rect.top));
  const minutesFromStart = Math.floor(y / ROUN_TIMETABLE_HOUR_HEIGHT * 60);
  return ROUN_TIMETABLE_START_HOUR * 60 + snapRounMinutes(minutesFromStart);
}

function roniToDraft(item, slotIndex = 0) {
  const slots = Array.isArray(item.slots) && item.slots.length ? item.slots : [item];
  const slot = slots[slotIndex] || slots[0] || item;
  return {
    id: item.id || "",
    slotIndex,
    title: item.title || "",
    dayOfWeek: String(slot.dayOfWeek ?? item.dayOfWeek ?? 0),
    startTime: slot.startTime || item.startTime || "09:00",
    endTime: slot.endTime || item.endTime || "09:40",
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

function buildRounBlocks(items) {
  return items.flatMap((item) => {
    const slots = Array.isArray(item.slots) && item.slots.length ? item.slots : [item];
    return slots.flatMap((slot, slotIndex) => {
      const start = parseTimeMinutes(slot.startTime || item.startTime);
      const end = parseTimeMinutes(slot.endTime || item.endTime);
      const dayOfWeek = Number(slot.dayOfWeek ?? item.dayOfWeek);
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || start === null) return [];
      const safeStart = Math.max(ROUN_TIMETABLE_START_HOUR * 60, Math.min(ROUN_TIMETABLE_END_HOUR * 60 - 10, start));
      const safeEnd = end && end > safeStart ? Math.min(ROUN_TIMETABLE_END_HOUR * 60, end) : safeStart + ROUN_TIMETABLE_DEFAULT_DURATION_MINUTES;
      return [{
        ...item,
        blockId: `${item.id}:${slotIndex}`,
        slotIndex,
        dayOfWeek,
        startTime: minutesToFamilyTime(safeStart),
        endTime: minutesToFamilyTime(safeEnd),
        startMinutes: safeStart,
        endMinutes: safeEnd,
      }];
    });
  });
}

function rounBlockStyle(block) {
  const rangeStart = ROUN_TIMETABLE_START_HOUR * 60;
  const top = (block.startMinutes - rangeStart) / 60 * ROUN_TIMETABLE_HOUR_HEIGHT;
  const height = Math.max(20, (block.endMinutes - block.startMinutes) / 60 * ROUN_TIMETABLE_HOUR_HEIGHT);
  return { top: `${top}px`, height: `${height}px`, fontFamily: getFamilyTimetableFontFamily(block.fontFamily) || undefined };
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
  const [actionBlock, setActionBlock] = useState(null);
  const [dragState, setDragState] = useState(null);
  const suppressBlockClickRef = useRef(false);

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

  const visibleBlocks = useMemo(() => buildRounBlocks(visibleItems), [visibleItems]);

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
    setActionBlock(null);
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
    setActionBlock(null);
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

  function draftForSlot(dayOfWeek, startMinutes) {
    const startTime = minutesToFamilyTime(startMinutes);
    const endTime = minutesToFamilyTime(startMinutes + ROUN_TIMETABLE_DEFAULT_DURATION_MINUTES);
    return roniToDraft({
      ...createDefaultFamilyRoniItem(),
      dayOfWeek,
      startTime,
      endTime,
      slots: [{ dayOfWeek, startTime, endTime }],
    });
  }

  function startNewRoni(dayOfWeek = new Date().getDay(), startMinutes = ROUN_TIMETABLE_START_HOUR * 60 + 60) {
    setDraft(draftForSlot(dayOfWeek, startMinutes));
    setActionBlock(null);
    setError("");
  }

  function startEditRoni(block) {
    setDraft(roniToDraft(block, block.slotIndex));
    setActionBlock(null);
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

  function replaceItemSlot(item, slotIndex, slotValues) {
    const currentSlots = Array.isArray(item.slots) && item.slots.length ? item.slots : [{
      dayOfWeek: item.dayOfWeek,
      startTime: item.startTime,
      endTime: item.endTime,
    }];
    const nextSlots = currentSlots.map((slot, index) => (index === slotIndex ? { ...slot, ...slotValues } : slot));
    const firstSlot = nextSlots[0];
    return {
      ...item,
      dayOfWeek: firstSlot.dayOfWeek,
      startTime: firstSlot.startTime,
      endTime: firstSlot.endTime,
      slots: nextSlots,
    };
  }

  function saveRoni(event) {
    event.preventDefault();
    if (!draft?.title?.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }

    const slotValues = {
      dayOfWeek: Number(draft.dayOfWeek),
      startTime: draft.startTime,
      endTime: draft.endTime,
    };
    const normalized = normalizeFamilyRoniItem({
      ...draft,
      title: draft.title.trim(),
      dayOfWeek: slotValues.dayOfWeek,
      startTime: slotValues.startTime,
      endTime: slotValues.endTime,
      slots: [slotValues],
      fontFamily: normalizeFamilyTimetableFont(draft.fontFamily),
    });
    if (!normalized) {
      setError("제목을 입력해주세요.");
      return;
    }

    const currentItems = openedPlan?.items || [];
    const exists = currentItems.some((item) => item.id === normalized.id);
    const nextItems = exists
      ? currentItems.map((item) => {
        if (item.id !== normalized.id) return item;
        return replaceItemSlot({
          ...item,
          title: normalized.title,
          memo: normalized.memo,
          color: normalized.color,
          fontFamily: normalized.fontFamily,
          active: normalized.active,
        }, draft.slotIndex || 0, slotValues);
      })
      : [...currentItems, normalized];
    updateOpenedPlanItems(nextItems);
    cancelEdit();
  }

  function deleteRoni(itemId = draft?.id) {
    if (!itemId || !openedPlan) return;
    if (!window.confirm("삭제할까요?")) return;
    updateOpenedPlanItems((openedPlan.items || []).filter((item) => item.id !== itemId));
    if (draft?.id === itemId) cancelEdit();
    if (actionBlock?.id === itemId) setActionBlock(null);
  }

  function copyRoni(block) {
    if (!openedPlan || !block) return;
    const copy = normalizeFamilyRoniItem({
      ...block,
      id: createFamilyCalendarId(),
      title: block.title,
      slots: [{ dayOfWeek: block.dayOfWeek, startTime: block.startTime, endTime: block.endTime }],
    });
    if (!copy) return;
    updateOpenedPlanItems([...(openedPlan.items || []), copy]);
    setActionBlock(null);
  }

  function updateBlockTime(block, dayOfWeek, startMinutes) {
    if (!openedPlan || !block) return;
    const duration = Math.max(
      ROUN_TIMETABLE_SLOT_MINUTES,
      (parseTimeMinutes(block.endTime) ?? block.startMinutes + ROUN_TIMETABLE_DEFAULT_DURATION_MINUTES) - block.startMinutes,
    );
    const slotValues = {
      dayOfWeek,
      startTime: minutesToFamilyTime(startMinutes),
      endTime: minutesToFamilyTime(startMinutes + duration),
    };
    const nextItems = (openedPlan.items || []).map((item) => (
      item.id === block.id ? replaceItemSlot(item, block.slotIndex, slotValues) : item
    ));
    updateOpenedPlanItems(nextItems);
  }

  function targetFromPoint(clientX, clientY) {
    const elements = document.elementsFromPoint(clientX, clientY);
    const column = elements.find((element) => element instanceof HTMLElement && element.dataset.rounDayColumn);
    if (!column) return null;
    const dayOfWeek = Number(column.dataset.dayIndex);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null;
    return { dayOfWeek, startMinutes: slotMinutesFromPoint(clientY, column.getBoundingClientRect()) };
  }

  function startBlockDrag(event, block) {
    if (event.button !== undefined && event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragState({ block, startX: event.clientX, startY: event.clientY, moved: false, target: null });
  }

  function moveBlockDrag(event) {
    if (!dragState) return;
    const moved = dragState.moved || Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) >= ROUN_TIMETABLE_DRAG_MOVE_LIMIT;
    if (!moved) return;
    event.preventDefault();
    setDragState({ ...dragState, moved, target: targetFromPoint(event.clientX, event.clientY) });
  }

  function finishBlockDrag(event) {
    if (!dragState) return;
    event.preventDefault();
    if (dragState.moved && dragState.target) {
      updateBlockTime(dragState.block, dragState.target.dayOfWeek, dragState.target.startMinutes);
      suppressBlockClickRef.current = true;
      window.setTimeout(() => {
        suppressBlockClickRef.current = false;
      }, 0);
    }
    setDragState(null);
  }

  function clickEmptySlot(event, dayOfWeek) {
    if (event.target !== event.currentTarget) return;
    const startMinutes = slotMinutesFromPoint(event.clientY, event.currentTarget.getBoundingClientRect());
    startNewRoni(dayOfWeek, startMinutes);
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
                <p>주간시간표 템플릿을 여러 개 저장하고, 날짜별 적용 이력으로 달력에 반영해요.</p>
              </div>
              <div className="familyCalendarFormActions familyCalendarFormActionsInline">
                <button className="familyTaskActionButton" type="button" onClick={saveOpenedPlan}>
                  시간표 저장
                </button>
                <button className="familyTaskActionButton" type="button" onClick={startNewPlan}>
                  새 시간표
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
              <small>이 시간표는 달력 생성에 사용됩니다.</small>
            </div>

            <div className="familyRounEditorToolbar">
              <button className="familyTaskActionButton familyTaskActionButtonPrimary" type="button" onClick={() => startNewRoni()}>
                + 시간표
              </button>
            </div>

            <div
              className="familyRounWeeklyGrid"
              aria-label="주간시간표 템플릿"
              onPointerMove={moveBlockDrag}
              onPointerUp={finishBlockDrag}
              onPointerCancel={() => setDragState(null)}
              style={{ "--family-roun-body-height": `${ROUN_TIMETABLE_BODY_HEIGHT}px` }}
            >
              <span className="familyRounGridCorner" aria-hidden="true" />
              {FAMILY_CALENDAR_DAY_LABELS.map((label) => (
                <span className="familyRounDayHeader" key={label}>{label}</span>
              ))}
              <div className="familyRounTimeRail" aria-label="시간">
                {ROUN_TIMETABLE_HOURS.map((hour) => (
                  <span className="familyRounHourLabel" key={hour} style={{ top: `${(hour - ROUN_TIMETABLE_START_HOUR) * ROUN_TIMETABLE_HOUR_HEIGHT}px` }}>
                    {String(hour).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
              {FAMILY_CALENDAR_DAY_LABELS.map((label, dayIndex) => (
                <div
                  className={`familyRounDayColumn${dragState?.target?.dayOfWeek === dayIndex ? " familyRounDayColumnTarget" : ""}`}
                  data-day-index={dayIndex}
                  data-roun-day-column="true"
                  key={label}
                  onClick={(event) => clickEmptySlot(event, dayIndex)}
                >
                  {ROUN_TIMETABLE_VISIBLE_HOURS.map((hour) => (
                    <div className="familyRounHour" key={hour} style={{ top: `${(hour - ROUN_TIMETABLE_START_HOUR) * ROUN_TIMETABLE_HOUR_HEIGHT}px` }}>
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ))}
                  {visibleBlocks.filter((block) => block.dayOfWeek === dayIndex).map((block) => (
                    <button
                      className={`familyRounBlock familyTimetableEntry${familyCalendarColorClassName(block.color)}${dragState?.block?.blockId === block.blockId ? " familyRounBlockDragging" : ""}`}
                      key={block.blockId}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (suppressBlockClickRef.current) return;
                        setActionBlock(block);
                      }}
                      onPointerDown={(event) => startBlockDrag(event, block)}
                      style={rounBlockStyle(block)}
                      title={`${block.title} ${block.startTime}-${block.endTime}`}
                      type="button"
                    >
                      <span>{block.title}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {actionBlock ? (
              <div className="familyRounActionSheet" role="dialog" aria-label="시간표 항목">
                <p>{actionBlock.title}</p>
                <button type="button" onClick={() => startEditRoni(actionBlock)}>고치기</button>
                <button type="button" onClick={() => copyRoni(actionBlock)}>복사</button>
                <button type="button" onClick={() => deleteRoni(actionBlock.id)}>삭제</button>
                <button type="button" onClick={() => setActionBlock(null)}>취소</button>
              </div>
            ) : null}
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
                <span>제목</span>
                <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
              </label>
              {error ? <p className="familyCalendarFormError">{error}</p> : null}

              <div className="familyCalendarFormGrid">
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
