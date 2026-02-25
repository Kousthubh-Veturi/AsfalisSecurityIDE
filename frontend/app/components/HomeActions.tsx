"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const INSTALLATION_KEY = "asfalis_installation_id";

const GITHUB_APP_SLUG =
  process.env.NEXT_PUBLIC_GITHUB_APP_SLUG ?? "asfalis-security-scanner";
const GITHUB_INSTALL_URL = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;

export function HomeActions() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasSession(!!window.sessionStorage.getItem(INSTALLATION_KEY));
  }, []);

  const logIn = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(INSTALLATION_KEY)) {
      window.location.href = "/repos";
    } else {
      window.location.href = GITHUB_INSTALL_URL;
    }
  }, []);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={logIn}
        className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Log in with GitHub
      </button>
      {hasSession && (
        <Link
          href="/repos"
          className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Go to repos
        </Link>
      )}
    </div>
  );
}
