from app.db.repo.family_repo import FamilyRepo


class FamilyTaskRepo:
    def __init__(self, engine) -> None:
        self._family_repo = FamilyRepo(engine)

    def list_tasks(self):
        return self._family_repo.list_tasks()

    def replace_tasks(self, tasks):
        return self._family_repo.replace_tasks(tasks)
