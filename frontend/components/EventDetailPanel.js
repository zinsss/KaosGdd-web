"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EventRawEditor from "./EventRawEditor";
import LinkedItemsBlock from "./LinkedItemsBlock";
import { UI_STRINGS } from "../lib/strings";

function isSystemHoliday(item) {
  return item.is_readonly_system_event || false;
}

function badgeForEvent(item) {
  if (item.event_class === "public-holiday") return { label: UI_STRINGS.HOLIDAY_BADGE, className: "holidayBadge" };
  if (item.event_class === "market-saturday") return { label: UI_STRINGS.MARKET_BADGE, className: "marketBadge" };
  if (item.event_class === "claim-day") return { label: UI_STRINGS.CLAIM_BADGE, className: "claimBadge" };
  if (item.is_imported_calendar_event) return { label: UI_STRINGS.EVENT_BADGE, className: "observanceBadge" };
  return null;
}

function visibleTags(item) {
  return (item.tags || []).filter((tag) => {
    const clean = String(tag || "").toLowerCase();
    return (
      clean !== "system:kr-holiday" &&
      clean !== "system:kr-calendar" &&
      clean !== "system:custom-calendar" &&
      clean !== "readonly" &&
      !clean.startsWith("kr-holiday:") &&
      !clean.startsWith("custom-calendar:") &&
      !clean.startsWith("event-class:") &&
      !clean.startsWith("classification-source:") &&
      !clean.startsWith("repeat:")
    );
  });
}

function stableEventActionId(item) {
  return item.local_event_id || item.kaos_event_id || item.canonical_event_id || item.id || "";
}

export default function EventDetailPanel({ item, raw, occurrenceDate = "" }) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationError, setClassificationError] = useState("");
  const readonlyHoliday = isSystemHoliday(item);
  const systemBadge = badgeForEvent(item);
  const isImportedCalendarEvent = item.is_imported_calendar_event || false;
  const isPublicHoliday = item.event_class === "public-holiday";
  const publicHolidayEventId = stableEventActionId(item);
  const publicHolidayActionAvailable = Boolean(publicHolidayEventId) && !String(publicHolidayEventId).includes(":");
  const displayTags = visibleTags(item);
  const hasOccurrenceContext = Boolean(item.repeat_rule && occurrenceDate && occurrenceDate !== item.start_date);

  async function onRemove() {
    if (!window.confirm(UI_STRINGS.REMOVE_EVENT_CONFIRM)) return;
    if (isRemoving) return;
    setIsRemoving(true);
    setRemoveError("");
    try {
      const res = await fetch(`/api/events/${item.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setRemoveError((data && data.error) || UI_STRINGS.EVENT_REMOVE_FAILED);
        return;
      }
      router.push("/events");
      router.refresh();
    } catch {
      setRemoveError(UI_STRINGS.EVENT_REMOVE_FAILED);
    } finally {
      setIsRemoving(false);
    }
  }

  async function onCopyId() {
    try {
      await navigator.clipboard.writeText(item.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  async function onClassificationChange(event) {
    const checked = event.target.checked;
    if (!publicHolidayActionAvailable) {
      setClassificationError("event_not_persisted");
      return;
    }
    setIsClassifying(true);
    setClassificationError("");
    try {
      const res = await fetch(`/api/events/${publicHolidayEventId}/classification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public_holiday: checked, event_id: publicHolidayEventId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setClassificationError((data && data.error) || UI_STRINGS.CLASSIFICATION_SAVE_FAILED);
        return;
      }
      router.refresh();
    } catch {
      setClassificationError(UI_STRINGS.CLASSIFICATION_SAVE_FAILED);
    } finally {
      setIsClassifying(false);
    }
  }

  return (
    <main className="page">
      <div className="detailBackLinkRow"><Link className="taskLink backLink" href="/events">&lt; Back to Events</Link></div>

      <section className="panel">
        <div className="detailPageLabel">• Event Detail</div>
        <div className="detailTitleRow">
          <div className="sectionTitle detailMainTitle">{item.title}</div>
          <div className="detailStateBox">
            <div className="detailStateText">{item.status}</div>
            {readonlyHoliday ? (
              <div className="detailBadgeRow">
                {systemBadge ? <span className={"detailBadge " + systemBadge.className}>{systemBadge.label}</span> : null}
                <span className="detailBadge readonlyBadge">{UI_STRINGS.READONLY_BADGE}</span>
              </div>
            ) : null}
          </div>
        </div>

        {displayTags.length ? <div className="metaLine">{displayTags.map((tag) => `#${tag}`).join(" ")}</div> : null}

        <div className="detailReadBlock">
          <div className="detailReadRow">
            <div className="detailReadLabel">Date</div>
            <div className="detailReadContent withDivider">{item.start_date_display}{item.end_date_display ? ` ~ ${item.end_date_display}` : ""}</div>
          </div>
          {item.repeat_rule ? (
            <div className="detailReadRow">
              <div className="detailReadLabel">Repeat</div>
              <div className="detailReadContent withDivider">↻ {item.repeat_rule}</div>
            </div>
          ) : null}
          {hasOccurrenceContext ? (
            <div className="detailReadRow">
              <div className="detailReadLabel">Occurrence</div>
              <div className="detailReadContent withDivider">{occurrenceDate}</div>
            </div>
          ) : null}
          {item.memo ? <div className="detailReadRow"><div className="detailReadLabel">Memo</div><div className="detailReadContent detailReadMemo withDivider">{item.memo}</div></div> : null}
          {item.reminders?.[0] ? (
            <div className="detailReadRow">
              <div className="detailReadLabel">Reminder</div>
              <div className="detailReadContent withDivider">{item.reminders[0].remind_at_display || item.reminders[0].remind_at} ({item.reminders[0].state})</div>
            </div>
          ) : null}
          {isImportedCalendarEvent ? (
            <div className="detailReadRow">
              <div className="detailReadLabel">Class</div>
              <div className="detailReadContent withDivider">
                <label className="checkboxLine">
                  <input
                    type="checkbox"
                    checked={isPublicHoliday}
                    onChange={onClassificationChange}
                    disabled={isClassifying || !publicHolidayActionAvailable}
                  />
                  <span>{UI_STRINGS.PUBLIC_HOLIDAY_LABEL}</span>
                </label>
                {classificationError ? <div className="errorText">{classificationError}</div> : null}
              </div>
            </div>
          ) : null}
          <LinkedItemsBlock links={item.links} />
        </div>
      </section>

      <section className="panel">
        <div className="actionRow detailActionRow">
          {!readonlyHoliday ? (
            <button type="button" className={"button buttonToneEdit" + (showEdit ? " buttonActive" : "")} onClick={() => setShowEdit((v) => !v)}>Edit</button>
          ) : null}
          <button type="button" className={"button buttonToneNeutral" + (showMore ? " buttonActive" : "")} onClick={() => setShowMore((v) => !v)}>More</button>
        </div>
        {showEdit && !readonlyHoliday ? <div className="toggleBody"><EventRawEditor eventId={item.id} initialRaw={raw || ""} /></div> : null}
        {showMore ? (
          <div className="toggleBody moreMetaBox">
            {readonlyHoliday ? <div className="metaLine">{UI_STRINGS.READONLY_EVENT_NOTICE}</div> : null}
            <div className="metaStack">
              <div>created: {item.created_at_display || "-"}</div>
              <div>updated: {item.updated_at_display || "-"}</div>
            </div>
            <div className="moreActionRow">
              <button type="button" className="button buttonToneCopy" onClick={onCopyId}>
                {copied ? "ID copied" : "Copy ID"}
              </button>
              {!readonlyHoliday ? (
                <button type="button" className="button buttonToneDanger" onClick={onRemove} disabled={isRemoving}>{isRemoving ? "..." : "Remove"}</button>
              ) : null}
            </div>
            {removeError ? <div className="errorText">{removeError}</div> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
