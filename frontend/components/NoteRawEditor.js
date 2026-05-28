"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { UI_STRINGS } from "../lib/strings";
import NoteMarkdownEditor from "./NoteMarkdownEditor";

export default function NoteRawEditor({ noteId, initialRaw, noteTitle = "" }) {
  const router = useRouter();
  const [raw, setRaw] = useState(initialRaw || "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFocusOpen, setIsFocusOpen] = useState(false);

  const title = String(noteTitle || "").trim() || UI_STRINGS.UNTITLED_NOTE;
  const saveStatus = isSaving ? UI_STRINGS.SAVING : saved ? UI_STRINGS.SAVED : "";

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(t);
  }, [saved]);

  const save = useCallback(async () => {
    if (isSaving) return false;

    setError("");
    setIsSaving(true);
    try {
      const res = await fetch("/api/notes/" + noteId + "/raw", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || UI_STRINGS.SAVE_FAILED);
        return false;
      }
      setSaved(true);
      router.refresh();
      return true;
    } catch {
      setError(UI_STRINGS.SAVE_FAILED);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, noteId, raw, router]);

  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (!isFocusOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event) {
      if (event.defaultPrevented || event.isComposing) return;

      const isSave = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
      if (isSave) {
        event.preventDefault();
        saveRef.current();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsFocusOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isFocusOpen]);

  return (
    <div>
      <NoteMarkdownEditor value={raw} onChange={(value) => setRaw(value)} />
      <div className="actionRow editorActions">
        <button className="button buttonToneSave" type="button" onClick={save} disabled={isSaving}>
          {isSaving ? UI_STRINGS.SAVING : UI_STRINGS.SAVE}
        </button>
        <button className="button buttonToneNeutral" type="button" onClick={() => setIsFocusOpen(true)}>
          {UI_STRINGS.NOTE_FOCUS_BUTTON}
        </button>
        {saveStatus ? <span className="metaLine" aria-live="polite">{saveStatus}</span> : null}
      </div>
      {error ? <div className="errorText">{error}</div> : null}

      {isFocusOpen ? (
        <div className="noteFocusEditorOverlay" role="dialog" aria-modal="true" aria-labelledby="note-focus-editor-title">
          <div className="noteFocusEditorPanel">
            <div className="noteFocusEditorTopBar">
              <div className="noteFocusEditorTitle" id="note-focus-editor-title" title={title}>{title}</div>
              <div className="actionRow noteFocusEditorActions">
                <button className="button buttonToneSave" type="button" onClick={save} disabled={isSaving}>
                  {isSaving ? UI_STRINGS.SAVING : UI_STRINGS.SAVE}
                </button>
                <button
                  className="button buttonToneNeutral"
                  type="button"
                  onClick={() => setIsFocusOpen(false)}
                  aria-label={UI_STRINGS.CLOSE}
                >
                  {UI_STRINGS.CLOSE}
                </button>
              </div>
            </div>
            <div className="noteFocusEditorBody">
              <NoteMarkdownEditor value={raw} onChange={(value) => setRaw(value)} height="100%" autoFocus />
            </div>
            {saveStatus || error ? (
              <div className="noteFocusEditorStatus" aria-live="polite">
                {saveStatus ? <span className="metaLine">{saveStatus}</span> : null}
                {error ? <span className="errorText">{error}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
