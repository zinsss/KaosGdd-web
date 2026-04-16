"use client";

import { useEffect, useState } from "react";

export default function FileRawEditor({ fileId, initialRaw }) {
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
    const res = await fetch("/api/files/" + fileId + "/raw", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setSaved(true);
    window.location.reload();
  }

  return (
    <div>
      <textarea
        className="textInput autoTextarea rawEditor"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={12}
        spellCheck={false}
      />
      <div className="actionRow">
        <button className="button" onClick={save}>Save</button>
        {saved ? <span className="metaLine">Saved.</span> : null}
      </div>
      {error ? <div className="errorText">{error}</div> : null}
      <div className="rawHint">title · #tags · l:itemId · optional memo in triple quotes</div>
    </div>
  );
}
