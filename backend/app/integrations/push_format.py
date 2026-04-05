from app.utils.timefmt import format_dt_for_ui


def build_item_push_heading(*, item_type: str | None, title: str) -> str:
    kind = str(item_type or "item").strip().upper()
    clean_title = str(title or "").strip()
    if not clean_title:
        return kind
    return f"{kind} • {clean_title}"


def build_reminder_push_message(
    *,
    item_type: str | None,
    title: str,
    due_at: str | None,
    remind_at: str | None,
) -> str:
    lines: list[str] = []

    lines.append(build_item_push_heading(item_type=item_type, title=title))

    due_display = format_dt_for_ui(due_at) if due_at else None
    remind_display = format_dt_for_ui(remind_at) if remind_at else None

    if due_display:
        lines.append(f"📅 {due_display}")

    if remind_display:
        lines.append(f"⏰ {remind_display}")

    return "\n\n".join(lines)