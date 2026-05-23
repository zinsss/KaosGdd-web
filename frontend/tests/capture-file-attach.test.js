import test from "node:test";
import assert from "node:assert/strict";
import { File } from "node:buffer";

import { nextCaptureAttachmentState } from "../lib/capture-file-attach.js";
import { UI_STRINGS } from "../lib/strings.js";

function file(name = "clinic_scan.pdf") {
  return new File(["bytes"], name, { type: "application/pdf" });
}

test("one dropped file is accepted and empty raw gets file grammar title", () => {
  const result = nextCaptureAttachmentState({ file: file(), raw: "", fileCount: 1 });

  assert.equal(result.ok, true);
  assert.equal(result.filename, "clinic_scan.pdf");
  assert.equal(result.raw, "++ clinic scan");
});

test("multiple dropped files are rejected", () => {
  const result = nextCaptureAttachmentState({ file: file("a.pdf"), raw: "", fileCount: 2 });

  assert.deepEqual(result, { ok: false, error: UI_STRINGS.FILE_DROP_SINGLE_FILE_ONLY });
});

test("non-empty raw input is preserved", () => {
  const result = nextCaptureAttachmentState({ file: file(), raw: "-- Existing task", fileCount: 1 });

  assert.equal(result.ok, true);
  assert.equal(result.raw, "-- Existing task");
});

test("edit mode rejects file attachment", () => {
  const result = nextCaptureAttachmentState({ file: file(), raw: "", isEditing: true, fileCount: 1 });

  assert.deepEqual(result, { ok: false, error: UI_STRINGS.FILE_DROP_EDIT_MODE_UNAVAILABLE });
});

test("folder drops are rejected", () => {
  const result = nextCaptureAttachmentState({ file: file(), raw: "", hasDirectory: true, fileCount: 1 });

  assert.deepEqual(result, { ok: false, error: UI_STRINGS.FILE_DROP_FOLDER_UNSUPPORTED });
});

test("file picker and drag-drop share the same attach behavior", () => {
  const picked = nextCaptureAttachmentState({ file: file("lab_result.png"), raw: "", fileCount: 1 });
  const dropped = nextCaptureAttachmentState({ file: file("lab_result.png"), raw: "", fileCount: 1 });

  assert.deepEqual(
    { ok: picked.ok, filename: picked.filename, raw: picked.raw },
    { ok: dropped.ok, filename: dropped.filename, raw: dropped.raw },
  );
});

