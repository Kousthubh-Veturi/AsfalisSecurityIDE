"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";

type ScanDetail = {
  id: string;
  repo_id: number;
  full_name: string | null;
  status: string;
  current_stage?: string | null;
  trigger: string;
  created_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  branch: string | null;
  commit_sha: string | null;
  error_message: string | null;
  result_summary: string | null;
};

type FindingRow = {
  id: number;
  tool: string;
  rule_id: string | null;
  title: string | null;
  severity_raw: string | null;
  severity_normalized: string;
  cvss: string | null;
  cwe: string | null;
  path: string | null;
  start_line: number | null;
  end_line: number | null;
  help_text: string | null;
};

type ArtifactRow = { name: string; content_type: string };

type StageRow = {
  stage: string;
  started_at: string | null;
  ended_at: string | null;
  error_message: string | null;
  output: string | null;
};

const POLL_MS = 3000;
const STAGES_POLL_MS = 30000;
const TABS = ["Normalized", "OSV", "Semgrep", "CodeQL", "SARIF"] as const;

export default function ScanResultsPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Normalized");
  const [error, setError] = useState<string | null>(null);
  const [terminating, setTerminating] = useState(false);

  const fetchScan = useCallback(async () => {
    if (!API_BASE || !id) return;
    try {
      const res = await fetch(`${API_BASE}/api/scans/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Request failed: ${res.status}`);
        return;
      }
      const data: ScanDetail = await res.json();
      setScan(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scan");
    }
  }, [id]);

  const fetchFindings = useCallback(async () => {
    if (!API_BASE || !id) return;
    try {
      const res = await fetch(`${API_BASE}/api/scans/${id}/findings`);
      if (res.ok) {
        const data = await res.json();
        setFindings(data.findings || []);
      }
    } catch {
      // ignore
    }
  }, [id]);

  const fetchArtifacts = useCallback(async () => {
    if (!API_BASE || !id) return;
    try {
      const res = await fetch(`${API_BASE}/api/scans/${id}/artifacts`);
      if (res.ok) {
        const data = await res.json();
        setArtifacts(data.artifacts || []);
      }
    } catch {
      // ignore
    }
  }, [id]);

  const terminateScan = useCallback(async () => {
    if (!API_BASE || !id) return;
    setTerminating(true);
    try {
      const res = await fetch(`${API_BASE}/api/scans/${id}/terminate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        fetchScan();
      } else {
        setError(data.error || `Terminate failed: ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to terminate");
    } finally {
      setTerminating(false);
    }
  }, [id, fetchScan]);

  const fetchStages = useCallback(async () => {
    if (!API_BASE || !id) return;
    try {
      const res = await fetch(`${API_BASE}/api/scans/${id}/stages`);
      if (res.ok) {
        const data = await res.json();
        setStages(data.stages || []);
      }
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchScan();
    const interval = setInterval(fetchScan, POLL_MS);
    return () => clearInterval(interval);
  }, [id, fetchScan]);

  useEffect(() => {
    if (id && scan?.status === "completed") {
      fetchFindings();
      fetchArtifacts();
    }
  }, [id, scan?.status, fetchFindings, fetchArtifacts]);

  useEffect(() => {
    if (!id || !scan) return;
    fetchStages();
    const interval = setInterval(fetchStages, STAGES_POLL_MS);
    return () => clearInterval(interval);
  }, [id, scan, fetchStages]);

  if (!id) {
    return (
      <div className="flex min-h-screen flex-col p-8 font-sans">
        <p className="text-zinc-600 dark:text-zinc-400">Missing scan ID.</p>
        <Link href="/repos" className="mt-4 text-sm font-medium text-zinc-600 underline dark:text-zinc-400">
          Back to repos
        </Link>
      </div>
    );
  }

  if (error && !scan) {
    return (
      <div className="flex min-h-screen flex-col p-8 font-sans">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Scan</h1>
        <p className="mt-2 text-red-600 dark:text-red-400">{error}</p>
        <Link href="/repos" className="mt-4 text-sm font-medium text-zinc-600 underline dark:text-zinc-400">
          Back to repos
        </Link>
      </div>
    );
  }

  const status = scan?.status ?? "unknown";
  const isPending = status === "queued" || status === "running";

  const bySeverity = (() => {
    const m: Record<string, FindingRow[]> = {};
    for (const f of findings) {
      const s = f.severity_normalized || "INFO";
      if (!m[s]) m[s] = [];
      m[s].push(f);
    }
    const order = ["CRITICAL", "HIGH", "MED", "LOW", "INFO"];
    return order.filter((s) => m[s]?.length).map((s) => ({ severity: s, list: m[s] }));
  })();

  const filteredByTool = (tool: string) => findings.filter((f) => f.tool === tool.toLowerCase());

  return (
    <div className="flex min-h-screen flex-col p-8 font-sans">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Scan results
      </h1>
      {scan?.full_name && (
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Repo: <span className="font-mono">{scan.full_name}</span>
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <StatusLabel status={status} />
        {isPending && scan?.current_stage && (
          <span className="text-sm text-zinc-500">({scan.current_stage})</span>
        )}
        {isPending && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
        )}
        {isPending && (
          <button
            type="button"
            onClick={terminateScan}
            disabled={terminating}
            className="ml-auto rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-800"
          >
            {terminating ? "Terminating…" : "Terminate scan"}
          </button>
        )}
      </div>
      {scan?.created_at && (
        <p className="mt-2 text-sm text-zinc-500">
          Started: {new Date(scan.created_at).toLocaleString()}
          {scan.ended_at && ` · Ended: ${new Date(scan.ended_at).toLocaleString()}`}
        </p>
      )}
      {status === "failed" && scan?.error_message && (
        <p className="mt-3 text-red-600 dark:text-red-400">{scan.error_message}</p>
      )}

      {stages.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Stage log</h2>
          <p className="mt-1 text-sm text-zinc-500">Chronological run log. Refreshed every 30 seconds.</p>
          <div className="mt-3 rounded border border-zinc-200 bg-zinc-950 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="max-h-96 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed">
              {(() => {
                const sorted = [...stages].sort(
                  (a, b) =>
                    new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime()
                );
                const entries: { text: string; error: boolean }[] = [];
                for (const s of sorted) {
                  const ts = s.started_at
                    ? new Date(s.started_at).toLocaleTimeString(undefined, {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "--:--:--";
                  const prefix = `[${ts}] ${s.stage}`;
                  if (s.error_message) {
                    entries.push({ text: `${prefix} | ${s.error_message}`, error: true });
                  }
                  if (s.output) {
                    for (const line of s.output.split(/\r?\n/)) {
                      if (line.trim()) entries.push({ text: `${prefix} | ${line.trim()}`, error: false });
                    }
                  }
                  if (!s.error_message && !s.output?.trim()) {
                    entries.push({
                      text: s.ended_at ? `${prefix} | completed` : `${prefix} | running`,
                      error: false,
                    });
                  }
                }
                if (entries.length === 0) return <span className="text-zinc-500">No log entries yet.</span>;
                return (
                  <pre className="whitespace-pre-wrap break-words">
                    {entries.map((e, i) => (
                      <span
                        key={i}
                        className={e.error ? "text-red-400 dark:text-red-300" : "text-zinc-300"}
                      >
                        {e.text}
                        {"\n"}
                      </span>
                    ))}
                  </pre>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {status === "completed" && scan && (
        <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Result</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {scan.result_summary || "No findings yet."}
          </p>
        </div>
      )}

      {status === "completed" && (
        <div className="mt-6">
          <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  activeTab === tab
                    ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                    : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {activeTab === "Normalized" && (
              <div className="space-y-6">
                {bySeverity.length === 0 ? (
                  <p className="text-zinc-500">No normalized findings.</p>
                ) : (
                  bySeverity.map(({ severity, list }) => (
                    <section key={severity}>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        <SeverityBadge severity={severity} />
                        <span>{severity}</span>
                        <span className="font-normal text-zinc-500">({list.length})</span>
                      </h3>
                      <ul className="space-y-3">
                        {list.map((f) => (
                          <li
                            key={f.id}
                            className={`rounded-lg border-l-4 bg-white py-3 px-4 shadow-sm dark:bg-zinc-900/40 ${severityBorderClass(severity)}`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                {f.tool}
                              </span>
                              {f.path && (
                                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                  {f.path}
                                  {f.start_line != null && `:${f.start_line}`}
                                  {f.end_line != null && f.end_line !== f.start_line && `-${f.end_line}`}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 font-medium text-zinc-900 dark:text-zinc-100">
                              {f.title || f.rule_id || "—"}
                            </p>
                            {f.help_text && (
                              <p className="mt-1.5 text-sm leading-snug text-zinc-600 dark:text-zinc-400">
                                {f.help_text.slice(0, 400)}
                                {f.help_text.length > 400 ? "…" : ""}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))
                )}
              </div>
            )}
            {activeTab === "OSV" && <FindingsList list={filteredByTool("osv")} toolLabel="OSV" />}
            {activeTab === "Semgrep" && <FindingsList list={filteredByTool("semgrep")} toolLabel="Semgrep" />}
            {activeTab === "CodeQL" && <FindingsList list={filteredByTool("codeql")} toolLabel="CodeQL" />}
            {activeTab === "SARIF" && (
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Download per-tool or merged SARIF artifacts.
                </p>
                <ul className="mt-2 space-y-2">
                  {artifacts.map((a) => (
                    <li key={a.name}>
                      <a
                        href={`${API_BASE}/api/scans/${id}/artifacts/${encodeURIComponent(a.name)}`}
                        download={a.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
                      >
                        {a.name}
                      </a>
                    </li>
                  ))}
                  {artifacts.length === 0 && (
                    <li className="text-zinc-500">No SARIF artifacts.</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <Link
        href="/repos"
        className="mt-6 inline-block text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
      >
        Back to repos
      </Link>
    </div>
  );
}

function FindingsList({ list, toolLabel }: { list: FindingRow[]; toolLabel: string }) {
  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 py-8 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
        <p className="text-zinc-500">No findings from {toolLabel}.</p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Scan completed; this tool reported no issues.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {list.map((f) => (
        <li
          key={f.id}
          className="rounded-lg border border-zinc-200 bg-white py-3 px-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
        >
          {f.path && (
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {f.path}
              {f.start_line != null && `:${f.start_line}`}
            </span>
          )}
          <p className="mt-1.5 font-medium text-zinc-900 dark:text-zinc-100">
            {f.title || f.rule_id || "—"}
          </p>
          {f.help_text && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{f.help_text.slice(0, 300)}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function severityBorderClass(severity: string): string {
  const map: Record<string, string> = {
    CRITICAL: "border-l-red-500",
    HIGH: "border-l-orange-500",
    MED: "border-l-amber-500",
    LOW: "border-l-blue-500",
    INFO: "border-l-zinc-400 dark:border-l-zinc-500",
  };
  return map[severity] ?? "border-l-zinc-300 dark:border-l-zinc-600";
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    MED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    LOW: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    INFO: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
  };
  const className = map[severity] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${className}`}>
      {severity}
    </span>
  );
}

function StatusLabel({ status }: { status: string }) {
  const labels: Record<string, { label: string; className: string }> = {
    queued: { label: "Queued", className: "text-zinc-600 dark:text-zinc-400" },
    running: { label: "Running", className: "text-blue-600 dark:text-blue-400" },
    completed: { label: "Completed", className: "text-green-600 dark:text-green-400" },
    failed: { label: "Failed", className: "text-red-600 dark:text-red-400" },
    cancelled: { label: "Cancelled", className: "text-amber-600 dark:text-amber-400" },
  };
  const { label, className } = labels[status] ?? { label: status, className: "text-zinc-500" };
  return <span className={`font-medium ${className}`}>{label}</span>;
}
