import os
from contextlib import contextmanager
from typing import Iterator, Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    engine = create_engine(DATABASE_URL, future=True)
    SessionLocal: Optional[sessionmaker[Session]] = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, future=True
    )
else:
    engine = None
    SessionLocal = None


class Base(DeclarativeBase):
    pass


@contextmanager
def get_session() -> Iterator[Session]:
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not set; cannot create DB session.")
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


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

