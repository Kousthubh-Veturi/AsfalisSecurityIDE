"""
Background worker for Option C: polls DB for queued scan_runs, runs staged pipeline.
Stages: fetch_repo, sca_osv, sast_semgrep, semantic_codeql, sonarqube_publish, normalize, finalize.
"""
import os
import shutil
import tarfile
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import requests

from db import get_session
from github_app import get_installation_token
from models import Finding, Repo, ScanArtifact, ScanRun, ScanStage
from sarif_normalize import merge_sarif_runs, parse_sarif_to_findings
from scanner_runner import run_codeql, run_osv, run_semgrep, run_sonar

POLL_INTERVAL_SECONDS = int(os.environ.get("WORKER_POLL_INTERVAL", "5"))
JOB_TIMEOUT_SECONDS = int(os.environ.get("SCAN_JOB_TIMEOUT", "600"))
MAX_ARCHIVE_BYTES = int(os.environ.get("MAX_ARCHIVE_BYTES", str(50 * 1024 * 1024)))


def _download_repo_archive(owner: str, name: str, ref: str, token: str) -> bytes:
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
    return b"".join(chunks)


def _record_stage(scan_id: str, stage: str, started_at: datetime, ended_at: datetime | None = None, error_message: str | None = None) -> None:
    with get_session() as session:
        run = session.query(ScanRun).filter_by(id=scan_id).one_or_none()
        if run:
            run.current_stage = stage
        if ended_at is not None:
            rec = session.query(ScanStage).filter_by(scan_run_id=scan_id, stage=stage).order_by(ScanStage.started_at.desc()).first()
            if rec:
                rec.ended_at = ended_at
                rec.error_message = error_message
        else:
            session.add(ScanStage(scan_run_id=scan_id, stage=stage, started_at=started_at, ended_at=None, error_message=None))


def _run_scan_job(scan_id: str) -> None:
    tmpdir = None
    work_dir = None
    started_global = time.time()

    def timeout_check() -> None:
        if time.time() - started_global > JOB_TIMEOUT_SECONDS:
            raise RuntimeError("Job timeout")

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

        token = get_installation_token(installation_id)
        timeout_check()

        stage_start = datetime.utcnow()
        _record_stage(scan_id, "fetch_repo", stage_start)
        archive_bytes = _download_repo_archive(owner, name, branch, token)
        timeout_check()
        tmpdir = tempfile.mkdtemp(prefix="asfalis_scan_")
        arc_path = os.path.join(tmpdir, "repo.tar.gz")
        with open(arc_path, "wb") as f:
            f.write(archive_bytes)
        with tarfile.open(arc_path, "r:gz") as tf:
            tf.extractall(tmpdir)
        subdirs = [d for d in os.listdir(tmpdir) if os.path.isdir(os.path.join(tmpdir, d)) and not d.startswith(".")]
        work_dir = os.path.join(tmpdir, subdirs[0]) if len(subdirs) == 1 else tmpdir
        _record_stage(scan_id, "fetch_repo", stage_start, datetime.utcnow())

        osv_ok, osv_msg, osv_path = False, "", None
        semgrep_ok, semgrep_msg, semgrep_path = False, "", None

        def do_osv() -> tuple[bool, str, str | None]:
            return run_osv(work_dir, timeout=120)

        def do_semgrep() -> tuple[bool, str, str | None]:
            return run_semgrep(work_dir, timeout=300)

        stage_start = datetime.utcnow()
        _record_stage(scan_id, "sca_osv", stage_start)
        _record_stage(scan_id, "sast_semgrep", stage_start)
        with ThreadPoolExecutor(max_workers=2) as ex:
            fut_osv = ex.submit(do_osv)
            fut_semgrep = ex.submit(do_semgrep)
            for fut in as_completed([fut_osv, fut_semgrep]):
                try:
                    ok, msg, path = fut.result()
                    if path and "osv" in path:
                        osv_ok, osv_msg, osv_path = ok, msg, path
                    else:
                        semgrep_ok, semgrep_msg, semgrep_path = ok, msg, path
                except Exception:
                    pass
        timeout_check()
        _record_stage(scan_id, "sca_osv", stage_start, datetime.utcnow(), None if osv_ok else osv_msg)
        _record_stage(scan_id, "sast_semgrep", stage_start, datetime.utcnow(), None if semgrep_ok else semgrep_msg)

        stage_start = datetime.utcnow()
        _record_stage(scan_id, "semantic_codeql", stage_start)
        codeql_ok, codeql_msg, codeql_path = run_codeql(work_dir, timeout=600)
        _record_stage(scan_id, "semantic_codeql", stage_start, datetime.utcnow(), None if codeql_ok else codeql_msg)
        timeout_check()

        project_key = f"asfalis-{scan_id}"[:64]
        stage_start = datetime.utcnow()
        _record_stage(scan_id, "sonarqube_publish", stage_start)
        sonar_ok, sonar_msg, _ = run_sonar(work_dir, project_key, timeout=300)
        _record_stage(scan_id, "sonarqube_publish", stage_start, datetime.utcnow(), None if sonar_ok else sonar_msg)

        stage_start = datetime.utcnow()
        _record_stage(scan_id, "normalize", stage_start)
        all_findings = []
        sarif_paths = []
        for tool, path in [("osv", osv_path), ("semgrep", semgrep_path), ("codeql", codeql_path)]:
            if path and os.path.isfile(path):
                sarif_paths.append(path)
                for fd in parse_sarif_to_findings(path, tool):
                    fd["scan_run_id"] = scan_id
                    all_findings.append(fd)
        merged_path = os.path.join(tmpdir, "merged.sarif")
        if sarif_paths:
            merge_sarif_runs(sarif_paths, merged_path)
        with get_session() as session:
            for fd in all_findings:
                session.add(Finding(
                    scan_run_id=fd["scan_run_id"],
                    tool=fd["tool"],
                    rule_id=fd.get("rule_id"),
                    title=fd.get("title"),
                    severity_raw=fd.get("severity_raw"),
                    severity_normalized=fd["severity_normalized"],
                    cvss=fd.get("cvss"),
                    cwe=fd.get("cwe"),
                    confidence=fd.get("confidence"),
                    path=fd.get("path"),
                    start_line=fd.get("start_line"),
                    end_line=fd.get("end_line"),
                    fingerprint=fd.get("fingerprint"),
                    help_text=fd.get("help_text"),
                    codeql_trace=fd.get("codeql_trace"),
                ))
            for name, path in [("osv.sarif", osv_path), ("semgrep.sarif", semgrep_path), ("codeql.sarif", codeql_path)]:
                if path and os.path.isfile(path):
                    with open(path, "r") as f:
                        content = f.read()
                    session.add(ScanArtifact(scan_run_id=scan_id, name=name, content_type="application/sarif+json", content=content))
            if os.path.isfile(merged_path):
                with open(merged_path, "r") as f:
                    content = f.read()
                session.add(ScanArtifact(scan_run_id=scan_id, name="merged.sarif", content_type="application/sarif+json", content=content))
        _record_stage(scan_id, "normalize", stage_start, datetime.utcnow())

        stage_start = datetime.utcnow()
        _record_stage(scan_id, "finalize", stage_start)
        with get_session() as session:
            run = session.query(ScanRun).filter_by(id=scan_id).one()
            run.status = "completed"
            run.ended_at = datetime.utcnow()
            run.current_stage = "finalize"
            run.result_summary = f"Scans completed. Normalized findings: {len(all_findings)}. OSV: {'ok' if osv_ok else 'skip'}, Semgrep: {'ok' if semgrep_ok else 'skip'}, CodeQL: {'ok' if codeql_ok else 'skip'}."
        _record_stage(scan_id, "finalize", stage_start, datetime.utcnow())
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
