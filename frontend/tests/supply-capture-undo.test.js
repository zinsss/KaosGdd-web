import test from "node:test";
import assert from "node:assert/strict";

import {
  SUPPLY_CAPTURE_PENDING_MESSAGE,
  supplyUndoNoticeFromCaptureCreatedEvent,
} from "../lib/supply-capture-undo.js";

test("supplies capture-created event with undo response yields inline Undo notice", () => {
  const event = {
    detail: {
      createdTypes: ["supply"],
      response: {
        undo: {
          undo_token: "undo-token-1",
          action: "mark_pending",
          supply_id: "supply-1",
        },
      },
    },
  };

  assert.deepEqual(supplyUndoNoticeFromCaptureCreatedEvent(event), {
    message: SUPPLY_CAPTURE_PENDING_MESSAGE,
    undoToken: "undo-token-1",
  });
});

test("supplies capture-created event without undo response has no Undo notice", () => {
  assert.equal(supplyUndoNoticeFromCaptureCreatedEvent({ detail: { createdTypes: ["supply"] } }), null);
  assert.equal(
    supplyUndoNoticeFromCaptureCreatedEvent({
      detail: {
        createdTypes: ["task"],
        response: { undo: { undo_token: "undo-token-1" } },
      },
    }),
    null,
  );
});
