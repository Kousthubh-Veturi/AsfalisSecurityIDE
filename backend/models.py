from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class Installation(Base):
    __tablename__ = "installations"

    # GitHub installation id (unique per installation)
    installation_id: Mapped[int] = mapped_column(Integer, primary_key=True)

    account_login: Mapped[str] = mapped_column(String(255))
    account_type: Mapped[str] = mapped_column(String(64))

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    repos: Mapped[list["Repo"]] = relationship(
        back_populates="installation", cascade="all, delete-orphan"
    )


class Repo(Base):
    __tablename__ = "repos"

    # GitHub repository id
    repo_id: Mapped[int] = mapped_column(Integer, primary_key=True)

    installation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("installations.installation_id"), index=True
    )

    owner: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(512))
    default_branch: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    is_private: Mapped[bool] = mapped_column(Boolean, default=True)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )

    installation: Mapped[Installation] = relationship(back_populates="repos")

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

