"use client";

import { useState } from "react";
import Link from "next/link";
import ReminderActions from "./ReminderActions";
import { UI_STRINGS } from "../lib/strings";

export default function ReminderDetailPanel({ item }) {
  const isRemoved = item.status === "removed";
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onCopyId() {
    try {
      await navigator.clipboard.writeText(item.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <main className="page">
      <div className="detailBackLinkRow">
        <Link className="taskLink backLink" href="/reminders">
          {UI_STRINGS.BACK_TO_REMINDERS_LIST}
        </Link>
      </div>

      <section className="panel">
        <div className="detailPageLabel">• {UI_STRINGS.REMINDER_DETAIL}</div>

        <div className="detailTitleRow">
          <div className="sectionTitle detailMainTitle">{item.title}</div>
          <div className="detailStateText">{isRemoved ? UI_STRINGS.REMOVED_STATE : item.state}</div>
        </div>

        <div className="detailReadBlock">
          <div className="detailReadRow">
            <div className="detailReadIcon">⏰</div>
            <div className="detailReadContent">{item.snoozed_until_display || item.remind_at_display || "-"}</div>
          </div>
        </div>
      </section>

      {!isRemoved && (item.state === "fired" || item.state === "missed") ? (
        <section className="panel">
          <ReminderActions reminderId={item.id} state={item.state} />
        </section>
      ) : null}

      <section className="panel">
        <div className="actionRow detailActionRow">
          <button type="button" className={"button" + (showMore ? " buttonActive" : "")} onClick={() => setShowMore((v) => !v)}>
            {UI_STRINGS.MORE_BUTTON}
          </button>
        </div>
        {showMore ? (
          <div className="toggleBody moreMetaBox">
            <div className="metaStack">
              <div>{UI_STRINGS.CREATED}: {item.created_at_display || "-"}</div>
              <div>{UI_STRINGS.UPDATED}: {item.updated_at_display || "-"}</div>
              <div className="copyRow">
                <button type="button" className="button" onClick={onCopyId}>
                  {copied ? UI_STRINGS.COPIED : UI_STRINGS.COPY_ID}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
