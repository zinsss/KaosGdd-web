from __future__ import annotations

import re
from typing import Any

from app.db.repo.items_repo import ItemsRepo
from app.db.repo.task_repo import TaskRepo
from app.engine.task_service import TaskService


FAMILY_TASK_DEFAULT_ASSIGNEE = "내 할 일"
FAMILY_TASK_SHARED_ASSIGNEE = "쏭 할 일"
FAMILY_TASK_DEFAULT_PRIORITY = "😄 보통"
FAMILY_TASK_MIRROR_TAG_PREFIX = "family-task:"
FAMILY_TASK_SONG_TAG = "family-song"
FAMILY_TASK_PRIORITY_TAG_PREFIX = "family-priority:"
FAMILY_TASK_PRIORITIES = {"💤 언젠가는", "😄 보통", "⭐️ 중요", "‼️ 꼭 하기"}


def _trim_blank_edges(lines: list[str]) -> list[str]:
    next_lines = list(lines)
    while next_lines and not str(next_lines[0] or "").strip():
        next_lines.pop(0)
    while next_lines and not str(next_lines[-1] or "").strip():
        next_lines.pop()
    return next_lines


def extract_family_task_checklist(description: str | None) -> dict[str, Any]:
    subtasks: list[dict[str, Any]] = []
    memo_fragments: list[str] = []
    current_memo_lines: list[str] = []

    def flush_memo_fragment() -> None:
        nonlocal current_memo_lines
        trimmed = _trim_blank_edges(current_memo_lines)
        if trimmed:
            memo_fragments.append("\n".join(trimmed))
        current_memo_lines = []

    for raw_line in str(description or "").split("\n"):
        if raw_line.startswith("- ") or raw_line.startswith("+ "):
            content = raw_line[2:].strip()
            if content:
                flush_memo_fragment()
                subtasks.append(
                    {
                        "content": content,
                        "is_done": raw_line.startswith("+ "),
                        "position": len(subtasks),
                    }
                )
            continue

        current_memo_lines.append(raw_line)

    flush_memo_fragment()
    return {"memo": "\n\n".join(memo_fragments), "subtasks": subtasks}


def build_family_task_canonical_raw(task: dict[str, Any]) -> str:
    normalized = normalize_family_task(task)
    if not normalized:
        return ""
    extracted = extract_family_task_checklist(normalized.get("description"))
    lines = [f"-- {normalized['title']}"]

    for subtask in extracted["subtasks"]:
        prefix = "--x " if subtask.get("is_done") else "--- "
        lines.append(f"{prefix}{subtask['content']}")

    if extracted["memo"]:
        lines.extend(['"""', extracted["memo"], '"""'])

    return "\n".join(lines)


def normalize_family_task(task: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(task, dict):
        return None
    title = str(task.get("title") or "").strip()
    if not title:
        return None

    task_id = str(task.get("id") or "").strip()
    if not task_id:
        return None

    assignee = str(task.get("assignee") or FAMILY_TASK_DEFAULT_ASSIGNEE).strip()
    if assignee not in {FAMILY_TASK_DEFAULT_ASSIGNEE, FAMILY_TASK_SHARED_ASSIGNEE, "전체"}:
        assignee = FAMILY_TASK_DEFAULT_ASSIGNEE

    priority = str(task.get("priority") or FAMILY_TASK_DEFAULT_PRIORITY).strip()
    if priority not in FAMILY_TASK_PRIORITIES:
        priority = FAMILY_TASK_DEFAULT_PRIORITY

    return {
        **task,
        "id": task_id,
        "title": title,
        "description": str(task.get("description") or ""),
        "assignee": assignee,
        "priority": priority,
        "due_date": str(task.get("due_date") or "").strip(),
        "done": bool(task.get("done")),
    }


def _family_due_to_main_due(value: str | None) -> str | None:
    clean = str(value or "").strip()
    if not clean:
        return None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", clean):
        return f"{clean}T00:00:00+09:00"
    return clean


def _priority_tag(priority: str) -> str | None:
    if priority.startswith("💤"):
        return f"{FAMILY_TASK_PRIORITY_TAG_PREFIX}later"
    if priority.startswith("😄"):
        return f"{FAMILY_TASK_PRIORITY_TAG_PREFIX}normal"
    if priority.startswith("⭐️") or priority.startswith("⭐"):
        return f"{FAMILY_TASK_PRIORITY_TAG_PREFIX}important"
    if priority.startswith("‼️") or priority.startswith("‼"):
        return f"{FAMILY_TASK_PRIORITY_TAG_PREFIX}must"
    return None


class FamilyTaskSyncService:
    def __init__(self, items_repo: ItemsRepo, task_repo: TaskRepo, task_service: TaskService) -> None:
        self.items_repo = items_repo
        self.task_repo = task_repo
        self.task_service = task_service

    def sync(self, tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized_tasks = [task for task in (normalize_family_task(task) for task in tasks) if task]
        active_family_ids = {task["id"].lower() for task in normalized_tasks}

        for task in normalized_tasks:
            if task["assignee"] == FAMILY_TASK_SHARED_ASSIGNEE:
                self._upsert_mirror(task)
            else:
                self._remove_mirrors(task["id"])

        self._remove_stale_mirrors(active_family_ids)
        return normalized_tasks

    def reconcile_from_mirrors(self, tasks: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
        normalized_tasks = [task for task in (normalize_family_task(task) for task in tasks) if task]
        changed = False
        reconciled = []

        for task in normalized_tasks:
            if task["assignee"] != FAMILY_TASK_SHARED_ASSIGNEE:
                reconciled.append(task)
                continue

            mirrors = [mirror for mirror in self._find_mirrors(task["id"]) if mirror.get("status") != "removed"]
            if not mirrors:
                reconciled.append(task)
                continue

            mirror_id = mirrors[0]["id"]
            detail = self.task_repo.get_task_detail(mirror_id)
            if detail is None:
                reconciled.append(task)
                continue

            next_task = dict(task)
            mirror_done = bool(detail.get("is_done"))
            if bool(next_task.get("done")) != mirror_done:
                next_task["done"] = mirror_done
                if mirror_done:
                    next_task["completed_at"] = str(detail.get("done_at") or next_task.get("updated_at") or "")
                else:
                    next_task["completed_at"] = ""
                changed = True

            next_description = self._reconcile_description_subtask_state(
                str(next_task.get("description") or ""),
                self.task_repo.list_subtasks(mirror_id),
            )
            if next_description != next_task.get("description"):
                next_task["description"] = next_description
                changed = True

            reconciled.append(next_task)

        return reconciled, changed

    def _mirror_tag(self, family_task_id: str) -> str:
        return f"{FAMILY_TASK_MIRROR_TAG_PREFIX}{str(family_task_id).strip().lower()}"

    def _reconcile_description_subtask_state(self, description: str, mirror_subtasks: list[dict[str, Any]]) -> str:
        checklist_index = -1
        lines = []

        for line in str(description or "").split("\n"):
            if not line.startswith("- ") and not line.startswith("+ "):
                lines.append(line)
                continue

            content = line[2:].strip()
            if not content:
                lines.append(line)
                continue

            checklist_index += 1
            if checklist_index >= len(mirror_subtasks):
                lines.append(line)
                continue

            mirror_done = bool(mirror_subtasks[checklist_index].get("is_done"))
            lines.append(f"{'+ ' if mirror_done else '- '}{line[2:]}")

        return "\n".join(lines)

    def _find_mirrors(self, family_task_id: str) -> list[dict[str, Any]]:
        mirror_tag = self._mirror_tag(family_task_id)
        rows = self.items_repo.list_items_by_tag_prefix(mirror_tag)
        mirrors = []
        for row in rows:
            tags = self.items_repo.list_item_tags(row["id"])
            if mirror_tag in tags:
                mirrors.append(row)
        return mirrors

    def _mirror_tags_for_task(self, task: dict[str, Any]) -> list[str]:
        tags = [self._mirror_tag(task["id"]), FAMILY_TASK_SONG_TAG]
        priority = _priority_tag(str(task.get("priority") or ""))
        if priority:
            tags.append(priority)
        return tags

    def _upsert_mirror(self, task: dict[str, Any]) -> str:
        mirrors = self._find_mirrors(task["id"])
        primary = mirrors[0] if mirrors else None
        for duplicate in mirrors[1:]:
            self.items_repo.soft_delete_item(duplicate["id"])

        extracted = extract_family_task_checklist(task.get("description"))
        due_at = _family_due_to_main_due(task.get("due_date"))
        memo = extracted["memo"] or None
        is_done = bool(task.get("done"))

        if primary is None:
            item_id = self.task_service.create_task(task["title"], due_at=due_at, memo=memo)
        else:
            item_id = primary["id"]
            if primary.get("status") == "removed":
                self.items_repo.restore_item(item_id)
            self.task_service.update_task(
                item_id,
                title=task["title"],
                due_at=due_at,
                memo=memo,
                is_done=is_done,
            )

        self.task_repo.update_task_fields(item_id, due_at=due_at, memo=memo, is_done=is_done)
        self.task_repo.replace_subtasks(item_id, list(extracted["subtasks"]))
        self.items_repo.replace_item_tags(item_id, self._mirror_tags_for_task(task))
        return item_id

    def _remove_mirrors(self, family_task_id: str) -> None:
        for mirror in self._find_mirrors(family_task_id):
            self.items_repo.soft_delete_item(mirror["id"])

    def _remove_stale_mirrors(self, active_family_ids: set[str]) -> None:
        for row in self.items_repo.list_items_by_tag_prefix(FAMILY_TASK_MIRROR_TAG_PREFIX):
            tags = self.items_repo.list_item_tags(row["id"])
            family_tags = [tag for tag in tags if tag.startswith(FAMILY_TASK_MIRROR_TAG_PREFIX)]
            if not family_tags:
                continue
            family_id = family_tags[0][len(FAMILY_TASK_MIRROR_TAG_PREFIX):]
            if family_id not in active_family_ids:
                self.items_repo.soft_delete_item(row["id"])
