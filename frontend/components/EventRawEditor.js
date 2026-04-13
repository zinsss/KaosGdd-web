"use client";

import { useEffect, useRef, useState } from "react";
import { UI_STRINGS } from "../lib/strings";

export default function EventRawEditor({ eventId, initialRaw }) {
  const [raw, setRaw] = useState(initialRaw || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
  }, [raw]);

  async function onSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/events/" + eventId + "/raw", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || (data && data.ok === false)) {
        setError((data && data.error) || "Save failed.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Save failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <textarea
        ref={textareaRef}
        className="textInput autoTextarea rawEditor"
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        rows={1}
        spellCheck={false}
        placeholder={'^^ 2026-04-28~2026-04-30\nTrip\n#travel\nr:-2d\n"""\npack light\n"""'}
      />
      <div className="rawHint">^^ YYYY-MM-DD or YYYY-MM-DD~YYYY-MM-DD · one r: only</div>
      <div className="actionRow compactActionRow">
        <button className="button compactButton" type="submit" disabled={isSubmitting}>
          {isSubmitting ? UI_STRINGS.SAVING : UI_STRINGS.SAVE}
        </button>
      </div>
      {error ? <div className="errorText">{error}</div> : null}
    </form>
  );
}
