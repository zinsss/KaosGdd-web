"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EventRawEditor from "./EventRawEditor";
import LinkedItemsBlock from "./LinkedItemsBlock";
import { UI_STRINGS } from "../lib/strings";

function isSystemHoliday(item) {
  const tags = new Set((item.tags || []).map((tag) => String(tag || "").toLowerCase()));
  return tags.has("system:kr-holiday") && tags.has("readonly");
}

function visibleTags(item) {
  return (item.tags || []).filter((tag) => {
    const clean = String(tag || "").toLowerCase();
    return clean !== "system:kr-holiday" && clean !== "readonly" && !clean.startsWith("kr-holiday:");
  });
}

export default function EventDetailPanel({ item, raw }) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const readonlyHoliday = isSystemHoliday(item);
  const displayTags = visibleTags(item);

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
                <span className="detailBadge holidayBadge">{UI_STRINGS.HOLIDAY_BADGE}</span>
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
          {item.memo ? <div className="detailReadRow"><div className="detailReadLabel">Memo</div><div className="detailReadContent detailReadMemo withDivider">{item.memo}</div></div> : null}
          {item.reminders?.[0] ? (
            <div className="detailReadRow">
              <div className="detailReadLabel">Reminder</div>
              <div className="detailReadContent withDivider">{item.reminders[0].remind_at_display || item.reminders[0].remind_at} ({item.reminders[0].state})</div>
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
