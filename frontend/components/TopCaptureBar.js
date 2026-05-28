"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { UI_STRINGS } from "../lib/strings";
import {
  createdTypesFromCaptureResponse,
  dispatchCaptureCreated,
  navigateAfterCreate,
} from "../lib/post-create-navigation";
import {
  applyModuleImpliedGrammar,
  isKnownCaptureGrammar,
  moduleCaptureBehaviorFromPathname,
} from "../lib/module-implied-capture";
import { deriveTitleFromFilename, nextCaptureAttachmentState } from "../lib/capture-file-attach";
import NewNoteModal from "./NewNoteModal";

const NEW_NOTE_TEMPLATE = ":::\ntitle:\ntags:\nlink:\n:::";
const SCRIBBLE_PROMPT = UI_STRINGS.SCRIBBLE_PROMPT;

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

function normalizeAttachedFaxGrammar(rawText, filename) {
  const firstLine = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine || !firstLine.toLowerCase().startsWith("fax:")) {
    return null;
  }

  const faxNumber = firstLine.slice(4).trim();
  if (!faxNumber) {
    return { ok: false, error: UI_STRINGS.FILE_GRAMMAR_INVALID_LINE };
  }

  return {
    ok: true,
    kind: "fax",
    normalizedRaw: `++ ${deriveTitleFromFilename(filename || "")}\nx:${faxNumber}`,
  };
}

function isImplicitNoteCreate(pathname, originalRaw, rawForSubmit) {
  return (
    moduleCaptureBehaviorFromPathname(pathname)?.kind === "note" &&
    rawForSubmit.startsWith(":::") &&
    !isKnownCaptureGrammar(originalRaw)
  );
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
  if (firstLine.startsWith("^^")) return "event";
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

function appendEventLink(rawText, fileId) {
  return `${String(rawText || "").trim()}\nl:${fileId}`;
}

function appendNoteLink(rawText, fileId) {
  const source = String(rawText || "").replace(/\r\n/g, "\n");
  const match = source.match(/^:::\n([\s\S]*?)\n:::/);
  if (!match) return source;
  const metadata = match[1].split("\n");
  let foundLink = false;
  const updated = metadata.map((line) => {
    if (!line.startsWith("link:")) return line;
    foundLink = true;
    const current = line.slice(5).trim();
    return current ? `link: ${current}, ${fileId}` : `link: ${fileId}`;
  });
  if (!foundLink) {
    updated.push(`link: ${fileId}`);
  }
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

export default function TopCaptureBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [raw, setRaw] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scribblePromptRaw, setScribblePromptRaw] = useState("");
  const [editState, setEditState] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [attachedFilename, setAttachedFilename] = useState("");
  const [pendingSharedFileId, setPendingSharedFileId] = useState("");
  const [isDropActive, setIsDropActive] = useState(false);
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
  const dragDepthRef = useRef(0);

  function isWideCaptureAnchoredMode() {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 768px)").matches;
  }

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

  function captureViewportOverflowPx() {
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
    if (!isWideCaptureAnchoredMode()) return true;
    const node = textareaRef.current;
    if (!node || !isTextareaFocusedRef.current) return;
    if (userScrollOverrideRef.current) return;

    const overlap = captureViewportOverflowPx();
    if (overlap <= 0) return true;

    const scroller = getMainScroller();
    if (!scroller) return;
    scroller.scrollTo({ top: scroller.scrollTop + overlap, behavior });
    return captureViewportOverflowPx() <= 0;
  }

  function startFocusAnchorLoop(durationMs = 300) {
    if (typeof window === "undefined") return;
    if (!isWideCaptureAnchoredMode()) return;
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
    const parsedMaxHeight = Number.parseFloat(computed.maxHeight);
    const maxHeight = Number.isFinite(parsedMaxHeight)
      ? parsedMaxHeight
      : Number.POSITIVE_INFINITY;

    node.style.height = "auto";

    const minVisibleHeight =
      lineCount * lineHeight +
      paddingTop +
      paddingBottom +
      borderTop +
      borderBottom;

    const naturalHeight = Math.max(
      node.scrollHeight + borderTop + borderBottom,
      minVisibleHeight,
      34,
    );
    const targetHeight = Math.min(naturalHeight, maxHeight);
    node.style.height = `${targetHeight}px`;
    node.style.overflowY = "hidden";
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
      setScribblePromptRaw("");
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
      setScribblePromptRaw("");
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
      setScribblePromptRaw("");
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
      if (!isWideCaptureAnchoredMode()) return;
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
    if (!isWideCaptureAnchoredMode()) return;

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
    setSuccess(UI_STRINGS.SHARED_CONTENT_READY);

    window.setTimeout(() => {
      resizeTextarea();
      textareaRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const sharedFileId = url.searchParams.get("shared_file") || "";
    if (!sharedFileId) return;

    let cancelled = false;
    async function loadSharedFile() {
      try {
        const metadataRes = await fetch(`/api/shared-files/${encodeURIComponent(sharedFileId)}`, {
          cache: "no-store",
        });
        const metadataData = await metadataRes.json().catch(() => null);
        if (!metadataRes.ok || !metadataData?.ok || !metadataData?.item) {
          throw new Error(metadataData?.error || UI_STRINGS.SHARED_FILE_LOAD_FAILED);
        }

        const fileRes = await fetch(`/api/shared-files/${encodeURIComponent(sharedFileId)}/file`, {
          cache: "no-store",
        });
        if (!fileRes.ok) {
          throw new Error(UI_STRINGS.SHARED_FILE_LOAD_FAILED);
        }
        const blob = await fileRes.blob();
        if (cancelled) return;

        const item = metadataData.item;
        const file = new File(
          [blob],
          item.filename || UI_STRINGS.FILE_SELECTED_FALLBACK,
          { type: item.content_type || blob.type || "application/octet-stream" },
        );
        setAttachedFile(file);
        setAttachedFilename(file.name || UI_STRINGS.FILE_SELECTED_FALLBACK);
        setPendingSharedFileId(sharedFileId);
        setRaw("");
        setScribblePromptRaw("");
        setError("");
        setSuccess(UI_STRINGS.SHARED_FILE_READY);
        window.setTimeout(() => textareaRef.current?.focus(), 0);
      } catch {
        if (cancelled) return;
        setAttachedFile(null);
        setAttachedFilename("");
        setPendingSharedFileId("");
        setError(UI_STRINGS.SHARED_FILE_LOAD_FAILED);
        setSuccess("");
      } finally {
        if (!cancelled) {
          url.searchParams.delete("shared_file");
          window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        }
      }
    }

    loadSharedFile();
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [raw]);

  function clearAttachment() {
    const sharedFileId = pendingSharedFileId;
    setAttachedFile(null);
    setAttachedFilename("");
    setPendingSharedFileId("");
    if (sharedFileId) {
      fetch(`/api/shared-files/${encodeURIComponent(sharedFileId)}`, { method: "DELETE" }).catch(() => null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function attachPickedFile(file) {
    const previousSharedFileId = pendingSharedFileId;
    const next = nextCaptureAttachmentState({
      file,
      raw,
      isEditing: Boolean(editState),
      fileCount: file ? 1 : 0,
    });
    if (!next.ok) {
      setError(next.error || UI_STRINGS.FILE_DROP_EMPTY);
      setSuccess("");
      return false;
    }

    setAttachedFile(next.file);
    setAttachedFilename(next.filename);
    setPendingSharedFileId("");
    if (previousSharedFileId) {
      fetch(`/api/shared-files/${encodeURIComponent(previousSharedFileId)}`, { method: "DELETE" }).catch(() => null);
    }
    setScribblePromptRaw("");
    setError("");
    setSuccess("");
    setRaw(next.raw);
    return true;
  }

  function cancelEdit() {
    setEditState(null);
    setRaw("");
    setScribblePromptRaw("");
    setError("");
    setSuccess("");
    writeEditState(null);
  }

  function openNewNoteModal() {
    setIsNewNoteModalOpen(true);
    setNewNoteRaw(NEW_NOTE_TEMPLATE);
    setNewNoteError("");
    setRaw("");
    setScribblePromptRaw("");
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
    attachPickedFile(file);
  }

  function dragHasFile(event) {
    return Array.from(event.dataTransfer?.types || []).includes("Files");
  }

  function dropHasDirectory(dataTransfer) {
    const items = Array.from(dataTransfer?.items || []);
    return items.some((item) => {
      if (item.kind !== "file") return false;
      if (typeof item.webkitGetAsEntry !== "function") return false;
      const entry = item.webkitGetAsEntry();
      return Boolean(entry?.isDirectory);
    });
  }

  function resetDropState() {
    dragDepthRef.current = 0;
    setIsDropActive(false);
  }

  function onCaptureDragEnter(event) {
    if (!dragHasFile(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (isSubmitting) return;
    dragDepthRef.current += 1;
    if (!editState) {
      setIsDropActive(true);
    }
  }

  function onCaptureDragOver(event) {
    if (!dragHasFile(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = editState || isSubmitting ? "none" : "copy";
    }
  }

  function onCaptureDragLeave(event) {
    if (!dragHasFile(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(dragDepthRef.current - 1, 0);
    if (dragDepthRef.current === 0) {
      setIsDropActive(false);
    }
  }

  function onCaptureDrop(event) {
    if (!dragHasFile(event)) return;
    event.preventDefault();
    event.stopPropagation();
    resetDropState();
    if (isSubmitting) return;

    const files = Array.from(event.dataTransfer?.files || []);
    const next = nextCaptureAttachmentState({
      file: files[0],
      raw,
      isEditing: Boolean(editState),
      hasDirectory: dropHasDirectory(event.dataTransfer),
      fileCount: files.length,
    });
    if (!next.ok) {
      setError(next.error || UI_STRINGS.FILE_DROP_EMPTY);
      setSuccess("");
      return;
    }

    attachPickedFile(next.file);
  }

  const modeText = editState
    ? editState.kind === "journal"
      ? UI_STRINGS.EDITING_JOURNAL
      : editState.kind === "note"
        ? UI_STRINGS.EDITING_NOTE
        : UI_STRINGS.EDITING_REMINDER
    : "";

  const statusText = scribblePromptRaw
    ? SCRIBBLE_PROMPT
    : error
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

  async function finalizeCreateSuccess({ requestId, clearInput = true, createdTypes, navigate }) {
    if (!isActiveCaptureRequest(requestId)) return;

    if (clearInput) {
      setRaw("");
    }
    setError("");
    setSuccess(UI_STRINGS.SAVED);

    try {
      dispatchCaptureCreated(createdTypes);

      if (typeof navigate === "function") {
        navigate();
        return;
      }

      if (navigateAfterCreate(router, createdTypes)) {
        return;
      }

      router.refresh();
    } catch {
      if (!isActiveCaptureRequest(requestId)) return;
      setSuccess(UI_STRINGS.REFRESH_FAILED_AFTER_SAVE);
    }
  }

  function promptForScribble(rawText) {
    setScribblePromptRaw(String(rawText || "").replace(/\r\n/g, "\n").trim());
    setError("");
    setSuccess("");
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function cancelScribblePrompt() {
    setScribblePromptRaw("");
    setError("");
    setSuccess("");
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function sendPromptToScribble() {
    const textToSend = String(scribblePromptRaw || raw || "").replace(/\r\n/g, "\n").trim();
    if (!textToSend || isSubmitting) return;

    setIsSubmitting(true);
    setScribblePromptRaw("");
    setError("");
    setSuccess("");
    try {
      const saveRes = await fetch("/api/scribbles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: textToSend }),
      });
      const saveData = await saveRes.json().catch(() => null);
      if (!saveRes.ok || !saveData?.ok) {
        setError(UI_STRINGS.SCRIBBLE_SAVE_FAILED);
        return;
      }

      setScribblePromptRaw("");
      setRaw("");
      setSuccess(UI_STRINGS.SCRIBBLE_SENT);
      resizeTextarea();
      dispatchCaptureCreated("scribble");
      navigateAfterCreate(router, "scribble");
    } catch {
      setError(UI_STRINGS.SCRIBBLE_SAVE_FAILED);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitAttachedFile(cleanRaw, requestId) {
    console.debug("[TopCaptureBar] attached-file", {
      exists: Boolean(attachedFile),
      name: attachedFile?.name || "",
      size: attachedFile?.size || 0,
      type: attachedFile?.type || "",
    });
    if (!attachedFile) return false;

    const shortcutKind = attachedFileShortcutKind(cleanRaw);
    const shouldAutoCreateLinkedItem = Boolean(shortcutKind);
    const faxNormalized = normalizeAttachedFaxGrammar(cleanRaw, attachedFile?.name || "");
    const normalized = shouldAutoCreateLinkedItem
      ? { ok: true, normalizedRaw: `++ ${deriveTitleFromFilename(attachedFile?.name || "")}` }
      : faxNormalized || normalizeAttachedFileGrammar(cleanRaw);
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
      console.error("[TopCaptureBar] attached-file stage=file-upload-post failed", error);
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
      console.error("[TopCaptureBar] attached-file stage=file-raw-patch failed", error);
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

    let createdKind = normalized.kind || "file";

    if (shouldAutoCreateLinkedItem) {
      let linkedItemId = "";
      createdKind = shortcutKind;
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
          createdKind = captureData.kind || shortcutKind;
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
      } else if (shortcutKind === "event") {
        patchRes = await fetch(`/api/events/${linkedItemId}/raw`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: appendEventLink(cleanRaw, uploadData.id) }),
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
        if (linkedItemId) {
          const deletePath =
            createdKind === "task"
              ? `/api/tasks/${linkedItemId}`
              : createdKind === "event"
                ? `/api/events/${linkedItemId}`
                : createdKind === "simple_reminder" || createdKind === "reminder"
                  ? `/api/reminders/${linkedItemId}`
                  : createdKind === "note"
                  ? `/api/notes/${linkedItemId}`
                  : null;
          if (deletePath) {
            await fetch(deletePath, { method: "DELETE" }).catch(() => null);
          }
        }
        await fetch(`/api/files/${uploadData.id}/hard`, { method: "DELETE" }).catch(() => null);
        setError((patchData && patchData.error) || UI_STRINGS.SAVE_FAILED);
        return true;
      }
    }

    clearAttachment();
    await finalizeCreateSuccess({ requestId, createdTypes: [createdKind, "file"] });

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
      setScribblePromptRaw("");
      setError(editState ? UI_STRINGS.REMINDER_EMPTY : UI_STRINGS.CAPTURE_EMPTY);
      setSuccess("");
      return;
    }

    const moduleCaptureBehavior = moduleCaptureBehaviorFromPathname(pathname);
    const cleanHasKnownGrammar = isKnownCaptureGrammar(clean);
    const cleanForSubmit = applyModuleImpliedGrammar(pathname, clean, {
      isEditing: Boolean(editState),
      hasAttachedFile: Boolean(attachedFile),
    });

    if (
      !editState &&
      !attachedFile &&
      !cleanHasKnownGrammar &&
      moduleCaptureBehavior?.requiresAttachedFile
    ) {
      setScribblePromptRaw("");
      setError(UI_STRINGS.ATTACH_FILE_FIRST);
      setSuccess("");
      return;
    }

    if (!editState && !attachedFile && cleanForSubmit === clean && !cleanHasKnownGrammar) {
      promptForScribble(clean);
      return;
    }

    submitLockRef.current = true;
    const requestId = beginCaptureRequest();
    setIsSubmitting(true);
    setScribblePromptRaw("");
    setError("");
    setSuccess("");

    try {
      if (!editState && !attachedFile && cleanForSubmit.startsWith(":::") && !isImplicitNoteCreate(pathname, clean, cleanForSubmit)) {
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
        const handled = await submitAttachedFile(cleanForSubmit, requestId);
        if (handled) {
          return;
        }
      }

      if ((editState?.kind === "note" && !editState?.id) || isImplicitNoteCreate(pathname, clean, cleanForSubmit)) {
        const res = await fetch("/api/notes/raw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: cleanForSubmit }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          if (!isActiveCaptureRequest(requestId)) return;
          setError((data && data.error) || UI_STRINGS.SAVE_FAILED);
          return;
        }

        cancelEdit();
        await finalizeCreateSuccess({ requestId, createdTypes: "note" });
        return;
      }

      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw: cleanForSubmit,
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

      await finalizeCreateSuccess({ requestId, createdTypes: createdTypesFromCaptureResponse(data) });
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
      dispatchCaptureCreated("note");
      navigateAfterCreate(router, "note");
    } catch {
      setNewNoteError(UI_STRINGS.NOTE_SAVE_FAILED);
    } finally {
      setIsSavingNote(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="topCaptureBar">
        <div
          ref={captureContainerRef}
          className={`topCaptureInner${isDropActive ? " topCaptureDropActive" : ""}`}
          onDragEnter={onCaptureDragEnter}
          onDragOver={onCaptureDragOver}
          onDragLeave={onCaptureDragLeave}
          onDrop={onCaptureDrop}
        >
          <textarea
            ref={textareaRef}
            className="textInput autoTextarea topCaptureInput"
            value={raw}
            onChange={(event) => {
              setScribblePromptRaw("");
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
          <div className="topCaptureFooter">
            <div
              className={`topCaptureStatus${error ? " errorText" : !error && success ? " successText" : " topCaptureModeLabel"}`}
            >
              {statusText}
            </div>

            <div className="topCaptureActions">
              <input
                ref={fileInputRef}
                className="visuallyHiddenFileInput"
                type="file"
                disabled={isSubmitting || Boolean(editState)}
                onChange={onFileSelected}
                aria-label={UI_STRINGS.ATTACH_FILE}
              />

              {scribblePromptRaw ? (
                <>
                  <button className="button pillButton buttonToneEdit topCaptureButton" type="button" onClick={sendPromptToScribble} disabled={isSubmitting}>
                    Scribble
                  </button>
                  <button className="button pillButton buttonToneNeutral topCaptureCancelButton" type="button" onClick={cancelScribblePrompt} disabled={isSubmitting}>
                    {UI_STRINGS.CANCEL}
                  </button>
                </>
              ) : (
                <>
                  <button className="button pillButton buttonToneNeutral topCaptureCaptureButton" type="button" onClick={onOpenCapturePage} disabled={isSubmitting}>
                    G
                  </button>

                  <button className="button pillButton buttonToneEdit topCaptureAttachButton" type="button" onClick={onPickFile} disabled={isSubmitting}>
                    {UI_STRINGS.ATTACH_ICON}
                  </button>

                  <button className="button pillButton buttonToneSave topCaptureButton" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? UI_STRINGS.ELLIPSIS : editState ? UI_STRINGS.SAVE : UI_STRINGS.ADD}
                  </button>

                  {editState ? (
                    <button
                      className="button pillButton buttonToneNeutral topCaptureCancelButton"
                      type="button"
                      onClick={cancelEdit}
                      disabled={isSubmitting}
                    >
                      {UI_STRINGS.CANCEL}
                    </button>
                  ) : null}
                </>
              )}
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
