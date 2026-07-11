from app.db.repo.family_repo import FamilyRepo


class FamilyNoteRepo:
    def __init__(self, engine) -> None:
        self._family_repo = FamilyRepo(engine)

    def list_notes(self):
        return self._family_repo.list_notes()

    def replace_notes(self, notes):
        return self._family_repo.replace_notes(notes)
