from __future__ import annotations


def export_task_raw(task: dict) -> str:
    lines: list[str] = []

    title = str(task.get("title") or "").strip()
    lines.append(f"- {title}")

    due_at = str(task.get("due_at") or "").strip()
    if due_at:
        lines.append(f"d:{due_at}")

    memo = task.get("memo")
    if memo is not None and str(memo).strip():
        lines.append('"""')
        lines.extend(str(memo).splitlines())
        lines.append('"""')

    return "\n".join(lines)


def parse_task_raw(raw_text: str) -> dict:
    text = str(raw_text or "").replace("\r\n", "\n").strip()
    if not text:
        raise ValueError("title is required")

    lines = text.split("\n")
    title: str | None = None
    due_at: str | None = None
    memo_lines: list[str] = []

    in_memo = False

    for original_line in lines:
        line = original_line.rstrip()

        if in_memo:
            if line.strip() == '"""':
                in_memo = False
            else:
                memo_lines.append(original_line)
            continue

        stripped = line.strip()
        if not stripped:
            continue

        if title is None:
            if stripped.startswith("- "):
                title = stripped[2:].strip()
            else:
                title = stripped
            continue

        if stripped.startswith("d:"):
            due_at = stripped[2:].strip() or None
            continue

        if stripped == '"""':
            in_memo = True
            continue

        # extra non-empty lines after title are treated as memo
        memo_lines.append(original_line)

    if in_memo:
        raise ValueError('unclosed memo block')

    if not title:
        raise ValueError("title is required")

    memo = "\n".join(memo_lines).strip() if memo_lines else None

    return {
        "title": title,
        "due_at": due_at,
        "memo": memo,
    }