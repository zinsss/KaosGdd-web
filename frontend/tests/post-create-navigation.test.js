import test from "node:test";
import assert from "node:assert/strict";

import {
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
    dispatchCaptureCreated(["fax", "file"]);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].detail.createdTypes, ["fax", "file"]);
  } finally {
    delete global.window;
  }
});
