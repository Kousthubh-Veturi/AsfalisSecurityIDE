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
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Stage output</h2>
          <p className="mt-1 text-sm text-zinc-500">Refreshed every 30 seconds.</p>
          <div className="mt-3 space-y-4">
            {stages.map((s) => (
              <div
                key={s.stage}
                className="rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
                  <span className="font-mono text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {s.stage}
                  </span>
                  {s.ended_at ? (
                    <span className="text-xs text-zinc-500">
                      {new Date(s.ended_at).toLocaleTimeString()}
                    </span>
                  ) : s.started_at ? (
                    <span className="text-xs text-zinc-500">running</span>
                  ) : null}
                </div>
                {s.error_message && (
                  <p className="border-b border-zinc-200 px-3 py-2 text-sm text-red-600 dark:border-zinc-700 dark:text-red-400">
                    {s.error_message}
                  </p>
                )}
                {s.output && (
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {s.output}
                  </pre>
                )}
              </div>
            ))}
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
              <div className="space-y-4">
                {bySeverity.length === 0 ? (
                  <p className="text-zinc-500">No normalized findings.</p>
                ) : (
                  bySeverity.map(({ severity, list }) => (
                    <div key={severity}>
                      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        {severity}
                      </h3>
                      <ul className="mt-1 space-y-1">
                        {list.map((f) => (
                          <li
                            key={f.id}
                            className="rounded border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/30"
                          >
                            <span className="font-mono text-zinc-500">{f.tool}</span>
                            {f.path && (
                              <span className="ml-2 font-mono text-zinc-600 dark:text-zinc-400">
                                {f.path}
                                {f.start_line != null && `:${f.start_line}`}
                              </span>
                            )}
                            <p className="mt-1 text-zinc-800 dark:text-zinc-200">
                              {f.title || f.rule_id || "—"}
                            </p>
                            {f.help_text && (
                              <p className="mt-1 text-xs text-zinc-500">{f.help_text.slice(0, 200)}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === "OSV" && <FindingsList list={filteredByTool("osv")} />}
            {activeTab === "Semgrep" && <FindingsList list={filteredByTool("semgrep")} />}
            {activeTab === "CodeQL" && <FindingsList list={filteredByTool("codeql")} />}
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

function FindingsList({ list }: { list: FindingRow[] }) {
  if (list.length === 0) {
    return <p className="text-zinc-500">No findings from this tool.</p>;
  }
  return (
    <ul className="space-y-2">
      {list.map((f) => (
        <li
          key={f.id}
          className="rounded border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/30"
        >
          {f.path && (
            <span className="font-mono text-zinc-600 dark:text-zinc-400">
              {f.path}
              {f.start_line != null && `:${f.start_line}`}
            </span>
          )}
          <p className="mt-1 text-zinc-800 dark:text-zinc-200">
            {f.title || f.rule_id || "—"}
          </p>
          {f.help_text && (
            <p className="mt-1 text-xs text-zinc-500">{f.help_text.slice(0, 200)}</p>
          )}
        </li>
      ))}
    </ul>
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
