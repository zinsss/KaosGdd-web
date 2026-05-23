import { UI_STRINGS } from "./strings.js";

export function deriveTitleFromFilename(filename) {
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

export function nextCaptureAttachmentState({ file, raw, isEditing = false, hasDirectory = false, fileCount = 1 }) {
  if (isEditing) {
    return { ok: false, error: UI_STRINGS.FILE_DROP_EDIT_MODE_UNAVAILABLE };
  }
  if (hasDirectory) {
    return { ok: false, error: UI_STRINGS.FILE_DROP_FOLDER_UNSUPPORTED };
  }
  if (fileCount === 0 || !file) {
    return { ok: false, error: UI_STRINGS.FILE_DROP_EMPTY };
  }
  if (fileCount > 1) {
    return { ok: false, error: UI_STRINGS.FILE_DROP_SINGLE_FILE_ONLY };
  }

  const filename = file.name || UI_STRINGS.FILE_SELECTED_FALLBACK;
  const currentRaw = String(raw || "");
  return {
    ok: true,
    file,
    filename,
    raw: currentRaw.trim() ? currentRaw : `++ ${deriveTitleFromFilename(filename)}`,
  };
}

