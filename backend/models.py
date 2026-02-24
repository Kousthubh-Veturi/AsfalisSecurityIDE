from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from db import Base


class Installation(Base):
    __tablename__ = "installations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    installation_id = Column(BigInteger, unique=True, index=True, nullable=False)
    account_login = Column(String(255), nullable=False)
    account_type = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)
    last_seen_at = Column(DateTime, nullable=True)

    repos = relationship(
        "Repo", back_populates="installation", cascade="all, delete-orphan"
    )


class Repo(Base):
    __tablename__ = "repos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(BigInteger, unique=True, index=True, nullable=False)
    installation_id = Column(
        BigInteger, ForeignKey("installations.installation_id"), nullable=False
    )
    owner = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    full_name = Column(String(512), nullable=False)
    default_branch = Column(String(255), nullable=True)
    is_private = Column(Boolean, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    archived = Column(Boolean, nullable=False, default=False)
    last_synced_at = Column(DateTime, nullable=True)

    installation = relationship("Installation", back_populates="repos")
