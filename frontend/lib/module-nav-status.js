export const DEFAULT_MODULE_NAV_STATUS = {
  has_overdue_tasks: false,
  has_today_events: false,
  has_missed_reminders: false,
  has_pending_supplies: false,
  has_note_draft: false,
  has_file_draft: false,
  has_attention_fax: false,
};

export function hasAppAttention(status) {
  const navStatus = normalizeModuleNavStatus(status);
  return (
    navStatus.has_overdue_tasks ||
    navStatus.has_missed_reminders ||
    navStatus.has_pending_supplies ||
    navStatus.has_note_draft ||
    navStatus.has_file_draft ||
    navStatus.has_attention_fax
  );
}

export function normalizeModuleNavStatus(payload) {
  if (!payload || typeof payload !== "object") return { ...DEFAULT_MODULE_NAV_STATUS };

  return {
    has_overdue_tasks: Boolean(payload.has_overdue_tasks),
    has_today_events: Boolean(payload.has_today_events),
    has_missed_reminders: Boolean(payload.has_missed_reminders),
    has_pending_supplies: Boolean(payload.has_pending_supplies),
    has_note_draft: Boolean(payload.has_note_draft),
    has_file_draft: Boolean(payload.has_file_draft),
    has_attention_fax: Boolean(payload.has_attention_fax),
  };
}
