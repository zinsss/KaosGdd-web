from app.utils.timefmt import format_dt_for_ui


def build_reminder_push_message(*, due_at: str | None, remind_at: str | None) -> str:
    lines: list[str] = []

    due_display = format_dt_for_ui(due_at) if due_at else None
    remind_display = format_dt_for_ui(remind_at) if remind_at else None

    if due_display:
        lines.append(f"📅 {due_display}")

    if remind_display:
        lines.append(f"⏰ {remind_display}")

    if not lines:
        return ""

    return "\n\n" + "\n".join(lines)