"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const INSTALLATION_KEY = "asfalis_installation_id";

function SetupRedirect() {
  const searchParams = useSearchParams();
  const [noInstallation, setNoInstallation] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = searchParams.get("installation_id");
    const fromStorage = window.sessionStorage.getItem(INSTALLATION_KEY);
    if (fromUrl) {
      window.sessionStorage.setItem(INSTALLATION_KEY, fromUrl);
      window.location.href = `/repos?installation_id=${fromUrl}`;
      return;
    }
    if (fromStorage) {
      window.location.href = "/repos";
      return;
    }
    setNoInstallation(true);
  }, [searchParams]);

  if (noInstallation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 font-sans">
        <p className="text-zinc-600 dark:text-zinc-400">No installation found.</p>
        <Link href="/" className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center font-sans">
      <p className="text-zinc-600 dark:text-zinc-400">Redirecting...</p>
    </div>
  );
}

export default function GithubSetupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center font-sans"><p className="text-zinc-500">Loading...</p></div>}>
      <SetupRedirect />
    </Suspense>
  );
}
