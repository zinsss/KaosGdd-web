from app.db.repo.family_repo import FamilyRepo


class FamilyTimetableRepo:
    def __init__(self, engine) -> None:
        self._family_repo = FamilyRepo(engine)

    def get_timetable_state(self):
        return self._family_repo.get_timetable_state()

    def put_timetable_state(self, state):
        return self._family_repo.put_timetable_state(state)
