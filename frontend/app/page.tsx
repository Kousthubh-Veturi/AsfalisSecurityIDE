import { ApiHealth } from "./components/ApiHealth";
import { HomeActions } from "./components/HomeActions";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Asfalis Security
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          <ApiHealth />
        </p>
        <HomeActions />
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          Log in installs the GitHub App on your account or org. You’ll be sent back here to manage connected repos.
        </p>
      </main>
    </div>
  );
}
