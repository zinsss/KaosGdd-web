"use client";

import Link from "next/link";
import { useState } from "react";

import FaxInboxActions from "./FaxInboxActions";

function badgeLabel(item) {
  return item.direction === "incoming" ? "Incoming" : "Outgoing";
}

function canSaveToFiles(item) {
  return item.direction === "incoming" && item.fax_status === "received" && !item.saved_file_id;
}

function faxStatusClassName(status) {
  if (status === "sent") return "faxStatusPill faxStatusPillSent";
  if (status === "failed") return "faxStatusPill faxStatusPillFailed";
  return "faxStatusPill";
}

export default function FaxInboxList({ items }) {
  const [expandedId, setExpandedId] = useState("");

  return (
    <ul className="taskList">
      {items.map((item) => {
        const expanded = expandedId === item.id;
        return (
          <li key={item.id} className="taskListRow">
            <button
              className="faxInboxItemSummary"
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpandedId(expanded ? "" : item.id)}
            >
              <div className="eventListTitleRow">
                <span className="eventSystemBadge eventObservanceBadge">{badgeLabel(item)}</span>
                <span className={faxStatusClassName(item.fax_status)}>{item.fax_status}</span>
                <span className="taskListTitleLink">{item.title || "Fax"}</span>
              </div>
              <div className="metaLine">
                {item.remote_number || ""}
                {item.saved_file_id ? " • saved to Files" : ""}
                {item.remote_number || item.saved_file_id ? " • " : ""}
                {item.received_at_display || item.sent_at_display || item.created_at_display || item.created_at}
              </div>
            </button>
            {expanded ? (
              <div className="faxInboxExpandedActions">
                <Link href={`/fax/${item.id}`} className="button buttonToneNeutral">Details</Link>
                <FaxInboxActions
                  faxId={item.id}
                  canSave={canSaveToFiles(item)}
                  savedFileId={item.saved_file_id}
                  compact
                  showOpenDownload
                  pdfAvailable={Boolean(item.pdf_available)}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
