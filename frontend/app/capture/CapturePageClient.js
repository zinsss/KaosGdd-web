"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { UI_STRINGS } from "../../lib/strings";

const ITEM_TYPES = [
  { value: "task", label: "Task" },
  { value: "event", label: "Event" },
  { value: "reminder", label: "Reminder" },
  { value: "journal", label: "Journal" },
];

const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeTags(input) {
  const seen = new Set();
  const tags = [];
  const tokens = String(input || "")
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^#+/, "").trim().toLowerCase())
    .filter(Boolean);

  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    tags.push(token);
  }

  return tags;
}

function buildRaw({ type, title, due, remindAt, repeat, eventDate, reminderAt, tagsInput, memo, body }) {
  const tags = normalizeTags(tagsInput);
  const tagText = tags.length ? tags.map((tag) => `#${tag}`).join(" ") : "";

  if (type === "task") {
    const parts = ["--", String(title || "").trim()];
    if (due.trim()) parts.push(`d:${due.trim()}`);
    if (remindAt.trim()) parts.push(`r:${remindAt.trim()}`);
    if (repeat.trim()) parts.push(`R:${repeat.trim()}`);
    if (tagText) parts.push(tagText);
    const firstLine = parts.join(" ").trim();
    if (memo.trim()) {
      return `${firstLine}\n"""\n${memo.trim()}\n"""`;
    }
    return firstLine;
  }

  if (type === "event") {
    const parts = ["^^", String(title || "").trim()];
    if (eventDate.trim()) parts.push(`d:${eventDate.trim()}`);
    if (repeat.trim()) parts.push(`R:${repeat.trim()}`);
    if (tagText) parts.push(tagText);
    const firstLine = parts.join(" ").trim();
    if (memo.trim()) {
      return `${firstLine}\n"""\n${memo.trim()}\n"""`;
    }
    return firstLine;
  }

  if (type === "reminder") {
    const parts = ["!!", String(reminderAt || "").trim(), String(title || "").trim()];
    if (tagText) parts.push(tagText);
    return parts.join(" ").trim();
  }

  const journalParts = ["//", String(body || "").trim()];
  if (tagText) journalParts.push(tagText);
  return journalParts.join(" ").trim();
}

function validate({ type, title, due, remindAt, eventDate, reminderAt, body, raw }) {
  const errors = {};

  if (type === "task" && !title.trim()) {
    errors.title = "Title is required.";
  }

  if (type === "event") {
    if (!title.trim()) errors.title = "Title is required.";
    if (!eventDate.trim()) {
      errors.eventDate = "Date is required.";
    } else if (!DATE_RE.test(eventDate.trim())) {
      errors.eventDate = "Use yyyy-mm-dd format.";
    }
  }

  if (type === "reminder") {
    if (!title.trim()) errors.title = "Title is required.";
    if (!reminderAt.trim()) {
      errors.reminderAt = "Datetime is required.";
    } else if (!DATETIME_RE.test(reminderAt.trim())) {
      errors.reminderAt = "Use yyyy-mm-dd HH:MM format.";
    }
  }

  if (type === "journal" && !body.trim()) {
    errors.body = "Body is required.";
  }

  if (due.trim() && !DATETIME_RE.test(due.trim())) {
    errors.due = "Use yyyy-mm-dd HH:MM format.";
  }

  if (remindAt.trim() && !DATETIME_RE.test(remindAt.trim())) {
    errors.remindAt = "Use yyyy-mm-dd HH:MM format.";
  }

  if (!raw.trim()) {
    errors.raw = "Generated raw is empty.";
  }

  return errors;
}

export default function CapturePageClient() {
  const [type, setType] = useState("task");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [repeat, setRepeat] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [memo, setMemo] = useState("");
  const [body, setBody] = useState("");

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [statusSuccess, setStatusSuccess] = useState("");

  const raw = useMemo(
    () =>
      buildRaw({
        type,
        title,
        due,
        remindAt,
        repeat,
        eventDate,
        reminderAt,
        tagsInput,
        memo,
        body,
      }),
    [type, title, due, remindAt, repeat, eventDate, reminderAt, tagsInput, memo, body],
  );

  async function onSubmit(event) {
    event.preventDefault();

    const nextErrors = validate({ type, title, due, remindAt, eventDate, reminderAt, body, raw });
    setErrors(nextErrors);
    setStatusError("");
    setStatusSuccess("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setStatusError((data && data.error) || UI_STRINGS.CAPTURE_FAILED);
        return;
      }

      setStatusSuccess(UI_STRINGS.SAVED);
      setErrors({});
      if (type === "journal") {
        setBody("");
      } else {
        setTitle("");
      }
      setDue("");
      setRemindAt("");
      setRepeat("");
      setEventDate("");
      setReminderAt("");
      setTagsInput("");
      setMemo("");
    } catch {
      setStatusError(UI_STRINGS.CAPTURE_FAILED);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="panel capturePanel">
        <div className="sectionTitle">Capture</div>

        <form onSubmit={onSubmit} className="captureForm" noValidate>
          <fieldset className="captureTypeGroup" disabled={isSaving}>
            <legend className="captureLabel">Type</legend>
            <div className="captureTypeRow">
              {ITEM_TYPES.map((item) => (
                <label key={item.value} className="captureTypeOption">
                  <input
                    type="radio"
                    name="capture-type"
                    value={item.value}
                    checked={type === item.value}
                    onChange={(e) => setType(e.target.value)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {type !== "journal" ? (
            <label className="captureField">
              <span className="captureLabel">Title</span>
              <input className="textInput" value={title} onChange={(e) => setTitle(e.target.value)} />
              {errors.title ? <span className="errorText">{errors.title}</span> : null}
            </label>
          ) : null}

          {type === "task" ? (
            <>
              <label className="captureField">
                <span className="captureLabel">Due</span>
                <input
                  className="textInput"
                  placeholder="yyyy-mm-dd HH:MM"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
                {errors.due ? <span className="errorText">{errors.due}</span> : null}
              </label>

              <label className="captureField">
                <span className="captureLabel">Reminder</span>
                <input
                  className="textInput"
                  placeholder="yyyy-mm-dd HH:MM"
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value)}
                />
                {errors.remindAt ? <span className="errorText">{errors.remindAt}</span> : null}
              </label>

              <label className="captureField">
                <span className="captureLabel">Repeat</span>
                <input className="textInput" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
              </label>
            </>
          ) : null}

          {type === "event" ? (
            <>
              <label className="captureField">
                <span className="captureLabel">Date</span>
                <input className="textInput" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                {errors.eventDate ? <span className="errorText">{errors.eventDate}</span> : null}
              </label>

              <label className="captureField">
                <span className="captureLabel">Repeat</span>
                <input className="textInput" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
              </label>
            </>
          ) : null}

          {type === "reminder" ? (
            <label className="captureField">
              <span className="captureLabel">Datetime</span>
              <input
                className="textInput"
                placeholder="yyyy-mm-dd HH:MM"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
              />
              {errors.reminderAt ? <span className="errorText">{errors.reminderAt}</span> : null}
            </label>
          ) : null}

          {type === "journal" ? (
            <label className="captureField">
              <span className="captureLabel">Body</span>
              <textarea className="textInput" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
              {errors.body ? <span className="errorText">{errors.body}</span> : null}
            </label>
          ) : null}

          <label className="captureField">
            <span className="captureLabel">Tags</span>
            <input
              className="textInput"
              placeholder="home errand #work"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </label>

          {type === "task" || type === "event" ? (
            <label className="captureField">
              <span className="captureLabel">Memo</span>
              <textarea className="textInput" rows={4} value={memo} onChange={(e) => setMemo(e.target.value)} />
            </label>
          ) : null}

          <details className="capturePreview" open>
            <summary>Raw Preview</summary>
            <pre>{raw || "(empty)"}</pre>
          </details>

          {errors.raw ? <div className="errorText">{errors.raw}</div> : null}
          {statusError ? <div className="errorText">{statusError}</div> : null}
          {statusSuccess ? <div className="successText">{statusSuccess}</div> : null}

          <div className="captureActions">
            <button type="submit" className="button" disabled={isSaving}>
              {isSaving ? UI_STRINGS.SAVING : UI_STRINGS.SAVE}
            </button>
            <Link className="button" href="/">
              {UI_STRINGS.CANCEL}
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
