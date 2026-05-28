"use client";

import { useCallback, useEffect, useState } from "react";
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

  useEffect(() => {
    if (!isFocusOpen) return;

    function onKeyDown(event) {
      const isSave = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
      if (isSave) {
        event.preventDefault();
        save();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsFocusOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isFocusOpen, save]);

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
        {saved ? <span className="metaLine">{UI_STRINGS.SAVED}</span> : null}
      </div>
      {error ? <div className="errorText">{error}</div> : null}

      {isFocusOpen ? (
        <div className="noteFocusEditorOverlay" role="dialog" aria-modal="true" aria-label={UI_STRINGS.NOTE_FOCUS_EDITOR_TITLE}>
          <div className="noteFocusEditorPanel">
            <div className="noteFocusEditorTopBar">
              <div className="noteFocusEditorTitle" title={title}>{title}</div>
              <div className="actionRow noteFocusEditorActions">
                <button className="button buttonToneSave" type="button" onClick={save} disabled={isSaving}>
                  {isSaving ? UI_STRINGS.SAVING : UI_STRINGS.SAVE}
                </button>
                <button className="button buttonToneNeutral" type="button" onClick={() => setIsFocusOpen(false)}>
                  {UI_STRINGS.CLOSE}
                </button>
              </div>
            </div>
            <div className="noteFocusEditorBody">
              <NoteMarkdownEditor value={raw} onChange={(value) => setRaw(value)} height="100%" autoFocus />
            </div>
            {saved || error ? (
              <div className="noteFocusEditorStatus">
                {saved ? <span className="metaLine">{UI_STRINGS.SAVED}</span> : null}
                {error ? <span className="errorText">{error}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
