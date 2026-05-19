"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UI_STRINGS } from "../../lib/strings";
import { captureCreatedEventHasType } from "../../lib/post-create-navigation";

export default function NotesPageClient() {
  const [items, setItems] = useState([]);

  function loadNotes() {
    fetch("/api/notes", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]));
  }

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    function onCaptureCreated(event) {
      if (captureCreatedEventHasType(event, "note")) loadNotes();
    }

    window.addEventListener("kaosgdd:capture-created", onCaptureCreated);
    return () => window.removeEventListener("kaosgdd:capture-created", onCaptureCreated);
  }, []);

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitle">{UI_STRINGS.NOTES}</div>
        {items.length === 0 ? (
          <div className="empty">{UI_STRINGS.NO_NOTES}</div>
        ) : (
          <ul className="taskList">
            {items.map((item) => (
              <li key={item.id} className="taskListRow">
                <Link href={`/notes/${item.id}`} className="taskLink taskListTitleLink">{item.title || "Untitled note"}</Link>
                {item.snippet ? <div className="metaLine">{item.snippet}</div> : null}
                <div className="metaLine">{item.updated_at_display || item.updated_at}</div>
                {item.tags?.length ? <div className="metaLine">{item.tags.slice(0, 4).map((tag) => `#${tag}`).join(" ")}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
