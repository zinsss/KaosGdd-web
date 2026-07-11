from app.db.repo.family_repo import FamilyRepo


class FamilyEventRepo:
    def __init__(self, engine) -> None:
        self._family_repo = FamilyRepo(engine)

    def list_events(self):
        return self._family_repo.list_events()

    def replace_events(self, events):
        return self._family_repo.replace_events(events)
