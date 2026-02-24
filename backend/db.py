import os
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session


DATABASE_URL = os.environ.get("DATABASE_URL")

engine = create_engine(DATABASE_URL) if DATABASE_URL else None
SessionLocal = sessionmaker(bind=engine) if engine else None

Base = declarative_base()


@contextmanager
def get_session() -> Iterator[Session]:
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured; cannot create DB session.")
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


