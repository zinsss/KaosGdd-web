"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { captureCreatedEventHasType } from "../../lib/post-create-navigation";
import { UI_STRINGS } from "../../lib/strings";

function formatBytes(value) {
  const size = Number(value || 0);

  if (!Number.isFinite(size) || size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPageClient() {
  const [items, setItems] = useState([]);
  const [shareFeedback, setShareFeedback] = useState("");

  async function loadFiles() {
    try {
      const res = await fetch("/api/files", { cache: "no-store" });
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    const feedback = window.sessionStorage.getItem("kaosgdd_share_feedback");
    if (feedback) {
      setShareFeedback(feedback);
      window.sessionStorage.removeItem("kaosgdd_share_feedback");
    }

    loadFiles();
  }, []);

  useEffect(() => {
    function onCaptureCreated(event) {
      if (captureCreatedEventHasType(event, "file")) loadFiles();
    }

    window.addEventListener("kaosgdd:capture-created", onCaptureCreated);
    return () => window.removeEventListener("kaosgdd:capture-created", onCaptureCreated);
  }, []);

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitle">{UI_STRINGS.FILES}</div>
        <div className="metaLine" style={{ marginBottom: 10 }}>{UI_STRINGS.TOP_CAPTURE_FILE_HINT}</div>
        {shareFeedback ? <div className="subline">{shareFeedback}</div> : null}

        {items.length === 0 ? (
          <div className="empty">No files.</div>
        ) : (
          <ul className="taskList">
            {items.map((item) => (
              <li key={item.id} className="taskListRow">
                <Link href={`/files/${item.id}`} className="taskLink taskListTitleLink">
                  {item.title || item.original_filename}
                </Link>
                <div className="metaLine">
                  {item.original_filename || "-"} • {item.mime_type || "application/octet-stream"} • {formatBytes(item.size_bytes)} •{" "}
                  {item.created_at_display || item.created_at}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
