"use client";

import { useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export function ApiHealth() {
  const [status, setStatus] = useState<"loading" | "up" | "down">("loading");

  useEffect(() => {
    if (!apiBase) {
      setStatus("down");
      return;
    }
    fetch(`${apiBase}/health`, { method: "GET" })
      .then((res) => (res.ok ? setStatus("up") : setStatus("down")))
      .catch(() => setStatus("down"));
  }, []);

  if (status === "loading") return <span className="text-zinc-500">Checking API...</span>;
  if (status === "up") return <span className="text-green-600 dark:text-green-400">API is up.</span>;
  return <span className="text-red-600 dark:text-red-400">API unreachable.</span>;
}
