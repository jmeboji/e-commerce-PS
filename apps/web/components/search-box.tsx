import Form from "next/form";

// A GET form to /search: results get a shareable URL (/search?q=...) and
// it works before JavaScript loads. next/form makes it a client-side
// navigation once hydrated.
export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <Form action="/search" className="flex min-w-0 flex-1 gap-2 sm:max-w-sm">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search products"
        aria-label="Search products"
        maxLength={200}
        required
        className="min-w-0 flex-1 rounded-md border border-black/20 bg-transparent px-3 py-1.5 text-sm dark:border-white/25"
      />
      <button
        type="submit"
        className="rounded-md border border-black/20 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
      >
        Search
      </button>
    </Form>
  );
}
