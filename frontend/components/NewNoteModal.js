"use client";

import { UI_STRINGS } from "../lib/strings";
import NoteMarkdownEditor from "./NoteMarkdownEditor";

export default function NewNoteModal({ open, value, onChange, onSave, onCancel, isSaving, error }) {
  if (!open) return null;

  return (
    <div className="newNoteModalOverlay" role="dialog" aria-modal="true" aria-label={UI_STRINGS.NEW_NOTE_MODAL_TITLE}>
      <div className="newNoteModalPanel">
        <div className="newNoteModalHeader">
          <div className="sectionTitle">{UI_STRINGS.NEW_NOTE_MODAL_TITLE}</div>
        </div>

        <div className="newNoteModalEditorWrap">
          <NoteMarkdownEditor value={value} onChange={onChange} height="100%" />
        </div>

        {error ? <div className="errorText">{error}</div> : null}

        <div className="actionRow newNoteModalActions">
          <button className="button" type="button" onClick={onSave} disabled={isSaving}>
            {isSaving ? UI_STRINGS.SAVING : UI_STRINGS.SAVE}
          </button>
          <button className="button" type="button" onClick={onCancel} disabled={isSaving}>
            {UI_STRINGS.CANCEL}
          </button>
        </div>
      </div>
    </div>
  );
}
