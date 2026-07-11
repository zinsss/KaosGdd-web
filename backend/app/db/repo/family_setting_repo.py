from app.db.repo.family_repo import FamilyRepo


class FamilySettingRepo:
    def __init__(self, engine) -> None:
        self._family_repo = FamilyRepo(engine)

    def get_setting(self, setting_key):
        return self._family_repo.get_setting(setting_key)

    def put_setting(self, setting_key, payload):
        return self._family_repo.put_setting(setting_key, payload)
