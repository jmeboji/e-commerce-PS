import Link from "next/link";

export default function OrderNotFound() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Order not found</h1>
      <Link href="/" className="underline">
        Back to all products
      </Link>
    </div>
  );
}
