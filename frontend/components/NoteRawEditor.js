"use client";

import { useEffect, useState } from "react";

import { UI_STRINGS } from "../lib/strings";
import NoteMarkdownEditor from "./NoteMarkdownEditor";

export default function NoteRawEditor({ noteId, initialRaw }) {
  const [raw, setRaw] = useState(initialRaw || "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(t);
  }, [saved]);

  async function save() {
    setError("");
    const res = await fetch("/api/notes/" + noteId + "/raw", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || UI_STRINGS.SAVE_FAILED);
      return;
    }
    setSaved(true);
    window.location.reload();
  }

  return (
    <div>
      <NoteMarkdownEditor value={raw} onChange={(value) => setRaw(value)} />
      <div className="actionRow" style={{ marginTop: 10 }}>
        <button className="button" onClick={save}>{UI_STRINGS.SAVE}</button>
        {saved ? <span className="metaLine">{UI_STRINGS.SAVED}</span> : null}
      </div>
      {error ? <div className="errorText">{error}</div> : null}
    </div>
  );
}
