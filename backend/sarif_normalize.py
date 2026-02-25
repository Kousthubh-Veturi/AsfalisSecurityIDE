"""
Parse SARIF from OSV, Semgrep, CodeQL; normalize to canonical Finding rows; merge SARIF.
"""
import hashlib
import json
import os
from typing import Any

NORMALIZED_SEVERITIES = ("CRITICAL", "HIGH", "MED", "LOW", "INFO")


def _normalize_severity(tool: str, raw: str | None, cvss: str | None) -> str:
    raw = (raw or "").upper()
    if tool == "osv":
        if cvss:
            try:
                v = float(cvss)
                if v >= 9.0:
                    return "CRITICAL"
                if v >= 7.0:
                    return "HIGH"
                if v >= 4.0:
                    return "MED"
                return "LOW"
            except ValueError:
                pass
        return "MED"
    if tool == "semgrep":
        m = {"ERROR": "HIGH", "WARNING": "MED", "INFO": "INFO"}
        return m.get(raw, "MED")
    if tool == "codeql":
        m = {"error": "HIGH", "warning": "MED", "recommendation": "LOW", "note": "INFO"}
        return m.get(raw.lower(), "MED")
    return "MED"


def _fingerprint(tool: str, rule_id: str, path: str | None, start: int | None, end: int | None, msg: str) -> str:
    h = hashlib.sha256(f"{tool}:{rule_id}:{path}:{start}:{end}:{msg}".encode()).hexdigest()
    return h[:32]


def parse_sarif_to_findings(path: str, tool: str) -> list[dict[str, Any]]:
    """Read SARIF file and return list of dicts suitable for Finding model."""
    findings = []
    try:
        with open(path, "r") as f:
            data = json.load(f)
    except Exception:
        return findings
    runs = data.get("runs") or []
    for run in runs:
        results = run.get("results") or []
        tool_driver = run.get("tool", {}).get("driver", {})
        rules = {r.get("id"): r for r in (tool_driver.get("rules") or [])}
        for r in results:
            rule_id = r.get("ruleId") or ""
            rule = rules.get(rule_id) or {}
            msg_obj = r.get("message")
            if isinstance(msg_obj, dict):
                msg = msg_obj.get("text") or msg_obj.get("markdown") or ""
            else:
                msg = str(msg_obj or "")
            title = (rule.get("shortDescription") or {}).get("text") or msg[:512]
            help_uri = rule.get("helpUri") or ""
            help_text = (rule.get("fullDescription") or {}).get("text") or rule.get("help", {}).get("text") or help_uri
            level = (r.get("level") or "warning").lower()
            loc = (r.get("locations") or [{}])[0]
            loc_phys = (loc.get("physicalLocation") or {})
            art_loc = loc_phys.get("artifactLocation") or {}
            path_val = art_loc.get("uri") or ""
            region = loc_phys.get("region") or {}
            start_line = region.get("startLine")
            end_line = region.get("endLine") or start_line
            cvss = None
            for props in (r.get("properties"), rule.get("properties")):
                if isinstance(props, dict) and "cvss" in props:
                    cvss = str(props.get("cvss", ""))
                    break
            severity_raw = level or r.get("level")
            severity_norm = _normalize_severity(tool, severity_raw, cvss)
            fingerprint = _fingerprint(tool, rule_id, path_val, start_line, end_line, msg)
            codeql_trace = None
            if tool == "codeql" and r.get("codeFlows"):
                codeql_trace = json.dumps(r.get("codeFlows"))[:8000]
            findings.append({
                "tool": tool,
                "rule_id": rule_id[:255] if rule_id else None,
                "title": title[:512] if title else None,
                "severity_raw": str(severity_raw)[:64] if severity_raw else None,
                "severity_normalized": severity_norm,
                "cvss": cvss[:32] if cvss else None,
                "cwe": None,
                "confidence": None,
                "path": path_val[:1024] if path_val else None,
                "start_line": start_line,
                "end_line": end_line,
                "fingerprint": fingerprint,
                "help_text": (help_text or "")[:10000] or None,
                "codeql_trace": codeql_trace,
            })
    return findings


def merge_sarif_runs(paths: list[str], output_path: str) -> bool:
    """Merge multiple SARIF files into one (multiple runs in one log)."""
    merged = {"$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json", "version": "2.1.0", "runs": []}
    for p in paths:
        if not p or not os.path.isfile(p):
            continue
        try:
            with open(p, "r") as f:
                data = json.load(f)
            merged["runs"].extend(data.get("runs") or [])
        except Exception:
            continue
    if not merged["runs"]:
        return False
    try:
        with open(output_path, "w") as f:
            json.dump(merged, f, indent=2)
        return True
    except Exception:
        return False
