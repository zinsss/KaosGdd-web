"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dispatchAppStatusChanged } from "../lib/app-status-events";
import { UI_STRINGS } from "../lib/strings";

export default function TaskRawEditor({ taskId, initialRaw, isRepeating = false }) {
  const router = useRouter();
  const [raw, setRaw] = useState(initialRaw || "");
  const [editScope, setEditScope] = useState("current_only");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
  }, [raw]);

  async function onSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/tasks/" + taskId + "/raw", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, edit_scope: isRepeating ? editScope : undefined }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || (data && data.ok === false)) {
        setError((data && data.error) || UI_STRINGS.SAVE_FAILED);
        return;
      }

      dispatchAppStatusChanged({ source: "task", action: "raw-edit", taskId });
      router.refresh();
    } catch {
      setError(UI_STRINGS.SAVE_FAILED);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <textarea
        ref={textareaRef}
        className="textInput autoTextarea rawEditor"
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        rows={1}
        spellCheck={false}
        placeholder={'-- task title\nd:2026-04-08 15:00\nr:2026-04-08 14:00\nR:weekly\n#home #errand\n--- first subtask\n--x done subtask\n"""\nmemo\n"""'}
      />

      <div className="rawHint">
        -- task / -x task · --- subtask / --x subtask
      </div>

      {isRepeating ? (
        <fieldset className="repeatEditScope">
          <legend>{UI_STRINGS.REPEATING_TASK_EDIT_NOTICE}</legend>
          <label>
            <input
              type="radio"
              name="repeat-edit-scope"
              value="current_only"
              checked={editScope === "current_only"}
              onChange={() => setEditScope("current_only")}
            />
            {UI_STRINGS.REPEAT_SCOPE_CURRENT_ONLY}
          </label>
          <label>
            <input
              type="radio"
              name="repeat-edit-scope"
              value="this_and_future"
              checked={editScope === "this_and_future"}
              onChange={() => setEditScope("this_and_future")}
            />
            {UI_STRINGS.REPEAT_SCOPE_THIS_AND_FUTURE}
          </label>
        </fieldset>
      ) : null}

      <div className="actionRow compactActionRow rawEditorActions">
        <button className="button compactButton buttonToneSave" type="submit" disabled={isSubmitting}>
          {isSubmitting ? UI_STRINGS.SAVING : UI_STRINGS.SAVE}
        </button>
      </div>

      {error ? <div className="errorText">{error}</div> : null}
    </form>
  );
}
