export const DEFAULT_MODULE_NAV_STATUS = {
  has_overdue_tasks: false,
  has_today_events: false,
  has_missed_reminders: false,
  has_unacked_reminders: false,
  has_strong_attention: false,
  strong_attention_count: 0,
  has_pending_supplies: false,
  has_note_draft: false,
  has_file_draft: false,
  has_attention_fax: false,
  attention_task_count: 0,
  attention_reminder_count: 0,
  attention_fax_count: 0,
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
  const hasAttentionFax = Boolean(payload.has_attention_fax);
  const attentionTaskCount = Math.max(0, Number(payload.attention_task_count) || 0);
  const attentionReminderCount = Math.max(0, Number(payload.attention_reminder_count) || 0);
  const attentionFaxCount = Math.max(0, Number(payload.attention_fax_count) || 0);
  const payloadStrongAttentionCount = Number(payload.strong_attention_count);
  const hasExplicitStrongAttentionCount = Number.isFinite(payloadStrongAttentionCount);
  const fallbackStrongAttentionCount =
    attentionTaskCount +
    attentionReminderCount +
    attentionFaxCount ||
    (hasOverdueTasks ? 1 : 0) + (hasUnackedReminders ? 1 : 0) + (hasAttentionFax ? 1 : 0);
  const strongAttentionCount = hasExplicitStrongAttentionCount
    ? Math.max(0, payloadStrongAttentionCount)
    : fallbackStrongAttentionCount;
  const fallbackHasStrongAttention = Boolean(payload.has_strong_attention) || fallbackStrongAttentionCount > 0;
  const hasStrongAttention = hasExplicitStrongAttentionCount ? strongAttentionCount > 0 : fallbackHasStrongAttention;

  return {
    has_overdue_tasks: hasOverdueTasks,
    has_today_events: Boolean(payload.has_today_events),
    has_missed_reminders: hasMissedReminders,
    has_unacked_reminders: hasUnackedReminders,
    has_strong_attention: hasStrongAttention,
    strong_attention_count: strongAttentionCount,
    has_pending_supplies: Boolean(payload.has_pending_supplies),
    has_note_draft: Boolean(payload.has_note_draft),
    has_file_draft: Boolean(payload.has_file_draft),
    has_attention_fax: hasAttentionFax,
    attention_task_count: attentionTaskCount,
    attention_reminder_count: attentionReminderCount,
    attention_fax_count: attentionFaxCount,
  };
}
