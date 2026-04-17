"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UI_STRINGS } from "../../lib/strings";

export default function NotesPageClient() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch("/api/notes", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]));
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
                <div className="metaLine">{item.updated_at_display || item.updated_at}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
