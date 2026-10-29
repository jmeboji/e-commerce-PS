import Link from "next/link";

export default function ProductNotFound() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Product not found</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        It may have been removed from the catalog.
      </p>
      <Link href="/" className="underline">
        Back to all products
      </Link>
    </div>
  );
}
