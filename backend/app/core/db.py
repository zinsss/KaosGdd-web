import os

from sqlalchemy import create_engine


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/kaosgdd.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
