"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GITHUB_INSTALL_URL } from "../lib/api";

const INSTALLATION_KEY = "asfalis_installation_id";

function hasSession(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.sessionStorage.getItem(INSTALLATION_KEY);
}

export function Nav() {
  const pathname = usePathname();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setConnected(hasSession());
  }, [pathname]);

  const logOut = useCallback(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(INSTALLATION_KEY);
    setConnected(false);
    window.location.href = "/";
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
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <div className="flex gap-6">
          <Link
            href="/"
            className={`text-sm font-medium ${
              pathname === "/"
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            Home
          </Link>
          <Link
            href="/repos"
            className={`text-sm font-medium ${
              pathname === "/repos"
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            Repos
          </Link>
          <Link
            href="/scans"
            className={`text-sm font-medium ${
              pathname?.startsWith("/scans")
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            Scans
          </Link>
        </div>
        <div>
          {connected ? (
            <button
              type="button"
              onClick={logOut}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Log out
            </button>
          ) : (
            <button
              type="button"
              onClick={logIn}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Log in with GitHub
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
