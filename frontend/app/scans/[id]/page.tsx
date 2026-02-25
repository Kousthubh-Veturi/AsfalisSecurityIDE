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
  trigger: string;
  created_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  branch: string | null;
  commit_sha: string | null;
  error_message: string | null;
  result_summary: string | null;
};

const POLL_MS = 3000;

export default function ScanResultsPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!id) return;
    fetchScan();
    const interval = setInterval(fetchScan, POLL_MS);
    return () => clearInterval(interval);
  }, [id, fetchScan]);

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
      <div className="mt-4 flex items-center gap-3">
        <StatusLabel status={status} />
        {isPending && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
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
      {status === "completed" && scan && (
        <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Result</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {scan.result_summary || "No findings yet."}
          </p>
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

function StatusLabel({ status }: { status: string }) {
  const labels: Record<string, { label: string; className: string }> = {
    queued: { label: "Queued", className: "text-zinc-600 dark:text-zinc-400" },
    running: { label: "Running", className: "text-blue-600 dark:text-blue-400" },
    completed: { label: "Completed", className: "text-green-600 dark:text-green-400" },
    failed: { label: "Failed", className: "text-red-600 dark:text-red-400" },
  };
  const { label, className } = labels[status] ?? { label: status, className: "text-zinc-500" };
  return <span className={`font-medium ${className}`}>{label}</span>;
}
