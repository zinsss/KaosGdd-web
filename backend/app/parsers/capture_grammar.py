from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Literal

from app.utils.repeat import normalize_repeat_rule

UNDONE_TASK_PREFIX = "-- "
DONE_TASK_PREFIX = "-x "
UNDONE_SUBTASK_PREFIX = "--- "
DONE_SUBTASK_PREFIX = "--x "
EVENT_PREFIX = "^^ "
REMINDER_PREFIX = "!! "
JOURNAL_PREFIX = "// "
MODAL_PREFIXES: dict[str, str] = {
    ":::": "note",
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
REMINDER_LEADING_DATETIME_RE = re.compile(r"^(?P<dt>\S+(?:\s+\S+)?)(?:\s+(?P<title>.*))?$")

ActionType = Literal["create_item", "open_modal"]
ItemType = Literal["task", "event", "reminder", "journal", "supply"]
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
    subtasks: list[dict] = field(default_factory=list)
    is_done: bool = False
    start_date: str | None = None
    end_date: str | None = None
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
            return ParseResult(ok=True, action="open_modal", modal_type=modal_type, title=rest or None).to_dict()

    item_type: ItemType | None = None
    title: str | None = None
    is_done = False
    start_date = None
    end_date = None

    if first.startswith(UNDONE_TASK_PREFIX):
        item_type = "task"
        title = first[len(UNDONE_TASK_PREFIX) :].strip()
    elif first.startswith(DONE_TASK_PREFIX):
        item_type = "task"
        title = first[len(DONE_TASK_PREFIX) :].strip()
        is_done = True
    elif first == "^^":
        item_type = "event"
        return ParseResult(ok=False, error="missing date after ^^").to_dict()
    elif first.startswith("^^"):
        if not first.startswith(EVENT_PREFIX):
            return ParseResult(ok=False, error="event line must start with ^^ ").to_dict()
        item_type = "event"
        date_part = first[len(EVENT_PREFIX) :].strip()
        if not date_part:
            return ParseResult(ok=False, error="missing date after ^^").to_dict()
        if "~" in date_part:
            parts = [part.strip() for part in date_part.split("~")]
            if len(parts) != 2 or not parts[0] or not parts[1]:
                return ParseResult(ok=False, error="malformed range").to_dict()
            start_date, end_date = parts[0], parts[1]
        else:
            start_date = date_part
    elif first == "!!":
        item_type = "reminder"
        title = ""
    elif first.startswith("!!"):
        item_type = "reminder"
        title = first[2:].strip()
    elif first == "//":
        item_type = "journal"
        title = ""
    elif first.startswith(JOURNAL_PREFIX):
        item_type = "journal"
        title = first[len(JOURNAL_PREFIX) :].strip()
    elif first == "$$":
        return ParseResult(ok=False, error="title is required").to_dict()
    elif first.startswith("$$"):
        if len(first) > 2 and not first[2].isspace():
            return ParseResult(ok=False, error="supply line must start with $$ ").to_dict()
        item_type = "supply"
        title = first[2:].strip()
    elif first.startswith(UNDONE_SUBTASK_PREFIX) or first.startswith(DONE_SUBTASK_PREFIX):
        return ParseResult(ok=False, error="subtask line requires a parent task").to_dict()
    else:
        return ParseResult(ok=False, error="unsupported prefix").to_dict()

    result = ParseResult(ok=True, action="create_item", item_type=item_type, title=title, is_done=is_done, start_date=start_date, end_date=end_date)
    repeat_seen = False

    in_memo = False
    memo_lines: list[str] = []
    journal_lines: list[str] = []

    reminder_title_lines: list[str] = []
    if result.item_type == "reminder" and result.title:
        reminder_title_lines.append(result.title)

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
            if result.item_type == "journal":
                return ParseResult(ok=False, error="journal does not support memo blocks").to_dict()
            in_memo = True
            continue

        if result.item_type == "event" and not result.title:
            if line.startswith("#") or line.startswith(META_REMIND) or line == MEMO_DELIM:
                return ParseResult(ok=False, error="missing title").to_dict()
            result.title = line
            continue

        if result.item_type == "journal":
            if re.search(r"(?:^|\s)(d:|r:|R:)", line):
                return ParseResult(ok=False, error="journal does not support r:, d:, or R:").to_dict()
            if line.startswith("#"):
                result.tags.extend(TAG_RE.findall(line))
            else:
                journal_lines.append(original)
            continue

        if result.item_type == "supply":
            return ParseResult(ok=False, error=f"unrecognized line: {original}").to_dict()

        if line.startswith(UNDONE_SUBTASK_PREFIX) or line.startswith(DONE_SUBTASK_PREFIX):
            if result.item_type != "task":
                return ParseResult(ok=False, error="subtasks only allowed under task").to_dict()

            if line.startswith(DONE_SUBTASK_PREFIX):
                subtask = line[len(DONE_SUBTASK_PREFIX) :].strip()
                subtask_done = True
            else:
                subtask = line[len(UNDONE_SUBTASK_PREFIX) :].strip()
                subtask_done = False

            if not subtask:
                return ParseResult(ok=False, error="subtask title is required").to_dict()
            if TAG_RE.search(subtask) or re.search(r"(?:^|\s)(d:|r:|R:)", subtask):
                return ParseResult(ok=False, error="subtask metadata is not allowed").to_dict()
            result.subtasks.append({"content": subtask, "is_done": subtask_done, "position": len(result.subtasks)})
            continue

        if line.startswith(META_DUE):
            if result.item_type == "event":
                return ParseResult(ok=False, error="unsupported extra event grammar").to_dict()
            result.due_at = line[len(META_DUE) :].strip() or None
            continue

        if line.startswith(META_REMIND):
            result.remind_at = line[len(META_REMIND) :].strip() or None
            continue

        if line.startswith(META_REPEAT):
            if result.item_type == "event":
                return ParseResult(ok=False, error="unsupported extra event grammar").to_dict()
            if repeat_seen:
                return ParseResult(ok=False, error="multiple R: lines are not allowed").to_dict()
            raw_repeat = line[len(META_REPEAT) :].strip() or None
            try:
                result.repeat_rule = normalize_repeat_rule(raw_repeat)
            except ValueError:
                return ParseResult(ok=False, error=f"invalid repeat rule: {raw_repeat}").to_dict()
            repeat_seen = True
            continue

        if line.startswith("#"):
            result.tags.extend(TAG_RE.findall(line))
            continue

        if result.item_type == "reminder":
            reminder_title_lines.append(line)
            continue

        return ParseResult(ok=False, error=f"unrecognized line: {original}").to_dict()

    if in_memo:
        return ParseResult(ok=False, error='memo block not closed with """').to_dict()

    if result.item_type == "reminder":
        reminder_title = " ".join(part.strip() for part in reminder_title_lines if part.strip()).strip()

        if reminder_title:
            dt_match = REMINDER_LEADING_DATETIME_RE.match(reminder_title)
            if dt_match:
                candidate = (dt_match.group("dt") or "").strip()
                trailing = (dt_match.group("title") or "").strip()
                if re.fullmatch(r"\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}", candidate):
                    result.remind_at = candidate
                    result.title = trailing
                else:
                    result.title = reminder_title
            else:
                result.title = reminder_title
        else:
            result.title = ""

    if result.item_type == "journal" and not result.title:
        return ParseResult(ok=False, error="journal content is required").to_dict()

    if result.item_type == "reminder" and not result.remind_at:
        return ParseResult(ok=False, error="!! requires at least one reminder datetime").to_dict()

    if result.item_type not in {"event", "journal"} and not result.title:
        return ParseResult(ok=False, error="title is required").to_dict()

    if result.item_type == "event" and not result.title:
        return ParseResult(ok=False, error="missing title").to_dict()

    if memo_lines:
        result.memo = "\n".join(memo_lines).rstrip("\n")

    if result.item_type == "journal" and journal_lines:
        result.memo = "\n".join(journal_lines).rstrip("\n")

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
