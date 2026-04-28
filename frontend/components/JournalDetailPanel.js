"use client";

import { useState } from "react";
import Link from "next/link";
import LinkedItemsBlock from "./LinkedItemsBlock";
import { UI_STRINGS } from "../lib/strings";

export default function JournalDetailPanel({ item }) {
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
        <Link className="taskLink backLink" href="/journals">
          {"< Back to Journals List"}
        </Link>
      </div>

      <section className="panel">
        <div className="detailPageLabel">• Journal Detail</div>
        <div className="detailTitleRow">
          <div className="sectionTitle detailMainTitle">
            {item.created_at_display || item.created_at || "Journal Entry"}
          </div>
          <div className="detailStateText">{item.status}</div>
        </div>

        <div className="detailReadBlock">
          {item.tags?.length ? (
            <div className="detailReadRow">
              <div className="detailReadLabel">Tags</div>
              <div className="detailReadContent withDivider">{item.tags.map((tag) => `#${tag}`).join(" ")}</div>
            </div>
          ) : null}

          <div className="detailReadRow">
            <div className="detailReadLabel">Body</div>
            <div className="detailReadContent detailReadMemo withDivider">
              {String(item.body || "")
                .split("\n")
                .map((line, idx) => (
                  <div key={idx}>{line || "\u00A0"}</div>
                ))}
            </div>
          </div>

          <LinkedItemsBlock links={item.links} />
        </div>
      </section>

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
