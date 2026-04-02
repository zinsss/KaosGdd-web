from app.db.repo.items_repo import ItemsRepo
from app.db.repo.task_repo import TaskRepo


class TaskService:
    def __init__(self, items_repo: ItemsRepo, task_repo: TaskRepo) -> None:
        self.items_repo = items_repo
        self.task_repo = task_repo

    def create_task(self, title: str, due_at: str | None = None, memo: str | None = None) -> str:
        item_id = self.items_repo.create_item("task", title)
        self.task_repo.create_task(item_id, due_at=due_at, memo=memo)
        return item_id

    def list_tasks(self) -> list[dict]:
        return self.task_repo.list_active_tasks()

    def get_task(self, item_id: str) -> dict | None:
        return self.task_repo.get_task_detail(item_id)

    def update_task(
        self,
        item_id: str,
        *,
        title: str | None = None,
        due_at: str | None = None,
        memo: str | None = None,
        is_done: bool | None = None,
    ) -> bool:
        detail = self.task_repo.get_task_detail(item_id)
        if detail is None:
            return False

        next_title = title if title is not None else detail["title"]
        next_due_at = due_at if due_at is not None else detail.get("due_at")
        next_memo = memo if memo is not None else detail.get("memo")
        next_is_done = is_done if is_done is not None else bool(detail.get("is_done"))

        if next_title != detail["title"]:
            self.items_repo.update_item_title(item_id, next_title)

        self.task_repo.update_task_fields(
            item_id,
            due_at=next_due_at,
            memo=next_memo,
            is_done=next_is_done,
        )
        return True

    def toggle_task(self, item_id: str):
        return self.task_repo.toggle_done(item_id)
