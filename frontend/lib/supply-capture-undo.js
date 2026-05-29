import { captureCreatedEventHasType } from "./post-create-navigation.js";

export const SUPPLY_CAPTURE_PENDING_MESSAGE = "Marked pending.";

export function supplyUndoNoticeFromCaptureCreatedEvent(event) {
  if (!captureCreatedEventHasType(event, "supply")) return null;

  const undoToken = event?.detail?.response?.undo?.undo_token;
  if (!undoToken) return null;

  return {
    message: SUPPLY_CAPTURE_PENDING_MESSAGE,
    undoToken,
  };
}
