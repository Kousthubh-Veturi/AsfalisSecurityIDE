import Link from "next/link";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ScanResultsPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="flex min-h-screen flex-col p-8 font-sans">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Scan results
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Scan ID: {id}. Placeholder.
      </p>
      <Link
        href="/repos"
        className="mt-6 text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
      >
        Back to repos
      </Link>
    </div>
  );
}
