# Asfalis Security

A unified security scanning platform for source-code repositories. Users install a GitHub App, connect repositories, and run on-demand scans. The system runs **SAST**, **SCA**, and semantic analysis in a single pipeline, normalizes tool outputs to a common schema, stores findings and raw evidence (SARIF), and exposes results via API and UI.

The platform is built around a clear split: a **control plane** (API + orchestration), a **data plane** (worker fleet that runs scanners in isolation), and an **evidence plane** (normalized findings, raw SARIF artifacts, and reporting). Scanning is integrated with the development workflow through the GitHub App and is designed so that CI/CD (e.g. GitHub Actions) can trigger scans via the same API.

---

## Scan types in practice

The project implements these scan types as part of one pipeline:

| Type | What it means | What we run |
|------|----------------|-------------|
| **SAST** (Static Application Security Testing) | Analyzes code without executing it; finds insecure patterns, injection risks, misconfigurations. | **Semgrep** with the default ruleset (`p/default`), multi-language SAST. Output is SARIF. |
| **SCA** (Software Composition Analysis) | Identifies risks in dependencies: known vulnerabilities, license issues. Requires dependency graphs and vulnerability intelligence. | **OSV-Scanner** over the repo; uses the OSV schema/API and supports lockfiles and manifests (e.g. `package-lock.json`, `requirements.txt`). Output is SARIF. |
| **Semantic / deeper SAST** | Code-aware analysis (data flow, taint) for higher-signal findings. | **CodeQL** (Python in the current setup): build a DB, run queries, emit SARIF. |
| **Optional** | Publish to an existing quality/security dashboard. | **SonarQube** (optional): `sonar-scanner` when `SONAR_HOST_URL` and `SONAR_TOKEN` are set. |

We do **not** run DAST (dynamic testing of a running app) or container/image scanning in this codebase; the architecture can be extended with additional worker stages or separate pipelines for those.

---

## Why a unified pipeline

A strong scanning platform does not treat SAST, SCA, and semantic analysis as separate one-off tools. It treats them as **scan types in one workflow**: ingest target (repo) → run scanners → normalize outputs → store evidence → expose to developers and (optionally) policy gates. This project does exactly that:

1. **Ingest**: GitHub App provides repo access; worker downloads the repo archive for the selected branch.
2. **Run scanners**: One pipeline runs OSV, Semgrep, and CodeQL (and optionally SonarQube) in sequence (OSV and Semgrep in parallel).
3. **Normalize**: Tool-specific SARIF is parsed into a single internal finding schema with normalized severity (CRITICAL/HIGH/MED/LOW/INFO), CWE, path, line range, fingerprint for deduplication.
4. **Evidence**: Raw SARIF per tool plus a merged SARIF are stored as scan artifacts; findings are stored in the DB for querying and UI.
5. **Reporting**: API and Next.js UI for status, stage log, normalized findings by severity, and per-tool views; artifact download for SARIF.

Severity normalization follows common practice: CVSS-based bands for SCA (OSV), and tool-level mappings for Semgrep and CodeQL. The pipeline is built so that future policy gates (e.g. block merge on CRITICAL) or CI status checks can consume the same normalized data.

---

## Architecture

### Control plane

- **API service** (Flask, `backend/app.py`): Accepts scan requests, GitHub webhooks (installations, repo changes), and read requests for scans, findings, stages, and artifacts.
- **AuthN/AuthZ**: GitHub App install flow; API uses installation and repo context for scoping.
- **Job orchestration**: Creating a scan (`POST /api/repos/<repo_id>/scan`) inserts a `ScanRun` with `status=queued`. There is no separate task queue service: the database is the queue.

Key API surface:

- `POST /api/repos/<repo_id>/scan` — enqueue a scan (manual trigger).
- `GET /api/scans/<id>` — scan status and metadata (for polling).
- `GET /api/scans/<id>/findings` — normalized findings.
- `GET /api/scans/<id>/stages` — stage log (for UI).
- `GET /api/scans/<id>/artifacts` — list SARIF artifact names; `GET .../artifacts/<name>` — download.
- `POST /api/scans/<id>/terminate` — cancel a running scan.

### Data plane

- **Worker** (`backend/worker.py`): Long-running process that polls the DB for `status=queued` runs, claims one with `SELECT ... FOR UPDATE SKIP LOCKED`, sets `status=running`, then runs the pipeline.
- **Pipeline stages**: `fetch_repo` → `sca_osv` + `sast_semgrep` (parallel) → `semantic_codeql` → `sonarqube_publish` (optional) → `normalize` → `finalize`.
- **Scanners** (`backend/scanner_runner.py`): Invoke OSV-Scanner, Semgrep, and CodeQL CLI in a repo work directory; output SARIF under that directory. Workers run in Docker (`Dockerfile.worker`) with scanners installed; CodeQL uses the official bundle, and the runner does not pass `CODEQL_HOME` into the subprocess so the CLI finds its bundle from the executable path.
- **Isolation**: One scan = one temporary directory; cleanup after run. Workers can be scaled horizontally (multiple replicas); each replica processes one scan at a time.

### Evidence plane

- **Normalized store**: PostgreSQL. `ScanRun`, `ScanStage`, `Finding`, `ScanArtifact` (and `Repo`, `Installation`). Findings have tool, rule_id, severity_normalized, path, line range, CWE, help text, fingerprint.
- **Raw evidence**: Per-tool SARIF and a merged SARIF stored as `ScanArtifact` rows (content in DB). These can be downloaded for audit or fed into other tools.
- **Reporting**: Next.js frontend (scan status, stage log, findings by severity, per-tool tabs, artifact links). API can be used by CI (e.g. poll until completed, then fetch findings or artifacts).

---

## Queueing and concurrency

- **Queue**: Table `scan_runs` with `status='queued'` and ordering by `created_at` (FIFO).
- **Claiming a job**: Worker runs `SELECT ... FROM scan_runs WHERE status='queued' ORDER BY created_at ... FOR UPDATE SKIP LOCKED LIMIT 1`, then sets `status='running'` and `started_at` in the same transaction. `SKIP LOCKED` ensures another worker does not take the same row.
- **Concurrency**: One worker process handles one scan at a time. To process multiple scans in parallel, run multiple worker replicas; each will claim a different queued run. No in-process parallelism for multiple scans.

---

## Evidence and interchange: SARIF and normalization

Tool outputs are normalized so the platform can aggregate and reason about results consistently:

- **SARIF** (OASIS): Used as the common output format for static analysis. OSV-Scanner, Semgrep, and CodeQL all emit SARIF. We parse each run’s `results`, map to our `Finding` schema, normalize severity (including CVSS-based for OSV), and compute a fingerprint for deduplication. We also produce a **merged SARIF** (multiple `runs` in one document) and store it as an artifact.
- **Internal schema**: Findings store tool, rule_id, title, severity_raw, severity_normalized (CRITICAL/HIGH/MED/LOW/INFO), cvss, cwe, path, start_line, end_line, fingerprint, help_text, and optional codeql_trace. This supports severity-based filtering, policy (e.g. “fail on CRITICAL”), and cross-tool views.

Vulnerability identifiers (CVE, CVSS, OSV) appear where tools supply them (e.g. OSV); the pipeline is structured so that future integration with CSAF/VEX or KEV-based prioritization can sit on top of the same normalized findings.

---

## CI/CD and DevSecOps integration

- **Today**: Users install the GitHub App, sync repos, and trigger scans manually from the UI. The API is stateless and RESTful; any client (UI, GitHub Action, or other CI job) can call `POST /api/repos/<repo_id>/scan` and then poll `GET /api/scans/<id>` until completion, then fetch findings or artifacts.
- **Integration model**: “CI/CD triggers scanning” — e.g. a GitHub Actions workflow on `push` or `pull_request` can POST to start a scan and optionally block or warn based on `GET /api/scans/<id>/findings`. “Scanning feeds CI/CD” — the same API can drive status checks, PR comments, or tickets. The design is consistent with embedding security as a pipeline step (DevSecOps) while allowing risk-based gating (e.g. fast SAST/SCA on every PR, deeper CodeQL on main, with policy and exceptions applied in the control plane or CI).

---

## Tech stack

| Layer | Stack |
|-------|--------|
| **API** | Python 3.12, Flask, Flask-CORS, PyJWT, cryptography, SQLAlchemy, gunicorn, psycopg2-binary |
| **Worker** | Same runtime; scanners: OSV-Scanner, Semgrep (pip), CodeQL bundle; optional SonarQube |
| **DB** | PostgreSQL (schema via SQLAlchemy; migrations for additive columns) |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS |
| **Auth / integration** | GitHub App (JWT + installation access token); webhook signature verification |
| **Deployment** | Backend and worker containerized (Docker); worker image includes all scanner CLIs |

---

## Project layout

```
backend/                 # Control plane API + worker + scanners
  app.py                 # Flask app: webhooks, API routes (repos, scans, findings, stages, artifacts)
  worker.py              # Data plane: poll DB, run pipeline (fetch_repo → osv, semgrep, codeql, sonar, normalize)
  scanner_runner.py      # Invoke OSV, Semgrep, CodeQL, SonarQube; return SARIF paths / messages
  sarif_normalize.py     # Parse SARIF → normalized findings; merge SARIF runs
  models.py              # Installation, Repo, ScanRun, ScanStage, Finding, ScanArtifact
  db.py                  # SQLAlchemy engine and session
  github_app.py          # GitHub App JWT and installation token
  webhooks.py            # GitHub webhook signature verification
  Dockerfile.worker      # Worker image: Python, OSV, Semgrep, CodeQL bundle
frontend/                # Next.js app
  app/                   # App router: home, GitHub setup, repos list, scans list, scan detail [id]
  lib/api.ts             # API base URL and fetch helpers
```

---

## Running locally

1. **Database**: PostgreSQL with a database created. Set `DATABASE_URL` (e.g. `postgresql://user:pass@localhost/dbname`).
2. **GitHub App**: Create a GitHub App; set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM), `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, and `GITHUB_WEBHOOK_SECRET`. Point webhook URL to `https://your-api/webhooks/github`.
3. **Backend**: From `backend/`, `pip install -r requirements.txt`, then run with `gunicorn` or `flask run`. Set `CORS_ORIGINS` to the frontend origin (e.g. `http://localhost:3000`).
4. **Worker**: Run `python worker.py` (or use the same code in the Docker image). Ensure it can reach the same `DATABASE_URL` and (for GitHub) that the app can issue installation tokens.
5. **Frontend**: From `frontend/`, `npm install && npm run dev`. Set `NEXT_PUBLIC_API_URL` to the backend base URL.

For worker scanning, the host must have OSV-Scanner, Semgrep, and CodeQL on `PATH` (or use the provided `Dockerfile.worker` so they are installed in the image).

---

## Security considerations

- **Scanners in containers**: The worker is designed to run in a container with scanners installed; no Docker socket or privileged mode required. Network egress can be restricted to what scanners need (e.g. package registries, OSV API).
- **Tenancy**: Scan runs are scoped by installation and repo; the API uses `installation_id` and `repo_id` so one installation cannot access another’s scans or findings.
- **Untrusted input**: The worker downloads and extracts arbitrary repo archives; work is done in a temporary directory and removed after the run. Scanner processes run with the same user as the worker; further isolation (e.g. separate user, stronger sandboxing) can be added for higher assurance.

---

## API reference

All API routes are relative to the backend base URL. JSON request/response unless noted. Errors return a JSON object with an `error` (and optional `detail`) field and an appropriate HTTP status.

### General

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check; returns plain text `Hello, World!`. |
| `GET` | `/health` | Liveness; returns `{"status": "ok"}`. |

### GitHub integration

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/webhooks/github` | GitHub App webhook endpoint. Validates `X-Hub-Signature-256`; handles `ping`, `installation` (created/deleted/updated), and repository events to keep installations and repos in sync. |
| `GET` | `/debug/installations/<installation_id>` | Debug only: uses GitHub App JWT to get an installation access token and list repos for that installation. Returns installation_id, account_login, repo_count, and first repo info. |
| `POST` | `/api/installations/<installation_id>/sync` | Sync repos from GitHub for this installation: fetches installation repos via GitHub API and upserts into `repos` (create/update by repo_id). Returns `{"synced": N}`. |

### Repositories

| Method | Path | Query / Body | Description |
|--------|------|--------------|-------------|
| `GET` | `/api/repos` | `installation_id` (required) | List repositories for the given installation (non-archived). Returns `installation_id` and `repos` array (repo_id, full_name, default_branch, etc.). |
| `POST` | `/api/repos/<repo_id>/scan` | `installation_id` (required) | Create a new scan run for the repo. Repo must belong to the given installation. Returns `{"scan_run_id": "<uuid>", "status": "queued"}` (201). Worker picks up the job from the queue. |
| `GET` | `/api/repos/<repo_id>/scans` | `installation_id` (optional), `limit` (default 20, max 100) | List recent scan runs for this repo. Returns `repo_id` and `scans` array (id, status, trigger, created_at, ended_at). |

### Scan runs

| Method | Path | Query / Body | Description |
|--------|------|--------------|-------------|
| `GET` | `/api/scans/<scan_run_id>` | — | Get scan run details for polling: id, repo_id, full_name, status, current_stage, trigger, created_at, started_at, ended_at, branch, commit_sha, error_message, result_summary. |
| `GET` | `/api/scans/<scan_run_id>/findings` | — | Get normalized findings for the scan. Returns `findings` array (id, tool, rule_id, title, severity_raw, severity_normalized, cvss, cwe, path, start_line, end_line, help_text) ordered by severity and path. |
| `GET` | `/api/scans/<scan_run_id>/stages` | — | Get stage progress: `stages` array with stage name, started_at, ended_at, error_message, output. Used by the UI for the stage log. |
| `POST` | `/api/scans/<scan_run_id>/terminate` | — | Mark a queued or running scan as cancelled. Worker checks between stages and exits without overwriting. Returns `{"ok": true, "status": "cancelled"}`. 400 if scan is already completed/failed/cancelled. |
| `GET` | `/api/scans/<scan_run_id>/artifacts` | — | List SARIF artifact names for this scan. Returns `artifacts` array of `{name, content_type}` (e.g. osv.sarif, semgrep.sarif, codeql.sarif, merged.sarif). |
| `GET` | `/api/scans/<scan_run_id>/artifacts/<artifact_name>` | — | Download a single artifact by name. Returns the SARIF body with `Content-Disposition: attachment`. |

### Installation-scoped listing

| Method | Path | Query / Body | Description |
|--------|------|--------------|-------------|
| `GET` | `/api/installations/<installation_id>/scans` | `limit` (default 50, max 100) | List recent scan runs across all repos in this installation. Returns `scans` array with id, repo_id, full_name, status, trigger, created_at, ended_at. |

---

## License and references

- **SARIF**: [OASIS SARIF](https://www.oasis-open.org/standards#sarif) — common format for static analysis results.
- **OSV**: [Open Source Vulnerabilities](https://osv.dev/) — vulnerability database and schema used by OSV-Scanner.
- **Semgrep**: [Semgrep](https://semgrep.dev/) — multi-language SAST.
- **CodeQL**: [CodeQL](https://codeql.github.com/) — semantic code analysis (GitHub).
- **CVSS**: [FIRST CVSS](https://www.first.org/cvss/) — severity scoring; we map tool and CVSS values into a small set of normalized severities for policy and UI.
