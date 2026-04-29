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

      output.push(`++ ${title}`);
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

function attachedFileShortcutKind(rawText) {
  const firstLine = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => Boolean(line));
  if (!firstLine) return null;
  if (firstLine.startsWith("fax:")) return null;
  if (firstLine.startsWith("++")) return null;
  if (firstLine.startsWith("-- ") || firstLine.startsWith("-x ")) return "task";
  if (firstLine === "!!" || firstLine.startsWith("!! ")) return "reminder";
  if (firstLine.startsWith(":::")) return "note";
  return null;
}

function appendTaskLink(rawText, fileId) {
  return `${String(rawText || "").trim()}\nl:${fileId}`;
}

function appendReminderLink(rawText, fileId) {
  return `${String(rawText || "").trim()}\nl:${fileId}`;
}

function appendNoteLink(rawText, fileId) {
  const source = String(rawText || "").replace(/\r\n/g, "\n");
  const match = source.match(/^:::\n([\s\S]*?)\n:::/);
  if (!match) return source;
  const metadata = match[1].split("\n");
  const updated = metadata.map((line) => {
    if (!line.startsWith("link:")) return line;
    const current = line.slice(5).trim();
    return current ? `link: ${current}, ${fileId}` : `link: ${fileId}`;
  });
  return source.replace(match[0], `:::\n${updated.join("\n")}\n:::`);
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
  const captureContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const submitLockRef = useRef(false);
  const activeRequestIdRef = useRef(0);
  const focusAnchorRafRef = useRef(0);
  const focusAnchorTimeoutRef = useRef(0);
  const focusAnchorLoopEndRef = useRef(0);
  const isTextareaFocusedRef = useRef(false);
  const userScrollOverrideRef = useRef(false);

  function getMainScroller() {
    if (typeof document === "undefined") return null;
    return document.querySelector(".appShellMain");
  }

  function stopFocusAnchorLoop() {
    if (focusAnchorRafRef.current) {
      window.cancelAnimationFrame(focusAnchorRafRef.current);
      focusAnchorRafRef.current = 0;
    }

    if (focusAnchorTimeoutRef.current) {
      window.clearTimeout(focusAnchorTimeoutRef.current);
      focusAnchorTimeoutRef.current = 0;
    }

    focusAnchorLoopEndRef.current = 0;
  }

  function captureBottomOverflowPx() {
    if (typeof window === "undefined") return 0;
    const node = captureContainerRef.current || textareaRef.current;
    if (!node) return 0;

    const viewport = window.visualViewport;
    const viewportBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
    const rect = node.getBoundingClientRect();
    return rect.bottom - viewportBottom + 12;
  }

  function anchorCaptureForFocus({ behavior = "auto" } = {}) {
    if (typeof window === "undefined") return;
    const node = textareaRef.current;
    if (!node || !isTextareaFocusedRef.current) return;
    if (userScrollOverrideRef.current) return;

    const overlap = captureBottomOverflowPx();
    if (overlap <= 0) return true;

    const scroller = getMainScroller();
    if (!scroller) return;
    scroller.scrollTo({ top: scroller.scrollTop + overlap, behavior });
    return captureBottomOverflowPx() <= 0;
  }

  function startFocusAnchorLoop(durationMs = 300) {
    if (typeof window === "undefined") return;
    if (!isTextareaFocusedRef.current) return;
    if (userScrollOverrideRef.current) return;

    stopFocusAnchorLoop();
    focusAnchorLoopEndRef.current = Date.now() + durationMs;

    const runLoop = () => {
      focusAnchorRafRef.current = 0;
      focusAnchorTimeoutRef.current = 0;

      if (!isTextareaFocusedRef.current) {
        stopFocusAnchorLoop();
        return;
      }

      const fullyVisible = anchorCaptureForFocus({ behavior: "auto" });
      if (fullyVisible) {
        stopFocusAnchorLoop();
        return;
      }

      if (Date.now() >= focusAnchorLoopEndRef.current) {
        stopFocusAnchorLoop();
        return;
      }

      focusAnchorTimeoutRef.current = window.setTimeout(() => {
        focusAnchorTimeoutRef.current = 0;
        focusAnchorRafRef.current = window.requestAnimationFrame(runLoop);
      }, 60);
    };

    anchorCaptureForFocus({ behavior: "auto" });
    focusAnchorRafRef.current = window.requestAnimationFrame(runLoop);
  }

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

    const onViewportShift = () => {
      if (!isTextareaFocusedRef.current) return;
      anchorCaptureForFocus({ behavior: "auto" });
    };

    window.addEventListener("resize", onViewportShift);
    window.visualViewport?.addEventListener("resize", onViewportShift);

    return () => {
      window.removeEventListener("resize", onViewportShift);
      window.visualViewport?.removeEventListener("resize", onViewportShift);
      stopFocusAnchorLoop();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onUserScrollIntent = () => {
      if (!isTextareaFocusedRef.current) return;
      userScrollOverrideRef.current = true;
      stopFocusAnchorLoop();
    };

    const scroller = getMainScroller();
    scroller?.addEventListener("wheel", onUserScrollIntent, { passive: true });
    scroller?.addEventListener("touchmove", onUserScrollIntent, { passive: true });
    window.addEventListener("wheel", onUserScrollIntent, { passive: true });
    window.addEventListener("touchmove", onUserScrollIntent, { passive: true });

    return () => {
      scroller?.removeEventListener("wheel", onUserScrollIntent);
      scroller?.removeEventListener("touchmove", onUserScrollIntent);
      window.removeEventListener("wheel", onUserScrollIntent);
      window.removeEventListener("touchmove", onUserScrollIntent);
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

  function onOpenCapturePage() {
    if (isSubmitting) return;
    router.push("/capture");
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

  const statusText = error
    ? attachedFilename
      ? `${attachedFilename} · ${error}`
      : error
    : success || attachedFilename || modeText;

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
    console.debug("[BottomCaptureBar] attached-file", {
      exists: Boolean(attachedFile),
      name: attachedFile?.name || "",
      size: attachedFile?.size || 0,
      type: attachedFile?.type || "",
    });
    if (!attachedFile) return false;

    const shortcutKind = attachedFileShortcutKind(cleanRaw);
    const shouldAutoCreateLinkedItem = Boolean(shortcutKind);
    const normalized = shouldAutoCreateLinkedItem
      ? { ok: true, normalizedRaw: `++ ${deriveTitleFromFilename(attachedFile?.name || "")}` }
      : normalizeAttachedFileGrammar(cleanRaw);
    if (!normalized.ok) {
      setError(normalized.error || UI_STRINGS.FILE_GRAMMAR_INVALID);
      return true;
    }

    let uploadRes;
    try {
      uploadRes = await fetch("/api/files", {
        method: "POST",
        body: attachedFile,
        headers: {
          "x-file-name-url": encodeURIComponent(attachedFile.name || "uploaded-file"),
          "x-file-type": attachedFile.type || "application/octet-stream",
          "content-type": attachedFile.type || "application/octet-stream",
        },
      });
    } catch (error) {
      console.error("[BottomCaptureBar] attached-file stage=file-upload-post failed", error);
      setError(UI_STRINGS.FILE_UPLOAD_REQUEST_FAILED);
      return true;
    }

    const uploadData = await uploadRes.json().catch(() => null);
    if (!uploadRes.ok || !uploadData?.ok || !uploadData?.id) {
      setError((uploadData && uploadData.error) || UI_STRINGS.FILE_UPLOAD_FAILED);
      return true;
    }

    let rawRes;
    try {
      rawRes = await fetch(`/api/files/${uploadData.id}/raw`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: normalized.normalizedRaw }),
      });
    } catch (error) {
      console.error("[BottomCaptureBar] attached-file stage=file-raw-patch failed", error);
      await fetch(`/api/files/${uploadData.id}/hard`, { method: "DELETE" }).catch(() => null);
      setError(UI_STRINGS.FILE_METADATA_SAVE_REQUEST_FAILED);
      return true;
    }

    const rawData = await rawRes.json().catch(() => null);
    if (!rawRes.ok || !rawData?.ok) {
      await fetch(`/api/files/${uploadData.id}/hard`, { method: "DELETE" }).catch(() => null);
      setError((rawData && rawData.error) || UI_STRINGS.INVALID_FILE_GRAMMAR);
      return true;
    }

    if (shouldAutoCreateLinkedItem) {
      let linkedItemId = "";
      try {
        if (shortcutKind === "note") {
          const noteRes = await fetch("/api/notes/raw", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ raw: cleanRaw }),
          });
          const noteData = await noteRes.json().catch(() => null);
          if (!noteRes.ok || !noteData?.ok || !noteData?.id) {
            await fetch(`/api/files/${uploadData.id}/hard`, { method: "DELETE" }).catch(() => null);
            setError((noteData && noteData.error) || UI_STRINGS.NOTE_SAVE_FAILED);
            return true;
          }
          linkedItemId = noteData.id;
        } else {
          const captureRes = await fetch("/api/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              raw: cleanRaw,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
            }),
          });
          const captureData = await captureRes.json().catch(() => null);
          if (!captureRes.ok || !captureData?.ok || !captureData?.id) {
            await fetch(`/api/files/${uploadData.id}/hard`, { method: "DELETE" }).catch(() => null);
            setError((captureData && captureData.error) || UI_STRINGS.CAPTURE_FAILED);
            return true;
          }
          linkedItemId = captureData.id;
        }
      } catch {
        await fetch(`/api/files/${uploadData.id}/hard`, { method: "DELETE" }).catch(() => null);
        setError(UI_STRINGS.CAPTURE_FAILED);
        return true;
      }

      let patchRes;
      if (shortcutKind === "task") {
        patchRes = await fetch(`/api/tasks/${linkedItemId}/raw`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: appendTaskLink(cleanRaw, uploadData.id) }),
        });
      } else if (shortcutKind === "reminder") {
        patchRes = await fetch(`/api/reminders/${linkedItemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: appendReminderLink(cleanRaw, uploadData.id) }),
        });
      } else {
        patchRes = await fetch(`/api/notes/${linkedItemId}/raw`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: appendNoteLink(cleanRaw, uploadData.id) }),
        });
      }
      const patchData = await patchRes.json().catch(() => null);
      if (!patchRes.ok || !patchData?.ok) {
        await fetch(`/api/files/${uploadData.id}/hard`, { method: "DELETE" }).catch(() => null);
        setError((patchData && patchData.error) || UI_STRINGS.SAVE_FAILED);
        return true;
      }
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
      if (!editState && !attachedFile && clean.startsWith(":::")) {
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
        <div ref={captureContainerRef} className="bottomCaptureInner">
          <textarea
            ref={textareaRef}
            className="textInput autoTextarea bottomCaptureInput"
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value);
              resizeTextarea(event.currentTarget);
              if (isTextareaFocusedRef.current) {
                anchorCaptureForFocus({ behavior: "auto" });
              }
            }}
            onFocus={() => {
              isTextareaFocusedRef.current = true;
              userScrollOverrideRef.current = false;
              startFocusAnchorLoop(300);
            }}
            onBlur={() => {
              isTextareaFocusedRef.current = false;
              userScrollOverrideRef.current = false;
              stopFocusAnchorLoop();
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

              <button className="button pillButton bottomCaptureCaptureButton" type="button" onClick={onOpenCapturePage} disabled={isSubmitting}>
                {UI_STRINGS.CAPTURE}
              </button>

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
