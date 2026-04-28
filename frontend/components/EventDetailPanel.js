"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EventRawEditor from "./EventRawEditor";
import LinkedItemsBlock from "./LinkedItemsBlock";

export default function EventDetailPanel({ item, raw }) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  async function onRemove() {
    if (!window.confirm("Move this event to Removed?")) return;
    if (isRemoving) return;
    setIsRemoving(true);
    setRemoveError("");
    try {
      const res = await fetch(`/api/events/${item.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setRemoveError((data && data.error) || "Event remove failed.");
        return;
      }
      router.push("/events");
      router.refresh();
    } catch {
      setRemoveError("Event remove failed.");
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
          <div className="detailStateText">{item.status}</div>
        </div>

        {item.tags?.length ? <div className="metaLine">{item.tags.map((tag) => `#${tag}`).join(" ")}</div> : null}

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
          <button type="button" className={"button" + (showEdit ? " buttonActive" : "")} onClick={() => setShowEdit((v) => !v)}>Edit</button>
          <button type="button" className={"button" + (showMore ? " buttonActive" : "")} onClick={() => setShowMore((v) => !v)}>More</button>
        </div>
        {showEdit ? <div className="toggleBody"><EventRawEditor eventId={item.id} initialRaw={raw || ""} /></div> : null}
        {showMore ? (
          <div className="toggleBody moreMetaBox">
            <div className="metaStack">
              <div>created: {item.created_at_display || "-"}</div>
              <div>updated: {item.updated_at_display || "-"}</div>
            </div>
            <div className="moreActionRow">
              <button type="button" className="button" onClick={onCopyId}>
                {copied ? "ID copied" : "Copy ID"}
              </button>
              <button type="button" className="button" onClick={onRemove} disabled={isRemoving}>{isRemoving ? "..." : "Remove"}</button>
            </div>
            {removeError ? <div className="errorText">{removeError}</div> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
