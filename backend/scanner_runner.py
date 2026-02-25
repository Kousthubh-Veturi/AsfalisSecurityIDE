"""
Run security scanners (OSV, Semgrep, CodeQL, SonarQube) in a repo work dir.
Expects CLIs on PATH: osv-scanner, semgrep, codeql, sonar-scanner (optional).
Returns paths to SARIF files under work_dir (or None if skipped/failed).
"""
import os
import subprocess
from typing import Optional

WORK_DIR = os.environ.get("SCAN_WORK_DIR", os.getcwd())


def _run(cmd: list[str], cwd: str, timeout: int = 600, env: Optional[dict] = None) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, **(env or {})},
        )
        out = (result.stdout or "") + (result.stderr or "")
        return result.returncode == 0, out
    except subprocess.TimeoutExpired:
        return False, "timeout"
    except FileNotFoundError:
        return False, "command not found"
    except Exception as e:
        return False, str(e)


def run_osv(work_dir: str, timeout: int = 120) -> tuple[bool, str, Optional[str]]:
    """Run OSV-Scanner; output osv.sarif in work_dir. Returns (ok, message, path)."""
    out_path = os.path.join(work_dir, "osv.sarif")
    ok, out = _run(
        ["osv-scanner", "scan", "--format", "sarif", "--output", out_path, "."],
        cwd=work_dir,
        timeout=timeout,
    )
    if ok and os.path.isfile(out_path):
        return True, out or "ok", out_path
    return False, out or "no output file", None


def run_semgrep(work_dir: str, timeout: int = 300) -> tuple[bool, str, Optional[str]]:
    """Run Semgrep; output semgrep.sarif in work_dir. Returns (ok, message, path)."""
    out_path = os.path.join(work_dir, "semgrep.sarif")
    ok, out = _run(
        ["semgrep", "scan", "--sarif", "--sarif-output", out_path, "--config", "auto", "."],
        cwd=work_dir,
        timeout=timeout,
    )
    if ok and os.path.isfile(out_path):
        return True, out or "ok", out_path
    return False, out or "no output file", None


def run_codeql(work_dir: str, timeout: int = 900) -> tuple[bool, str, Optional[str]]:
    """
    Run CodeQL: create DB (Python for MVP), then analyze. Output codeql.sarif in work_dir.
    Expects codeql on PATH or CODEQL_HOME set to bundle root (codeql executable at CODEQL_HOME/codeql/codeql).
    """
    codeql_cmd = "codeql"
    if os.environ.get("CODEQL_HOME"):
        base = os.environ["CODEQL_HOME"].rstrip("/")
        codeql_cmd = os.path.join(base, "codeql", "codeql")
        if not os.path.isfile(codeql_cmd):
            codeql_cmd = os.path.join(base, "codeql.exe")
    db_path = os.path.join(work_dir, "codeql_db")
    out_path = os.path.join(work_dir, "codeql.sarif")
    if os.path.isdir(db_path):
        try:
            import shutil
            shutil.rmtree(db_path)
        except Exception:
            pass
    ok_create, out_create = _run(
        [codeql_cmd, "database", "create", db_path, "--language=python", "--source-root", work_dir],
        cwd=work_dir,
        timeout=timeout,
    )
    if not ok_create:
        return False, out_create or "codeql database create failed", None
    ok_analyze, out_analyze = _run(
        [
            codeql_cmd, "database", "analyze", db_path,
            "--format=sarif-latest",
            f"--output={out_path}",
        ],
        cwd=work_dir,
        timeout=timeout,
    )
    if ok_analyze and os.path.isfile(out_path):
        return True, out_analyze or "ok", out_path
    return False, out_analyze or "no output file", None


def run_sonar(work_dir: str, project_key: str, timeout: int = 300) -> tuple[bool, str, Optional[str]]:
    """
    Run sonar-scanner to publish to SonarQube server.
    Requires SONAR_HOST_URL and SONAR_TOKEN. No SARIF file produced by scanner;
    caller may fetch issues via API and convert (Option 1). Returns (ok, message, None).
    """
    url = os.environ.get("SONAR_HOST_URL")
    token = os.environ.get("SONAR_TOKEN")
    if not url or not token:
        return False, "SONAR_HOST_URL or SONAR_TOKEN not set", None
    props = os.path.join(work_dir, "sonar-project.properties")
    with open(props, "w") as f:
        f.write(f"sonar.projectKey={project_key}\n")
        f.write(f"sonar.sources=.\n")
    ok, out = _run(
        ["sonar-scanner", f"-Dsonar.projectBaseDir={work_dir}"],
        cwd=work_dir,
        timeout=timeout,
        env={"SONAR_HOST_URL": url, "SONAR_TOKEN": token},
    )
    return ok, out, None
