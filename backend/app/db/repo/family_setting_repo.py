from app.db.repo.family_repo import FamilyRepo


class FamilySettingRepo:
    def __init__(self, engine) -> None:
        self._family_repo = FamilyRepo(engine)

    def get_setting(self, setting_key):
        return self._family_repo.get_setting(setting_key)

    def put_setting(self, setting_key, payload):
        return self._family_repo.put_setting(setting_key, payload)

    def get_support_mode(self):
        return self._family_repo.get_support_mode()

    def put_support_mode(self, payload, *, actor="family", action=None):
        return self._family_repo.put_support_mode(payload, actor=actor, action=action)

    def list_support_audit(self, limit=50):
        return self._family_repo.list_support_audit(limit)
