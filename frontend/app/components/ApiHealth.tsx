"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "../lib/api";

export function ApiHealth() {
  const [status, setStatus] = useState<"loading" | "up" | "down">("loading");

  useEffect(() => {
    if (!API_BASE) {
      setStatus("down");
      return;
    }
    fetch(`${API_BASE}/health`, { method: "GET" })
      .then((res) => (res.ok ? setStatus("up") : setStatus("down")))
      .catch(() => setStatus("down"));
  }, []);

  if (status === "loading") return <span className="text-zinc-500">Checking API...</span>;
  if (status === "up") return <span className="text-green-600 dark:text-green-400">API is up.</span>;
  return <span className="text-red-600 dark:text-red-400">API unreachable.</span>;
}
