import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createdTypesFromCaptureResponse,
  dispatchCaptureCreated,
  postCreateDestination,
} from "../lib/post-create-navigation.js";

test('fax wins post-create navigation when a fax also creates a file', () => {
  assert.equal(postCreateDestination(["fax", "file"]), "/fax");
  assert.equal(postCreateDestination(["file", "fax"]), "/fax");
});

test('file-only post-create navigation still goes to files', () => {
  assert.equal(postCreateDestination(["file"]), "/files");
});

test('attached fax capture-created event reports both fax and file', () => {
  const events = [];
  global.window = {
    dispatchEvent(event) {
      events.push(event);
    },
  };

  try {
    dispatchCaptureCreated(["fax", "file"], { ok: true });
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].detail.createdTypes, ["fax", "file"]);
    assert.deepEqual(events[0].detail.response, { ok: true });
  } finally {
    delete global.window;
  }
});

test("createdTypesFromCaptureResponse only extracts created type metadata", () => {
  assert.deepEqual(
    createdTypesFromCaptureResponse({
      ok: true,
      kind: "supply",
      created_types: ["supply"],
      ignored_metadata: { value: "not-a-created-type" },
    }),
    ["supply"],
  );

  assert.deepEqual(
    createdTypesFromCaptureResponse({
      created_types: ["supplies"],
      kind: "supply",
    }),
    ["supply"],
  );
});

test("capture-created event helper has no hidden pending response state", async () => {
  const source = await readFile(new URL("../lib/post-create-navigation.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /pendingCaptureResponse/);
});
