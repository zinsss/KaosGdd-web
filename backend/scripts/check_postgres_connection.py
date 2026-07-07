#!/usr/bin/env python3
import os
import sys

from sqlalchemy import create_engine, text


def postgres_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if url.startswith("postgresql"):
        return url

    user = os.getenv("POSTGRES_USER", "kaosgdd")
    password = os.getenv("POSTGRES_PASSWORD", "change_me")
    host = os.getenv("POSTGRES_HOST", "postgres")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "kaosgdd")
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


def main() -> int:
    engine = create_engine(postgres_url())
    with engine.connect() as conn:
        row = conn.execute(text("SELECT current_database(), current_user")).one()
        schemas = conn.execute(
            text(
                """
                SELECT schema_name
                FROM information_schema.schemata
                WHERE schema_name IN ('main', 'family')
                ORDER BY schema_name
                """
            )
        ).scalars().all()

    print(f"connected database={row[0]} user={row[1]}")
    print(f"schemas={','.join(schemas) if schemas else '(none)'}")
    missing = {"main", "family"} - set(schemas)
    if missing:
        print(f"missing schemas={','.join(sorted(missing))}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
