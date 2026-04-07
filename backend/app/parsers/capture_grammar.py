from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Literal

TASK_PREFIX = "-- "
SUBTASK_PREFIX = "--- "
EVENT_PREFIX = "^^ "
REMINDER_PREFIX = "!! "
JOURNAL_PREFIX = "// "

MODAL_PREFIXES: dict[str, str] = {
    "::": "note",
    "==": "list",
    "++": "file",
    "fax:": "fax",
    "mail:": "mail",
}

META_DUE = "d:"
META_REMIND = "r:"
META_REPEAT = "R:"
MEMO_DELIM = '"""'
TAG_RE = re.compile(r"#([^\s#]+)")

ActionType = Literal["create_item", "open_modal"]
ItemType = Literal["task", "event", "reminder", "journal"]
ModalType = Literal["note", "list", "file", "fax", "mail"]


@dataclass
class ParseResult:
    ok: bool
    action: ActionType | None = None
    item_type: ItemType | None = None
    modal_type: ModalType | None = None
    title: str | None = None
    due_at: str | None = None
    remind_at: str | None = None
    repeat_rule: str | None = None
    tags: list[str] = field(default_factory=list)
    memo: str | None = None
    subtasks: list[str] = field(default_factory=list)
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def parse_capture(raw: str) -> dict:
    text = (raw or "").strip()
    if not text:
        return ParseResult(ok=False, error="input is empty").to_dict()

    lines = [line.rstrip() for line in text.splitlines()]
    first_idx = next((i for i, line in enumerate(lines) if line.strip()), None)
    if first_idx is None:
        return ParseResult(ok=False, error="input is empty").to_dict()

    first = lines[first_idx].strip()

    for prefix, modal_type in MODAL_PREFIXES.items():
        if first.startswith(prefix):
            rest = first[len(prefix) :].strip()
            return ParseResult(
                ok=True,
                action="open_modal",
                modal_type=modal_type,
                title=rest or None,
            ).to_dict()

    item_type: ItemType | None = None
    title: str | None = None

    if first.startswith(TASK_PREFIX):
        item_type = "task"
        title = first[len(TASK_PREFIX) :].strip()
    elif first.startswith(EVENT_PREFIX):
        item_type = "event"
        title = first[len(EVENT_PREFIX) :].strip()
    elif first.startswith(REMINDER_PREFIX):
        item_type = "reminder"
        title = first[len(REMINDER_PREFIX) :].strip()
    elif first.startswith(JOURNAL_PREFIX):
        item_type = "journal"
        title = first[len(JOURNAL_PREFIX) :].strip()
    else:
        return ParseResult(ok=False, error="unsupported prefix").to_dict()

    if not title:
        return ParseResult(ok=False, error="title is required").to_dict()

    result = ParseResult(
        ok=True,
        action="create_item",
        item_type=item_type,
        title=title,
    )

    in_memo = False
    memo_lines: list[str] = []

    for original in lines[first_idx + 1 :]:
        line = original.strip()

        if in_memo:
            if line == MEMO_DELIM:
                in_memo = False
            else:
                memo_lines.append(original)
            continue

        if not line:
            continue

        if line == MEMO_DELIM:
            in_memo = True
            continue

        if line.startswith(SUBTASK_PREFIX):
            if result.item_type != "task":
                return ParseResult(ok=False, error="subtasks only allowed under task").to_dict()
            subtask = line[len(SUBTASK_PREFIX) :].strip()
            if not subtask:
                return ParseResult(ok=False, error="subtask title is required").to_dict()
            result.subtasks.append(subtask)
            continue

        if line.startswith(META_DUE):
            result.due_at = line[len(META_DUE) :].strip() or None
            continue

        if line.startswith(META_REMIND):
            result.remind_at = line[len(META_REMIND) :].strip() or None
            continue

        if line.startswith(META_REPEAT):
            result.repeat_rule = line[len(META_REPEAT) :].strip() or None
            continue

        if line.startswith("#"):
            result.tags.extend(TAG_RE.findall(line))
            continue

        return ParseResult(ok=False, error=f"unrecognized line: {original}").to_dict()

    if in_memo:
        return ParseResult(ok=False, error='memo block not closed with """').to_dict()

    if memo_lines:
        result.memo = "\n".join(memo_lines).rstrip("\n")

    seen: set[str] = set()
    deduped: list[str] = []
    for tag in result.tags:
        lowered = tag.lower()
        if lowered not in seen:
            seen.add(lowered)
            deduped.append(lowered)
    result.tags = deduped

    return result.to_dict()


__all__ = ["parse_capture", "ParseResult"]
