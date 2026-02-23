import Link from "next/link";

export default function ReposPage() {
  return (
    <div className="flex min-h-screen flex-col p-8 font-sans">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Repositories
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        List of repos available to scan. Placeholder.
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
