"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

// Catches a service being down (the lib/api clients throw on non-OK
// responses) for every route below the root layout, so the header stays.
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        A service this page depends on didn&apos;t respond. It may be starting up or down.
      </p>
      <button
        onClick={() => retry()}
        className="rounded-md border border-black/20 px-4 py-2 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
      >
        Try again
      </button>
    </div>
  );
}
