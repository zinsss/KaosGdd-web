"use client";

import { useEffect, useRef, useState } from "react";

export default function BottomCaptureBar() {
  const [raw, setRaw] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
  }, [raw]);

  async function onSubmit(event) {
    event.preventDefault();
    const clean = raw.trim();
    if (!clean) {
      setError("capture is empty");
      setSuccess("");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/capture",   {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: clean }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError((data && data.error) || "Capture failed.");
        return;
      }

      setRaw("");
      setSuccess("Saved.");
      window.setTimeout(() => {
        window.location.reload();
      }, 250);
    } catch {
      setError("Capture failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bottomCaptureBar">
      <div className="bottomCaptureInner">
        <textarea
          ref={textareaRef}
          className="textInput autoTextarea bottomCaptureInput"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          rows={1}
          spellCheck={false}
          placeholder=""
          disabled={isSubmitting}
        />
        <button className="button bottomCaptureButton" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "..." : "Add"}
        </button>
      </div>

      {error ? <div className="errorText bottomCaptureMsg">{error}</div> : null}
      {!error && success ? <div className="successText bottomCaptureMsg">{success}</div> : null}
    </form>
  );
}