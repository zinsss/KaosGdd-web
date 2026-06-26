import test from "node:test";
import assert from "node:assert/strict";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";

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

test("attached fax grammar uses transient fax upload instead of File save", async () => {
  const topCaptureSource = await readFile(new URL("../components/TopCaptureBar.js", import.meta.url), "utf8");
  const sendUploadRouteSource = await readFile(new URL("../app/api/fax/send-upload/route.js", import.meta.url), "utf8");

  assert.ok(topCaptureSource.includes('fetch("/api/fax/send-upload"'), "fax: attachment path should use the fax upload route");
  assert.ok(topCaptureSource.includes('"x-fax-number": faxNormalized.faxNumber'));
  assert.ok(topCaptureSource.includes("UI_STRINGS.FAX_QUEUED"));
  assert.ok(topCaptureSource.includes("UI_STRINGS.FAX_SEND_FAILED"));
  assert.ok(topCaptureSource.includes("UI_STRINGS.FAX_SELECT_FILE_FIRST"));
  assert.ok(topCaptureSource.includes("UI_STRINGS.FAX_NUMBER_REQUIRED"));

  const faxBranchIndex = topCaptureSource.indexOf('fetch("/api/fax/send-upload"');
  const fileUploadIndex = topCaptureSource.indexOf('fetch("/api/files"', faxBranchIndex);
  assert.ok(faxBranchIndex > 0);
  assert.ok(fileUploadIndex > faxBranchIndex, "File save upload should only appear after the quick fax branch");

  assert.ok(sendUploadRouteSource.includes('base + "/fax/send-upload"'));
  assert.ok(sendUploadRouteSource.includes('"x-fax-number": request.headers.get("x-fax-number") || ""'));
});
