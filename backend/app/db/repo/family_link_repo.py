from app.db.repo.family_repo import FamilyRepo


class FamilyLinkRepo:
    def __init__(self, engine) -> None:
        self._family_repo = FamilyRepo(engine)

    def list_main_links(self):
        return self._family_repo.list_main_links()

    def upsert_main_link(self, **kwargs):
        return self._family_repo.upsert_main_link(**kwargs)

    def remove_main_links_for_family_item(self, family_item_id, family_module=None):
        return self._family_repo.remove_main_links_for_family_item(family_item_id, family_module)
