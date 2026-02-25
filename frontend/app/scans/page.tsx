"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { API_BASE } from "../lib/api";

const INSTALLATION_KEY = "asfalis_installation_id";

type ScanItem = {
  id: string;
  repo_id: number;
  full_name: string | null;
  status: string;
  trigger: string;
  created_at: string | null;
  ended_at: string | null;
};

type ScansResponse = {
  installation_id: number;
  scans: ScanItem[];
};

function ScansContent() {
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadScans = useCallback(async (id: string) => {
    if (!API_BASE) {
      setError("API URL not configured");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/installations/${id}/scans?limit=50`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Request failed: ${res.status}`);
        setScans([]);
        return;
      }
      const data: ScansResponse = await res.json();
      setScans(data.scans || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scans");
      setScans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id =
      typeof window !== "undefined" ? window.sessionStorage.getItem(INSTALLATION_KEY) : null;
    if (id) {
      setInstallationId(id);
      loadScans(id);
    } else {
      setLoading(false);
    }
  }, [loadScans]);

  if (!installationId) {
    return (
      <div className="flex min-h-screen flex-col p-8 font-sans">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Scans</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Connect GitHub first. Run a scan from the Repos page to see results here.
        </p>
        <Link href="/" className="mt-6 text-sm font-medium text-zinc-600 underline dark:text-zinc-400">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col p-8 font-sans">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Scans</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Recent scan runs. Click a row to open details.
      </p>
      <Link
        href="/repos"
        className="mt-2 text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
      >
        Back to repos
      </Link>

      {error && (
        <p className="mt-4 text-red-600 dark:text-red-400">{error}</p>
      )}

      {loading ? (
        <p className="mt-6 text-zinc-500">Loading scans...</p>
      ) : scans.length === 0 ? (
        <p className="mt-6 text-zinc-500">No scans yet. Start one from the Repos page.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {scans.map((s) => (
            <li key={s.id}>
              <Link
                href={`/scans/${s.id}`}
                className="block rounded border border-zinc-200 py-2 pl-3 pr-2 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
              >
                <span className="font-mono text-zinc-900 dark:text-zinc-50">
                  {s.full_name ?? `repo ${s.repo_id}`}
                </span>
                <span className="ml-2 text-zinc-500">
                  {s.status}
                  {s.created_at && ` · ${new Date(s.created_at).toLocaleString()}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ScansPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col p-8 font-sans">
          <p className="text-zinc-500">Loading...</p>
        </div>
      }
    >
      <ScansContent />
    </Suspense>
  );
}
