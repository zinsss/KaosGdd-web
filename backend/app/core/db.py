import os
import re

from sqlalchemy import create_engine, event


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/kaosgdd.db")


def _database_schema() -> str:
    schema = os.getenv("DATABASE_SCHEMA", "main").strip() or "main"
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", schema):
        raise ValueError("DATABASE_SCHEMA must be a simple SQL identifier")
    return schema


DATABASE_SCHEMA = _database_schema()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)


if engine.url.get_backend_name().startswith("postgresql"):
    @event.listens_for(engine, "connect")
    def _set_postgres_search_path(dbapi_connection, _connection_record) -> None:
        with dbapi_connection.cursor() as cursor:
            cursor.execute(f"SET search_path TO {DATABASE_SCHEMA}, public")
