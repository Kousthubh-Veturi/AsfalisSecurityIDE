from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
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
    scan_runs = relationship("ScanRun", back_populates="repo", cascade="all, delete-orphan")


class ScanRun(Base):
    __tablename__ = "scan_runs"

    id = Column(String(36), primary_key=True)
    repo_id = Column(BigInteger, ForeignKey("repos.repo_id"), nullable=False)
    installation_id = Column(BigInteger, nullable=False)
    trigger = Column(String(32), nullable=False, default="manual")
    status = Column(String(32), nullable=False, default="queued")
    current_stage = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    commit_sha = Column(String(64), nullable=True)
    branch = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    log_uri = Column(String(512), nullable=True)
    result_summary = Column(Text, nullable=True)

    repo = relationship("Repo", back_populates="scan_runs")
    stages = relationship("ScanStage", back_populates="scan_run", cascade="all, delete-orphan")
    findings = relationship("Finding", back_populates="scan_run", cascade="all, delete-orphan")
    artifacts = relationship("ScanArtifact", back_populates="scan_run", cascade="all, delete-orphan")


class ScanStage(Base):
    __tablename__ = "scan_stages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_run_id = Column(String(36), ForeignKey("scan_runs.id"), nullable=False)
    stage = Column(String(64), nullable=False)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    scan_run = relationship("ScanRun", back_populates="stages")


class Finding(Base):
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_run_id = Column(String(36), ForeignKey("scan_runs.id"), nullable=False)
    tool = Column(String(32), nullable=False)
    rule_id = Column(String(255), nullable=True)
    title = Column(String(512), nullable=True)
    severity_raw = Column(String(64), nullable=True)
    severity_normalized = Column(String(16), nullable=False)
    cvss = Column(String(32), nullable=True)
    cwe = Column(String(64), nullable=True)
    confidence = Column(String(32), nullable=True)
    path = Column(String(1024), nullable=True)
    start_line = Column(Integer, nullable=True)
    end_line = Column(Integer, nullable=True)
    fingerprint = Column(String(255), nullable=True)
    help_text = Column(Text, nullable=True)
    codeql_trace = Column(Text, nullable=True)

    scan_run = relationship("ScanRun", back_populates="findings")


class ScanArtifact(Base):
    __tablename__ = "scan_artifacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_run_id = Column(String(36), ForeignKey("scan_runs.id"), nullable=False)
    name = Column(String(128), nullable=False)
    content_type = Column(String(64), nullable=False, default="application/sarif+json")
    content = Column(Text, nullable=False)

    scan_run = relationship("ScanRun", back_populates="artifacts")
