import Link from "next/link";
import { ApiHealth } from "./components/ApiHealth";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Connect GitHub
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          <ApiHealth />
        </p>
        <Link
          href="/repos"
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Go to repos
        </Link>
      </main>
    </div>
  );
}
