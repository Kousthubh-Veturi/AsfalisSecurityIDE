"""
Background worker for Option C: polls DB for queued scan_runs, processes one at a time.
Run as a separate Railway service with same env vars as web. Start: python worker.py
"""
import os
import shutil
import tarfile
import tempfile
import time
from datetime import datetime

import requests

from db import get_session
from github_app import get_installation_token
from models import Repo, ScanRun

POLL_INTERVAL_SECONDS = int(os.environ.get("WORKER_POLL_INTERVAL", "5"))
JOB_TIMEOUT_SECONDS = int(os.environ.get("SCAN_JOB_TIMEOUT", "300"))
MAX_ARCHIVE_BYTES = int(os.environ.get("MAX_ARCHIVE_BYTES", str(50 * 1024 * 1024)))  # 50 MiB


def _download_repo_archive(owner: str, name: str, ref: str, token: str) -> bytes:
    """Download repo tarball from GitHub; enforce max size. Raises on error or size exceeded."""
    url = f"https://api.github.com/repos/{owner}/{name}/tarball/{ref}"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
    r = requests.get(url, headers=headers, stream=True, timeout=30, allow_redirects=True)
    r.raise_for_status()
    chunks = []
    total = 0
    for chunk in r.iter_content(chunk_size=65536):
        if chunk:
            total += len(chunk)
            if total > MAX_ARCHIVE_BYTES:
                raise RuntimeError(f"Archive exceeds max size ({MAX_ARCHIVE_BYTES} bytes)")
            chunks.append(chunk)
    return b"".join(chunk for chunk in chunks)


def _run_scan_job(scan_id: str) -> None:
    """Job already claimed and set to running by main(). Fetch repo, fake scan, set completed/failed."""
    tmpdir = None
    try:
        with get_session() as session:
            run = session.query(ScanRun).filter_by(id=scan_id).one_or_none()
            if run is None:
                return
            repo = session.query(Repo).filter_by(repo_id=run.repo_id).one_or_none()
            if repo is None:
                run.status = "failed"
                run.error_message = "repo not found"
                run.ended_at = datetime.utcnow()
                return
            installation_id = run.installation_id
            branch = run.branch or repo.default_branch or "main"
            owner = repo.owner
            name = repo.name

        started = time.time()
        token = get_installation_token(installation_id)
        if time.time() - started > JOB_TIMEOUT_SECONDS:
            raise RuntimeError("Job timeout before download")

        archive_bytes = _download_repo_archive(owner, name, branch, token)
        if time.time() - started > JOB_TIMEOUT_SECONDS:
            raise RuntimeError("Job timeout after download")

        tmpdir = tempfile.mkdtemp(prefix="asfalis_scan_")
        arc_path = os.path.join(tmpdir, "repo.tar.gz")
        with open(arc_path, "wb") as f:
            f.write(archive_bytes)
        with tarfile.open(arc_path, "r:gz") as tf:
            tf.extractall(tmpdir)
        count = 0
        for _root, _dirs, files in os.walk(tmpdir):
            count += len(files)
            if time.time() - started > JOB_TIMEOUT_SECONDS:
                raise RuntimeError("Job timeout during scan")

        summary = f"Repo fetched successfully. Files counted: {count}."
        with get_session() as session:
            run = session.query(ScanRun).filter_by(id=scan_id).one()
            run.status = "completed"
            run.ended_at = datetime.utcnow()
            run.result_summary = summary
    except Exception as e:
        err_msg = str(e)
        try:
            with get_session() as session:
                run = session.query(ScanRun).filter_by(id=scan_id).one_or_none()
                if run:
                    run.status = "failed"
                    run.error_message = err_msg
                    run.ended_at = datetime.utcnow()
        except Exception:
            pass
    finally:
        if tmpdir and os.path.isdir(tmpdir):
            try:
                shutil.rmtree(tmpdir, ignore_errors=True)
            except Exception:
                pass


def main() -> None:
    print("Worker started, waiting for jobs.", flush=True)
    while True:
        scan_id = None
        try:
            with get_session() as session:
                run = (
                    session.query(ScanRun)
                    .filter_by(status="queued")
                    .order_by(ScanRun.created_at)
                    .with_for_update(skip_locked=True)
                    .first()
                )
                if run:
                    scan_id = run.id
                    run.status = "running"
                    run.started_at = datetime.utcnow()
            if scan_id:
                _run_scan_job(scan_id)
                continue
        except Exception as e:
            print(f"Worker error: {e}", flush=True)
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
