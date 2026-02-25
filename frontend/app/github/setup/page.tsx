"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

const INSTALLATION_KEY = "asfalis_installation_id";

export default function GithubSetupPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const installationId = searchParams.get("installation_id");
    if (installationId) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(INSTALLATION_KEY, installationId);
      }
      window.location.href = `/repos?installation_id=${installationId}`;
    }
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center font-sans">
      <p className="text-zinc-600 dark:text-zinc-400">Redirecting...</p>
    </div>
  );
}
