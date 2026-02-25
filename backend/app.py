import os
import time
import uuid
from datetime import datetime

import jwt
import requests
from dotenv import load_dotenv
from flask import Flask, Response, request
from flask_cors import CORS

from db import Base, engine, get_session
from github_app import get_github_private_key
from models import Finding, Installation, Repo, ScanArtifact, ScanRun, ScanStage
from webhooks import verify_github_signature

load_dotenv()

app = Flask(__name__)

cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
origins = [o.strip() for o in cors_origins.split(",") if o.strip()]
CORS(app, origins=origins)

if engine is not None:
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        import traceback
        print(f"create_all failed: {e}", flush=True)
        traceback.print_exc()
    else:
        # Add columns to existing tables if they were created before Hour 3
        try:
            from sqlalchemy import text
            with engine.connect() as conn:
                r = conn.execute(text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = 'scan_runs' AND column_name = 'current_stage'"
                ))
                if r.scalar() is None:
                    conn.execute(text("ALTER TABLE scan_runs ADD COLUMN current_stage VARCHAR(64)"))
                    conn.commit()
                    print("Added scan_runs.current_stage column", flush=True)
        except Exception as e:
            print(f"Migration (current_stage) skipped or failed: {e}", flush=True)


@app.route("/")
def index():
    return "Hello, World!"


@app.route("/health")
def health():
    return {"status": "ok"}, 200


@app.route("/webhooks/github", methods=["POST"])
def github_webhook():
    secret = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
    signature = request.headers.get("X-Hub-Signature-256")
    payload = request.get_data()

    if not verify_github_signature(payload, signature, secret):
        return {"error": "Invalid signature"}, 401

    event = request.headers.get("X-GitHub-Event", "")
    if event == "ping":
        return {"ok": True}, 200

    data = request.get_json(silent=True) or {}

    if event == "installation":
        action = data.get("action")
        installation = data.get("installation") or {}
        installation_id = installation.get("id")
        if not installation_id:
            return {"ok": True}, 200

        account = installation.get("account") or {}
        now = datetime.utcnow()

        with get_session() as session:
            existing = (
                session.query(Installation)
                .filter_by(installation_id=installation_id)
                .one_or_none()
            )

            if action == "deleted":
                if existing:
                    existing.revoked_at = now
                    existing.last_seen_at = now
                return {"ok": True}, 200

            if existing is None:
                inst = Installation(
                    installation_id=installation_id,
                    account_login=account.get("login") or "",
                    account_type=account.get("type") or "",
                    created_at=now,
                    last_seen_at=now,
                )
                session.add(inst)
            else:
                existing.account_login = account.get("login") or existing.account_login
                existing.account_type = account.get("type") or existing.account_type
                existing.last_seen_at = now

            # Sync repos from installation payload (initial install)
            for r in data.get("repositories") or []:
                repo_id = r.get("id")
                if not repo_id:
                    continue
                owner_login = (r.get("owner") or {}).get("login") or ""
                name = r.get("name") or ""
                full_name = r.get("full_name") or f"{owner_login}/{name}"
                default_branch = r.get("default_branch")
                is_private = bool(r.get("private"))
                archived = bool(r.get("archived"))
                existing_repo = session.query(Repo).filter_by(repo_id=repo_id).one_or_none()
                if existing_repo is None:
                    repo = Repo(
                        repo_id=repo_id,
                        installation_id=installation_id,
                        owner=owner_login,
                        name=name,
                        full_name=full_name,
                        default_branch=default_branch,
                        is_private=is_private,
                        created_at=now,
                        archived=archived,
                        last_synced_at=now,
                    )
                    session.add(repo)
                else:
                    existing_repo.installation_id = installation_id
                    existing_repo.owner = owner_login
                    existing_repo.name = name
                    existing_repo.full_name = full_name
                    existing_repo.default_branch = default_branch
                    existing_repo.is_private = is_private
                    existing_repo.archived = archived
                    existing_repo.last_synced_at = now

        return {"ok": True}, 200

    if event == "installation_repositories":
        installation = data.get("installation") or {}
        installation_id = installation.get("id")
        if not installation_id:
            return {"ok": True}, 200

        now = datetime.utcnow()
        repos_added = data.get("repositories_added") or []
        repos_removed = data.get("repositories_removed") or []

        with get_session() as session:
            for r in repos_added:
                repo_id = r.get("id")
                if not repo_id:
                    continue

                owner_login = (r.get("owner") or {}).get("login") or ""
                name = r.get("name") or ""
                full_name = r.get("full_name") or f"{owner_login}/{name}"
                default_branch = r.get("default_branch")
                is_private = bool(r.get("private"))
                archived = bool(r.get("archived"))

                existing = session.query(Repo).filter_by(repo_id=repo_id).one_or_none()
                if existing is None:
                    repo = Repo(
                        repo_id=repo_id,
                        installation_id=installation_id,
                        owner=owner_login,
                        name=name,
                        full_name=full_name,
                        default_branch=default_branch,
                        is_private=is_private,
                        created_at=now,
                        archived=archived,
                        last_synced_at=now,
                    )
                    session.add(repo)
                else:
                    existing.installation_id = installation_id
                    existing.owner = owner_login
                    existing.name = name
                    existing.full_name = full_name
                    existing.default_branch = default_branch
                    existing.is_private = is_private
                    existing.archived = archived
                    existing.last_synced_at = now

            for r in repos_removed:
                repo_id = r.get("id")
                if not repo_id:
                    continue
                repo = session.query(Repo).filter_by(repo_id=repo_id).one_or_none()
                if repo:
                    repo.archived = True
                    repo.last_synced_at = now

        return {"ok": True}, 200

    return {"ok": True}, 200


@app.route("/debug/installations/<int:installation_id>")
def debug_installation(installation_id: int):
    app_id = os.environ.get("GITHUB_APP_ID")
    private_key = get_github_private_key()
    if not app_id or not private_key:
        return {"error": "GITHUB_APP_ID or private key not configured"}, 500

    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + 600,
        "iss": app_id,
    }

    jwt_token = jwt.encode(payload, private_key, algorithm="RS256")
    app_headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Accept": "application/vnd.github+json",
    }

    token_resp = requests.post(
        f"https://api.github.com/app/installations/{installation_id}/access_tokens",
        headers=app_headers,
        timeout=10,
    )
    if token_resp.status_code >= 300:
        return {
            "error": "failed to create installation access token",
            "status": token_resp.status_code,
            "body": token_resp.text,
        }, 500

    access_token = token_resp.json().get("token")
    if not access_token:
        return {"error": "no token in response"}, 500

    inst_headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }
    repos_resp = requests.get(
        "https://api.github.com/installation/repositories",
        headers=inst_headers,
        timeout=10,
    )
    if repos_resp.status_code >= 300:
        return {
            "error": "failed to list repositories",
            "status": repos_resp.status_code,
            "body": repos_resp.text,
        }, 500

    data = repos_resp.json()
    repos = data.get("repositories", [])
    first = repos[0] if repos else None

    account_login = None
    try:
        from db import get_session as _get_session  # local import to avoid cycles
        from models import Installation as _Installation

        with _get_session() as session:
            inst = (
                session.query(_Installation)
                .filter_by(installation_id=installation_id)
                .one_or_none()
            )
            if inst:
                account_login = inst.account_login
    except Exception:
        # If DB isn't configured or query fails, just omit account_login
        account_login = None

    return {
        "installation_id": installation_id,
        "account_login": account_login,
        "repo_count": len(repos),
        "first_repo_full_name": first.get("full_name") if first else None,
        "first_repo_owner": (first.get("owner") or {}).get("login") if first else None,
    }, 200


def _installation_repos_from_github(installation_id: int):
    """Fetch installation access token and list repos from GitHub API. Returns (repos_list, account_login) or raises."""
    app_id = os.environ.get("GITHUB_APP_ID")
    private_key = get_github_private_key()
    if not app_id or not private_key:
        raise RuntimeError("GITHUB_APP_ID or private key not configured")
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 600, "iss": app_id}
    jwt_token = jwt.encode(payload, private_key, algorithm="RS256")
    app_headers = {"Authorization": f"Bearer {jwt_token}", "Accept": "application/vnd.github+json"}
    token_resp = requests.post(
        f"https://api.github.com/app/installations/{installation_id}/access_tokens",
        headers=app_headers,
        timeout=10,
    )
    if token_resp.status_code >= 300:
        raise RuntimeError(f"GitHub token failed: {token_resp.status_code}")
    access_token = token_resp.json().get("token")
    if not access_token:
        raise RuntimeError("No token in GitHub response")
    inst_headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}
    repos_resp = requests.get(
        "https://api.github.com/installation/repositories",
        headers=inst_headers,
        timeout=10,
    )
    if repos_resp.status_code >= 300:
        raise RuntimeError(f"GitHub repos failed: {repos_resp.status_code}")
    data = repos_resp.json()
    repos = data.get("repositories") or []
    account_login = None
    inst_resp = requests.get(
        f"https://api.github.com/app/installations/{installation_id}",
        headers=app_headers,
        timeout=10,
    )
    if inst_resp.status_code == 200:
        account_login = (inst_resp.json() or {}).get("account") or {}
        account_login = account_login.get("login")
    return repos, account_login


@app.route("/api/installations/<int:installation_id>/sync", methods=["POST"])
def sync_installation_repos(installation_id: int):
    """Fetch repos from GitHub API for this installation and upsert into DB."""
    try:
        repos, account_login = _installation_repos_from_github(installation_id)
    except RuntimeError as e:
        return {"error": str(e)}, 502
    now = datetime.utcnow()
    try:
        with get_session() as session:
            inst = session.query(Installation).filter_by(installation_id=installation_id).one_or_none()
            if inst is None:
                inst = Installation(
                    installation_id=installation_id,
                    account_login=account_login or "",
                    account_type="",
                    created_at=now,
                    last_seen_at=now,
                )
                session.add(inst)
            else:
                inst.account_login = account_login or inst.account_login
                inst.last_seen_at = now
            for r in repos:
                repo_id = r.get("id")
                if not repo_id:
                    continue
                owner_login = (r.get("owner") or {}).get("login") or ""
                name = r.get("name") or ""
                full_name = r.get("full_name") or f"{owner_login}/{name}"
                default_branch = r.get("default_branch")
                is_private = bool(r.get("private"))
                archived = bool(r.get("archived"))
                existing = session.query(Repo).filter_by(repo_id=repo_id).one_or_none()
                if existing is None:
                    session.add(
                        Repo(
                            repo_id=repo_id,
                            installation_id=installation_id,
                            owner=owner_login,
                            name=name,
                            full_name=full_name,
                            default_branch=default_branch,
                            is_private=is_private,
                            created_at=now,
                            archived=archived,
                            last_synced_at=now,
                        )
                    )
                else:
                    existing.installation_id = installation_id
                    existing.owner = owner_login
                    existing.name = name
                    existing.full_name = full_name
                    existing.default_branch = default_branch
                    existing.is_private = is_private
                    existing.archived = archived
                    existing.last_synced_at = now
        return {"synced": len(repos)}, 200
    except RuntimeError:
        return {"error": "database unavailable"}, 503


@app.route("/api/repos/<int:repo_id>/scan", methods=["POST"])
def start_scan(repo_id: int):
    """Create a scan_run with status=queued. Worker will pick it up."""
    installation_id = request.args.get("installation_id", type=int)
    if installation_id is None:
        return {"error": "installation_id required"}, 400
    try:
        with get_session() as session:
            repo = (
                session.query(Repo)
                .filter_by(repo_id=repo_id, installation_id=installation_id)
                .one_or_none()
            )
            if repo is None:
                return {"error": "repo not found or not in this installation"}, 404
            branch = repo.default_branch or "main"
            scan_id = str(uuid.uuid4())
            now = datetime.utcnow()
            run = ScanRun(
                id=scan_id,
                repo_id=repo_id,
                installation_id=installation_id,
                trigger="manual",
                status="queued",
                created_at=now,
                branch=branch,
            )
            session.add(run)
        return {"scan_run_id": scan_id, "status": "queued"}, 201
    except RuntimeError:
        return {"error": "database unavailable"}, 503
    except Exception as e:
        print(f"start_scan error: {e}", flush=True)
        return {"error": "scan failed", "detail": str(e)}, 503


@app.route("/api/scans/<scan_run_id>")
def get_scan(scan_run_id: str):
    """Return scan run status and details for polling."""
    try:
        with get_session() as session:
            run = session.query(ScanRun).filter_by(id=scan_run_id).one_or_none()
            if run is None:
                return {"error": "scan not found"}, 404
            repo = session.query(Repo).filter_by(repo_id=run.repo_id).one_or_none()
            return {
                "id": run.id,
                "repo_id": run.repo_id,
                "full_name": repo.full_name if repo else None,
                "status": run.status,
                "current_stage": run.current_stage,
                "trigger": run.trigger,
                "created_at": run.created_at.isoformat() if run.created_at else None,
                "started_at": run.started_at.isoformat() if run.started_at else None,
                "ended_at": run.ended_at.isoformat() if run.ended_at else None,
                "branch": run.branch,
                "commit_sha": run.commit_sha,
                "error_message": run.error_message,
                "result_summary": run.result_summary,
            }, 200
    except RuntimeError:
        return {"error": "database unavailable"}, 503


@app.route("/api/scans/<scan_run_id>/findings")
def get_scan_findings(scan_run_id: str):
    """Return normalized findings for this scan."""
    try:
        with get_session() as session:
            run = session.query(ScanRun).filter_by(id=scan_run_id).one_or_none()
            if run is None:
                return {"error": "scan not found"}, 404
            findings = session.query(Finding).filter_by(scan_run_id=scan_run_id).all()
            sev_order = {"CRITICAL": 0, "HIGH": 1, "MED": 2, "LOW": 3, "INFO": 4}
            findings = sorted(findings, key=lambda f: (sev_order.get(f.severity_normalized or "", 5), (f.path or "")))
            return {
                "scan_run_id": scan_run_id,
                "findings": [
                    {
                        "id": f.id,
                        "tool": f.tool,
                        "rule_id": f.rule_id,
                        "title": f.title,
                        "severity_raw": f.severity_raw,
                        "severity_normalized": f.severity_normalized,
                        "cvss": f.cvss,
                        "cwe": f.cwe,
                        "path": f.path,
                        "start_line": f.start_line,
                        "end_line": f.end_line,
                        "help_text": f.help_text,
                    }
                    for f in findings
                ],
            }, 200
    except RuntimeError:
        return {"error": "database unavailable"}, 503


@app.route("/api/scans/<scan_run_id>/stages")
def get_scan_stages(scan_run_id: str):
    """Return stage progress for this scan."""
    try:
        with get_session() as session:
            run = session.query(ScanRun).filter_by(id=scan_run_id).one_or_none()
            if run is None:
                return {"error": "scan not found"}, 404
            stages = session.query(ScanStage).filter_by(scan_run_id=scan_run_id).order_by(ScanStage.started_at).all()
            return {
                "scan_run_id": scan_run_id,
                "current_stage": run.current_stage,
                "stages": [
                    {
                        "stage": s.stage,
                        "started_at": s.started_at.isoformat() if s.started_at else None,
                        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                        "error_message": s.error_message,
                    }
                    for s in stages
                ],
            }, 200
    except RuntimeError:
        return {"error": "database unavailable"}, 503


@app.route("/api/scans/<scan_run_id>/artifacts")
def list_scan_artifacts(scan_run_id: str):
    """List artifact names (SARIF files) for this scan."""
    try:
        with get_session() as session:
            run = session.query(ScanRun).filter_by(id=scan_run_id).one_or_none()
            if run is None:
                return {"error": "scan not found"}, 404
            artifacts = session.query(ScanArtifact).filter_by(scan_run_id=scan_run_id).all()
            return {
                "scan_run_id": scan_run_id,
                "artifacts": [{"name": a.name, "content_type": a.content_type} for a in artifacts],
            }, 200
    except RuntimeError:
        return {"error": "database unavailable"}, 503


@app.route("/api/scans/<scan_run_id>/artifacts/<artifact_name>")
def get_scan_artifact(scan_run_id: str, artifact_name: str):
    """Download a SARIF artifact by name (e.g. osv.sarif, merged.sarif)."""
    try:
        with get_session() as session:
            run = session.query(ScanRun).filter_by(id=scan_run_id).one_or_none()
            if run is None:
                return {"error": "scan not found"}, 404
            art = session.query(ScanArtifact).filter_by(scan_run_id=scan_run_id, name=artifact_name).one_or_none()
            if art is None:
                return {"error": "artifact not found"}, 404
            return Response(art.content, mimetype=art.content_type, headers={"Content-Disposition": f"attachment; filename={artifact_name}"})
    except RuntimeError:
        return {"error": "database unavailable"}, 503


@app.route("/api/installations/<int:installation_id>/scans")
def list_installation_scans(installation_id: int):
    """Return last N scan runs for this installation (all repos)."""
    limit = request.args.get("limit", type=int, default=50)
    limit = min(max(1, limit), 100)
    try:
        with get_session() as session:
            runs = (
                session.query(ScanRun)
                .filter_by(installation_id=installation_id)
                .order_by(ScanRun.created_at.desc())
                .limit(limit)
                .all()
            )
            repo_ids = {r.repo_id for r in runs}
            repos = (
                session.query(Repo).filter(Repo.repo_id.in_(repo_ids)).all()
                if repo_ids
                else []
            )
            repo_by_id = {r.repo_id: r.full_name for r in repos}
            return {
                "installation_id": installation_id,
                "scans": [
                    {
                        "id": r.id,
                        "repo_id": r.repo_id,
                        "full_name": repo_by_id.get(r.repo_id),
                        "status": r.status,
                        "trigger": r.trigger,
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                        "ended_at": r.ended_at.isoformat() if r.ended_at else None,
                    }
                    for r in runs
                ],
            }, 200
    except RuntimeError:
        return {"error": "database unavailable"}, 503
    except Exception as e:
        print(f"list_installation_scans error: {e}", flush=True)
        return {"error": "failed to list scans", "detail": str(e)}, 503


@app.route("/api/repos/<int:repo_id>/scans")
def list_repo_scans(repo_id: int):
    """Return last N scan runs for this repo."""
    installation_id = request.args.get("installation_id", type=int)
    limit = request.args.get("limit", type=int, default=20)
    limit = min(max(1, limit), 100)
    try:
        with get_session() as session:
            repo = session.query(Repo).filter_by(repo_id=repo_id).one_or_none()
            if repo is None:
                return {"error": "repo not found"}, 404
            if installation_id is not None and repo.installation_id != installation_id:
                return {"error": "repo not in this installation"}, 404
            runs = (
                session.query(ScanRun)
                .filter_by(repo_id=repo_id)
                .order_by(ScanRun.created_at.desc())
                .limit(limit)
                .all()
            )
            return {
                "repo_id": repo_id,
                "scans": [
                    {
                        "id": r.id,
                        "status": r.status,
                        "trigger": r.trigger,
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                        "ended_at": r.ended_at.isoformat() if r.ended_at else None,
                    }
                    for r in runs
                ],
            }, 200
    except RuntimeError:
        return {"error": "database unavailable"}, 503


@app.route("/api/repos")
def list_repos():
    """Return repos for the given installation_id only (scoped; no all-repos)."""
    installation_id = request.args.get("installation_id", type=int)
    if installation_id is None:
        return {"error": "installation_id required"}, 400
    try:
        with get_session() as session:
            repos = (
                session.query(Repo)
                .filter_by(installation_id=installation_id)
                .filter(Repo.archived == False)  # noqa: E712
                .order_by(Repo.full_name)
                .all()
            )
            return {
                "installation_id": installation_id,
                "repos": [
                    {
                        "repo_id": r.repo_id,
                        "full_name": r.full_name,
                        "default_branch": r.default_branch,
                        "is_private": r.is_private,
                        "archived": r.archived,
                    }
                    for r in repos
                ],
            }, 200
    except RuntimeError:
        return {"error": "database unavailable"}, 503


if __name__ == "__main__":
    app.run(debug=True)