from app.db.repo.family_repo import FamilyRepo


class FamilyCaregiverRepo:
    def __init__(self, engine) -> None:
        self._family_repo = FamilyRepo(engine)

    def get_caregiver_days(self):
        return self._family_repo.get_caregiver_days()

    def put_caregiver_days(self, days):
        return self._family_repo.put_caregiver_days(days)
