export const DEFAULT_MODULE_NAV_STATUS = {
  has_overdue_tasks: false,
  has_today_events: false,
  has_missed_reminders: false,
  has_unacked_reminders: false,
  has_strong_attention: false,
  has_pending_supplies: false,
  has_note_draft: false,
  has_file_draft: false,
  has_attention_fax: false,
};

export function hasAppAttention(status) {
  const navStatus = normalizeModuleNavStatus(status);
  return (
    navStatus.has_strong_attention ||
    navStatus.has_overdue_tasks ||
    navStatus.has_missed_reminders ||
    navStatus.has_unacked_reminders ||
    navStatus.has_pending_supplies ||
    navStatus.has_note_draft ||
    navStatus.has_file_draft ||
    navStatus.has_attention_fax
  );
}

export function normalizeModuleNavStatus(payload) {
  if (!payload || typeof payload !== "object") return { ...DEFAULT_MODULE_NAV_STATUS };

  const hasOverdueTasks = Boolean(payload.has_overdue_tasks);
  const hasMissedReminders = Boolean(payload.has_missed_reminders);
  const hasUnackedReminders = Boolean(payload.has_unacked_reminders) || hasMissedReminders;
  const hasStrongAttention = Boolean(payload.has_strong_attention) || hasOverdueTasks || hasUnackedReminders;

  return {
    has_overdue_tasks: hasOverdueTasks,
    has_today_events: Boolean(payload.has_today_events),
    has_missed_reminders: hasMissedReminders,
    has_unacked_reminders: hasUnackedReminders,
    has_strong_attention: hasStrongAttention,
    has_pending_supplies: Boolean(payload.has_pending_supplies),
    has_note_draft: Boolean(payload.has_note_draft),
    has_file_draft: Boolean(payload.has_file_draft),
    has_attention_fax: Boolean(payload.has_attention_fax),
  };
}
