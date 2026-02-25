"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { API_BASE } from "../lib/api";

const INSTALLATION_KEY = "asfalis_installation_id";

type Repo = {
  repo_id: number;
  full_name: string;
  default_branch: string | null;
  is_private: boolean;
  archived: boolean;
};

type ReposResponse = {
  installation_id: number;
  repos: Repo[];
};

function ReposContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanningRepoId, setScanningRepoId] = useState<number | null>(null);

  const loadRepos = useCallback(async (id: string) => {
    if (!API_BASE) {
      setError("API URL not configured");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const syncRes = await fetch(`${API_BASE}/api/installations/${id}/sync`, { method: "POST" });
      if (!syncRes.ok) {
        const syncData = await syncRes.json().catch(() => ({}));
        setError(syncData.error || `Sync failed: ${syncRes.status}`);
        setRepos([]);
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_BASE}/api/repos?installation_id=${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Request failed: ${res.status}`);
        setRepos([]);
        return;
      }
      const data: ReposResponse = await res.json();
      setRepos(data.repos || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load repos");
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const startScan = useCallback(
    async (repoId: number) => {
      if (!API_BASE || !installationId) return;
      setScanningRepoId(repoId);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE}/api/repos/${repoId}/scan?installation_id=${installationId}`,
          { method: "POST" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || `Scan failed: ${res.status}`);
          return;
        }
        const scanRunId = data.scan_run_id;
        if (scanRunId) router.push(`/scans/${scanRunId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start scan");
      } finally {
        setScanningRepoId(null);
      }
    },
    [installationId, router]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = searchParams.get("installation_id");
    const fromSession = window.sessionStorage.getItem(INSTALLATION_KEY);
    const fromLocal = window.localStorage.getItem(INSTALLATION_KEY);
    const id = fromUrl || fromSession || fromLocal;
    if (id) {
      setInstallationId(id);
      if (fromUrl || !fromLocal) {
        window.sessionStorage.setItem(INSTALLATION_KEY, id);
        window.localStorage.setItem(INSTALLATION_KEY, id);
      }
      loadRepos(id);
    } else {
      setLoading(false);
    }
  }, [searchParams, loadRepos]);

  if (loading && !installationId) {
    return (
      <div className="flex min-h-screen flex-col p-8 font-sans">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!installationId) {
    return (
      <div className="flex min-h-screen flex-col p-8 font-sans">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Repositories
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Connect GitHub first. Install the app on your account or org, then you’ll be redirected here.
        </p>
        <Link
          href="/"
          className="mt-6 text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          Back to landing
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col p-8 font-sans">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Your connected repos
        </h1>
        <span className="rounded bg-green-100 px-2 py-0.5 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-400">
          Connected GitHub
        </span>
      </div>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Repos available to scan for this installation.
      </p>
      <div className="mt-2 flex gap-4">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          Back to landing
        </Link>
        <button
          type="button"
          onClick={() => installationId && loadRepos(installationId)}
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          Refresh repos
        </button>
      </div>

      {error && (
        <p className="mt-4 text-red-600 dark:text-red-400">{error}</p>
      )}

      {loading ? (
        <p className="mt-6 text-zinc-500">Loading repos...</p>
      ) : repos.length === 0 && !error ? (
        <p className="mt-6 text-zinc-500">No repos in this installation yet. Add repos in GitHub App settings.</p>
      ) : (
        <ul className="mt-6 space-y-2 text-zinc-700 dark:text-zinc-300">
          {repos.map((r) => (
            <li
              key={r.repo_id}
              className="flex items-center justify-between gap-4 rounded border border-zinc-200 py-2 pl-3 pr-2 dark:border-zinc-800"
            >
              <span className="font-mono">{r.full_name}</span>
              {r.default_branch && (
                <span className="text-zinc-500">({r.default_branch})</span>
              )}
              <button
                type="button"
                disabled={scanningRepoId === r.repo_id}
                onClick={() => startScan(r.repo_id)}
                className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {scanningRepoId === r.repo_id ? "Starting…" : "Scan"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReposPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen flex-col p-8 font-sans"><p className="text-zinc-500">Loading...</p></div>}>
      <ReposContent />
    </Suspense>
  );
}
