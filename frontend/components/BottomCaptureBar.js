"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { UI_STRINGS } from "../lib/strings";
import NewNoteModal from "./NewNoteModal";

const NEW_NOTE_TEMPLATE = ":::\ntitle:\ntags:\nlink:\n:::";

function readEditState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem("kaosgdd_capture_edit");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.raw) return null;
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

function deriveTitleFromFilename(filename) {
  const fallback = UI_STRINGS.FILE_TITLE_FALLBACK;
  const cleanName = String(filename || "").trim();
  if (!cleanName) return fallback;

  const withoutExt = cleanName.replace(/\.[^/.]+$/, "");
  const normalized = withoutExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || fallback;
}

function normalizeAttachedFileGrammar(rawText) {
  const text = String(rawText || "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const output = [];

  let sawTitle = false;
  let inMemo = false;

  for (const sourceLine of lines) {
    const trimmed = sourceLine.trim();

    if (!sawTitle) {
      if (!trimmed) continue;
      if (!trimmed.startsWith("++")) {
        return { ok: false, error: UI_STRINGS.FILE_GRAMMAR_TITLE_PREFIX_REQUIRED };
      }

      const title = trimmed.slice(2).trim();
      if (!title) {
        return { ok: false, error: UI_STRINGS.FILE_GRAMMAR_TITLE_REQUIRED };
      }

      output.push(title);
      sawTitle = true;
      continue;
    }

    if (inMemo) {
      output.push(sourceLine);
      if (trimmed === '"""') {
        inMemo = false;
      }
      continue;
    }

    if (!trimmed) {
      output.push("");
      continue;
    }

    if (trimmed === '"""') {
      inMemo = true;
      output.push('"""');
      continue;
    }

    if (trimmed.startsWith("#") || trimmed.startsWith("l:")) {
      output.push(trimmed);
      continue;
    }

    if (trimmed.startsWith("x:")) {
      output.push(trimmed);
      continue;
    }

    return { ok: false, error: UI_STRINGS.FILE_GRAMMAR_INVALID_LINE };
  }

  if (!sawTitle) {
    return { ok: false, error: UI_STRINGS.FILE_GRAMMAR_TITLE_REQUIRED };
  }

  if (inMemo) {
    return { ok: false, error: UI_STRINGS.FILE_GRAMMAR_MEMO_UNCLOSED };
  }

  return {
    ok: true,
    normalizedRaw: output.join("\n").trim(),
  };
}

function datetimeSelectionRange(rawText) {
  const source = String(rawText || "");
  const firstLineEnd = source.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? source : source.slice(0, firstLineEnd);
  const match = firstLine.match(/!!\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
  if (!match || match.index === undefined) return null;
  const value = match[1];
  const start = match.index + firstLine.slice(match.index).indexOf(value);
  return { start, end: start + value.length };
}

export default function BottomCaptureBar() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editState, setEditState] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [attachedFilename, setAttachedFilename] = useState("");
  const [isNewNoteModalOpen, setIsNewNoteModalOpen] = useState(false);
  const [newNoteRaw, setNewNoteRaw] = useState(NEW_NOTE_TEMPLATE);
  const [newNoteError, setNewNoteError] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const submitLockRef = useRef(false);
  const activeRequestIdRef = useRef(0);

  function resizeTextarea(node = textareaRef.current) {
    if (!node) return;

    const computed = window.getComputedStyle(node);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 22;
    const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
    const borderTop = Number.parseFloat(computed.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(computed.borderBottomWidth) || 0;
    const lineCount = Math.max(node.value.split("\n").length, 1);

    node.style.height = "auto";

    const minVisibleHeight =
      lineCount * lineHeight +
      paddingTop +
      paddingBottom +
      borderTop +
      borderBottom;

    const targetHeight = Math.max(node.scrollHeight + borderTop + borderBottom, minVisibleHeight, 46);
    node.style.height = `${targetHeight}px`;
  }

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
      setAttachedFile(null);
      setAttachedFilename("");
      setError("");
      setSuccess("");
      writeEditState(next);

      window.setTimeout(() => {
        resizeTextarea();
        textareaRef.current?.focus();
      }, 0);
    }

    function onAddAsNew(event) {
      const detail = event.detail || {};
      const nextRaw = String(detail.raw || "").trim();
      if (!nextRaw) return;

      setEditState(null);
      setRaw(nextRaw);
      setAttachedFile(null);
      setAttachedFilename("");
      setError("");
      setSuccess("");
      writeEditState(null);

      const selection = datetimeSelectionRange(nextRaw);
      window.requestAnimationFrame(() => {
        const node = textareaRef.current;
        if (!node) return;
        resizeTextarea(node);
        node.focus();
        if (!selection) return;
        window.requestAnimationFrame(() => {
          try {
            node.setSelectionRange(selection.start, selection.end);
          } catch {}
        });
      });
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
    window.addEventListener("kaosgdd:add-reminder-as-new", onAddAsNew);

    return () => {
      window.removeEventListener("kaosgdd:start-reminder-edit", onStartEdit);
      window.removeEventListener("kaosgdd:start-journal-edit", onStartEdit);
      window.removeEventListener("kaosgdd:cancel-reminder-edit", onCancelEdit);
      window.removeEventListener("kaosgdd:add-reminder-as-new", onAddAsNew);
    };
  }, []);



  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefillRaw = window.sessionStorage.getItem("kaosgdd_capture_prefill");
    if (!prefillRaw) return;

    window.sessionStorage.removeItem("kaosgdd_capture_prefill");
    setRaw(prefillRaw);
    setError("");
    setSuccess("Shared content ready.");

    window.setTimeout(() => {
      resizeTextarea();
      textareaRef.current?.focus();
    }, 0);
  }, []);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [raw]);

  function clearAttachment() {
    setAttachedFile(null);
    setAttachedFilename("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function cancelEdit() {
    setEditState(null);
    setRaw("");
    setError("");
    setSuccess("");
    writeEditState(null);
  }

  function openNewNoteModal() {
    setIsNewNoteModalOpen(true);
    setNewNoteRaw(NEW_NOTE_TEMPLATE);
    setNewNoteError("");
    setRaw("");
    setError("");
    setSuccess("");
    clearAttachment();
  }

  function closeNewNoteModal() {
    setIsNewNoteModalOpen(false);
    setNewNoteError("");
    setIsSavingNote(false);
  }

  function onPickFile() {
    if (isSubmitting) return;
    if (editState) {
      setError(UI_STRINGS.ATTACHMENT_EDIT_MODE_UNAVAILABLE);
      setSuccess("");
      return;
    }
    fileInputRef.current?.click();
  }

  function onFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAttachedFile(file);
    setAttachedFilename(file.name || UI_STRINGS.FILE_SELECTED_FALLBACK);
    setError("");
    setSuccess("");

    if (!raw.trim()) {
      const title = deriveTitleFromFilename(file.name);
      setRaw(`++ ${title}`);
    }
  }

  const modeText = editState
    ? editState.kind === "journal"
      ? UI_STRINGS.EDITING_JOURNAL
      : editState.kind === "note"
        ? UI_STRINGS.EDITING_NOTE
        : UI_STRINGS.EDITING_REMINDER
    : "";

  const statusText = error || success || attachedFilename || modeText;

  function beginCaptureRequest() {
    activeRequestIdRef.current += 1;
    return activeRequestIdRef.current;
  }

  function isActiveCaptureRequest(requestId) {
    return activeRequestIdRef.current === requestId;
  }

  async function finalizeCreateSuccess({ requestId, clearInput = true, navigate }) {
    if (!isActiveCaptureRequest(requestId)) return;

    if (clearInput) {
      setRaw("");
    }
    setError("");
    setSuccess(UI_STRINGS.SAVED);

    if (typeof navigate === "function") {
      try {
        navigate();
      } catch {
        if (!isActiveCaptureRequest(requestId)) return;
        setSuccess(UI_STRINGS.REFRESH_FAILED_AFTER_SAVE);
      }
      return;
    }

    try {
      router.refresh();
      window.setTimeout(() => {
        window.location.reload();
      }, 250);
    } catch {
      if (!isActiveCaptureRequest(requestId)) return;
      setSuccess(UI_STRINGS.REFRESH_FAILED_AFTER_SAVE);
    }
  }

  async function submitAttachedFile(cleanRaw) {
    if (!attachedFile) return false;

    const normalized = normalizeAttachedFileGrammar(cleanRaw);
    if (!normalized.ok) {
      setError(normalized.error || UI_STRINGS.FILE_GRAMMAR_INVALID);
      return true;
    }

    const bytes = await attachedFile.arrayBuffer();
    const uploadRes = await fetch("/api/files", {
      method: "POST",
      body: bytes,
      headers: {
        "x-file-name": attachedFile.name || "uploaded-file",
        "x-file-type": attachedFile.type || "application/octet-stream",
        "content-type": "application/octet-stream",
      },
    });

    const uploadData = await uploadRes.json().catch(() => null);
    if (!uploadRes.ok || !uploadData?.ok || !uploadData?.id) {
      setError((uploadData && uploadData.error) || UI_STRINGS.FILE_UPLOAD_FAILED);
      return true;
    }

    const rawRes = await fetch(`/api/files/${uploadData.id}/raw`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: normalized.normalizedRaw }),
    });

    const rawData = await rawRes.json().catch(() => null);
    if (!rawRes.ok || !rawData?.ok) {
      await fetch(`/api/files/${uploadData.id}`, { method: "DELETE" }).catch(() => null);
      setError((rawData && rawData.error) || UI_STRINGS.INVALID_FILE_GRAMMAR);
      return true;
    }

    clearAttachment();
    setRaw("");
    setSuccess(UI_STRINGS.SAVED);
    window.setTimeout(() => {
      window.location.reload();
    }, 250);

    return true;
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (submitLockRef.current) {
      return;
    }

    const currentRaw = textareaRef.current?.value ?? raw;
    const clean = currentRaw.trim();
    if (!clean) {
      setError(editState ? UI_STRINGS.REMINDER_EMPTY : UI_STRINGS.CAPTURE_EMPTY);
      setSuccess("");
      return;
    }

    submitLockRef.current = true;
    const requestId = beginCaptureRequest();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (!editState && clean.startsWith(":::")) {
        openNewNoteModal();
        return;
      }

      if (editState?.id) {
        const isJournal = editState.kind === "journal";
        const isNote = editState.kind === "note";
        const path = isJournal ? `/api/journals/${editState.id}/raw` : isNote ? `/api/notes/${editState.id}/raw` : `/api/reminders/${editState.id}`;
        const res = await fetch(path, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: clean }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          if (!isActiveCaptureRequest(requestId)) return;
          setError((data && data.error) || (isJournal ? UI_STRINGS.JOURNAL_SAVE_FAILED : isNote ? UI_STRINGS.NOTE_SAVE_FAILED : UI_STRINGS.REMINDER_SAVE_FAILED));
          return;
        }

        cancelEdit();
        await finalizeCreateSuccess({ requestId });
        return;
      }

      if (attachedFile) {
        const handled = await submitAttachedFile(clean);
        if (handled) {
          return;
        }
      }

      if (editState?.kind === "note" && !editState?.id) {
        const res = await fetch("/api/notes/raw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: clean }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          if (!isActiveCaptureRequest(requestId)) return;
          setError((data && data.error) || UI_STRINGS.SAVE_FAILED);
          return;
        }

        cancelEdit();
        await finalizeCreateSuccess({
          requestId,
          navigate: () => {
            window.location.href = `/notes/${data.id}`;
          },
        });
        return;
      }

      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw: clean,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        if (!isActiveCaptureRequest(requestId)) return;
        setError((data && data.error) || UI_STRINGS.CAPTURE_FAILED);
        return;
      }

      if (data.kind === "modal" && data.modal_type === "note") {
        openNewNoteModal();
        return;
      }

      await finalizeCreateSuccess({ requestId });
    } catch {
      if (!isActiveCaptureRequest(requestId)) return;
      setError(editState ? (editState.kind === "journal" ? UI_STRINGS.JOURNAL_SAVE_FAILED : editState.kind === "note" ? UI_STRINGS.NOTE_SAVE_FAILED : UI_STRINGS.REMINDER_SAVE_FAILED) : UI_STRINGS.CAPTURE_FAILED);
    } finally {
      if (isActiveCaptureRequest(requestId)) {
        setIsSubmitting(false);
        submitLockRef.current = false;
      }
    }
  }

  async function saveNewNote() {
    const clean = newNoteRaw.trim();
    if (!clean) {
      setNewNoteError(UI_STRINGS.NOTE_EMPTY);
      return;
    }

    setIsSavingNote(true);
    setNewNoteError("");

    try {
      const res = await fetch("/api/notes/raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: clean }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setNewNoteError((data && data.error) || UI_STRINGS.NOTE_SAVE_FAILED);
        return;
      }

      closeNewNoteModal();
      setRaw("");
      setSuccess(UI_STRINGS.SAVED);
      window.setTimeout(() => {
        window.location.reload();
      }, 250);
    } catch {
      setNewNoteError(UI_STRINGS.NOTE_SAVE_FAILED);
    } finally {
      setIsSavingNote(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="bottomCaptureBar">
        <div className="bottomCaptureInner">
          <textarea
            ref={textareaRef}
            className="textInput autoTextarea bottomCaptureInput"
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value);
              resizeTextarea(event.currentTarget);
            }}
            rows={1}
            spellCheck={false}
            placeholder=""
            disabled={isSubmitting}
          />
          <div className="bottomCaptureFooter">
            <div
              className={`bottomCaptureStatus${error ? " errorText" : !error && success ? " successText" : " bottomCaptureModeLabel"}`}
            >
              {statusText}
            </div>

            <div className="bottomCaptureActions">
              <input
                ref={fileInputRef}
                className="visuallyHiddenFileInput"
                type="file"
                disabled={isSubmitting || Boolean(editState)}
                onChange={onFileSelected}
                aria-label={UI_STRINGS.ATTACH_FILE}
              />

              <button className="button pillButton bottomCaptureAttachButton" type="button" onClick={onPickFile} disabled={isSubmitting}>
                {UI_STRINGS.ATTACH_ICON}
              </button>

              <button className="button pillButton bottomCaptureButton" type="submit" disabled={isSubmitting}>
                {isSubmitting ? UI_STRINGS.ELLIPSIS : editState ? UI_STRINGS.SAVE : UI_STRINGS.ADD}
              </button>

              {editState ? (
                <button
                  className="button pillButton bottomCaptureCancelButton"
                  type="button"
                  onClick={cancelEdit}
                  disabled={isSubmitting}
                >
                  {UI_STRINGS.CANCEL}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </form>

      <NewNoteModal
        open={isNewNoteModalOpen}
        value={newNoteRaw}
        onChange={setNewNoteRaw}
        onSave={saveNewNote}
        onCancel={closeNewNoteModal}
        isSaving={isSavingNote}
        error={newNoteError}
      />
    </>
  );
}
