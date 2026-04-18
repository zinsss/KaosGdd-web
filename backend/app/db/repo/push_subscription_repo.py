import json

from sqlalchemy import text

from app.config import DbTables
from app.utils.clock import now_iso
from app.utils.ids import new_id


class PushSubscriptionRepo:
    def __init__(self, engine) -> None:
        self.engine = engine

    def upsert(self, *, client_id: str, endpoint: str, p256dh: str, auth: str, subscription_json: dict) -> str:
        now = now_iso()
        with self.engine.begin() as conn:
            existing = conn.execute(
                text(
                    """
                    SELECT id FROM {push_subscriptions}
                    WHERE client_id = :client_id AND endpoint = :endpoint
                    LIMIT 1
                    """.format(push_subscriptions=DbTables.PUSH_SUBSCRIPTIONS)
                ),
                {"client_id": client_id, "endpoint": endpoint},
            ).mappings().first()

            if existing:
                conn.execute(
                    text(
                        """
                        UPDATE {push_subscriptions}
                        SET p256dh = :p256dh,
                            auth = :auth,
                            subscription_json = :subscription_json,
                            updated_at = :updated_at
                        WHERE id = :id
                        """.format(push_subscriptions=DbTables.PUSH_SUBSCRIPTIONS)
                    ),
                    {
                        "id": existing["id"],
                        "p256dh": p256dh,
                        "auth": auth,
                        "subscription_json": json.dumps(subscription_json),
                        "updated_at": now,
                    },
                )
                return str(existing["id"])

            subscription_id = new_id()
            conn.execute(
                text(
                    """
                    INSERT INTO {push_subscriptions}(
                        id, client_id, endpoint, p256dh, auth, subscription_json, created_at, updated_at
                    ) VALUES (
                        :id, :client_id, :endpoint, :p256dh, :auth, :subscription_json, :created_at, :updated_at
                    )
                    """.format(push_subscriptions=DbTables.PUSH_SUBSCRIPTIONS)
                ),
                {
                    "id": subscription_id,
                    "client_id": client_id,
                    "endpoint": endpoint,
                    "p256dh": p256dh,
                    "auth": auth,
                    "subscription_json": json.dumps(subscription_json),
                    "created_at": now,
                    "updated_at": now,
                },
            )
            return subscription_id

    def remove(self, *, client_id: str, endpoint: str) -> bool:
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    DELETE FROM {push_subscriptions}
                    WHERE client_id = :client_id AND endpoint = :endpoint
                    """.format(push_subscriptions=DbTables.PUSH_SUBSCRIPTIONS)
                ),
                {"client_id": client_id, "endpoint": endpoint},
            )
            return (result.rowcount or 0) > 0

    def list_for_client(self, client_id: str) -> list[dict]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT id, client_id, endpoint, p256dh, auth, subscription_json
                    FROM {push_subscriptions}
                    WHERE client_id = :client_id
                    ORDER BY updated_at DESC
                    """.format(push_subscriptions=DbTables.PUSH_SUBSCRIPTIONS)
                ),
                {"client_id": client_id},
            ).mappings().all()

        items = []
        for row in rows:
            item = dict(row)
            try:
                item["subscription"] = json.loads(item.get("subscription_json") or "{}")
            except json.JSONDecodeError:
                item["subscription"] = {}
            items.append(item)
        return items

    def list_all(self) -> list[dict]:
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT id, client_id, endpoint, p256dh, auth, subscription_json
                    FROM {push_subscriptions}
                    ORDER BY updated_at DESC
                    """.format(push_subscriptions=DbTables.PUSH_SUBSCRIPTIONS)
                )
            ).mappings().all()

        items = []
        for row in rows:
            item = dict(row)
            try:
                item["subscription"] = json.loads(item.get("subscription_json") or "{}")
            except json.JSONDecodeError:
                item["subscription"] = {}
            items.append(item)
        return items
