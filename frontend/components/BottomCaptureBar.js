"use client";

import { useEffect, useRef, useState } from "react";

function readEditState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem("kaosgdd_capture_edit");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !parsed.raw) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeEditState(value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!value) {
      window.sessionStorage.removeItem("kaosgdd_capture_edit");
      return;
    }
    window.sessionStorage.setItem("kaosgdd_capture_edit", JSON.stringify(value));
  } catch {}
}

export default function BottomCaptureBar() {
  const [raw, setRaw] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editState, setEditState] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const initial = readEditState();
    if (initial) {
      setEditState(initial);
      setRaw(initial.raw || "");
    }

    function onStartEdit(event) {
      const detail = event.detail || {};
      if (!detail.id || !detail.raw) return;

      const next = {
        id: detail.id,
        raw: detail.raw,
        kind: detail.kind || "reminder",
      };

      setEditState(next);
      setRaw(detail.raw);
      setError("");
      setSuccess("");
      writeEditState(next);

      window.setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }

    function onCancelEdit() {
      setEditState(null);
      setRaw("");
      setError("");
      setSuccess("");
      writeEditState(null);
    }

    window.addEventListener("kaosgdd:start-reminder-edit", onStartEdit);
    window.addEventListener("kaosgdd:start-journal-edit", onStartEdit);
    window.addEventListener("kaosgdd:cancel-reminder-edit", onCancelEdit);

    return () => {
      window.removeEventListener("kaosgdd:start-reminder-edit", onStartEdit);
      window.removeEventListener("kaosgdd:start-journal-edit", onStartEdit);
      window.removeEventListener("kaosgdd:cancel-reminder-edit", onCancelEdit);
    };
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
  }, [raw]);

  function cancelEdit() {
    setEditState(null);
    setRaw("");
    setError("");
    setSuccess("");
    writeEditState(null);
  }

  async function onSubmit(event) {
    event.preventDefault();
    const clean = raw.trim();
    if (!clean) {
      setError(editState ? "reminder is empty" : "capture is empty");
      setSuccess("");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (editState?.id) {
        const isJournal = editState.kind === "journal";
        const path = isJournal ? `/api/journals/${editState.id}/raw` : `/api/reminders/${editState.id}`;
        const res = await fetch(path, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: clean }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          setError((data && data.error) || (isJournal ? "Journal save failed." : "Reminder save failed."));
          return;
        }

        cancelEdit();
        setSuccess("Saved.");
        window.setTimeout(() => {
          window.location.reload();
        }, 250);
        return;
      }

      const res = await fetch("/api/capture", {
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
      setError(editState ? (editState.kind === "journal" ? "Journal save failed." : "Reminder save failed.") : "Capture failed.");
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

        {editState ? (
          <button
            className="button bottomCaptureCancelButton"
            type="button"
            onClick={cancelEdit}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        ) : null}

        <button className="button bottomCaptureButton" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "..." : editState ? "Save" : "Add"}
        </button>
      </div>

      {editState ? <div className="bottomCaptureModeLabel">{editState.kind === "journal" ? "Editing journal" : "Editing reminder"}</div> : null}
      {error ? <div className="errorText bottomCaptureMsg">{error}</div> : null}
      {!error && success ? <div className="successText bottomCaptureMsg">{success}</div> : null}
    </form>
  );
}