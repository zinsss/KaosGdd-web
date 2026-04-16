from app.utils.timefmt import format_dt_for_ui


def build_push_title(*, target_kind: str) -> str:
    normalized = str(target_kind or "reminder").strip().lower()
    if normalized == "task":
        return "Task Reminder"
    if normalized == "event":
        return "Event Reminder"
    return "Reminder"


def build_push_body(
    *,
    item_title: str,
    remind_at: str | None,
    due_at: str | None = None,
    memo: str | None = None,
) -> str:
    lines: list[str] = []

    title = str(item_title or "").strip()
    if title:
        lines.append(title)

    remind_display = format_dt_for_ui(remind_at) if remind_at else None
    if remind_display:
        lines.append(f"Remind: {remind_display}")

    due_display = format_dt_for_ui(due_at) if due_at else None
    if due_display:
        lines.append(f"Due: {due_display}")

    memo_line = _first_short_line(memo)
    if memo_line:
        lines.append(memo_line)

    return "\n".join(lines)


def _first_short_line(memo: str | None, *, max_len: int = 100) -> str | None:
    if not memo:
        return None
    for raw_line in str(memo).splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if len(line) <= max_len:
            return line
        return line[: max_len - 1].rstrip() + "…"
    return None
