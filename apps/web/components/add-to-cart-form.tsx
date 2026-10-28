"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addToCart, type AddToCartState } from "@/app/cart/actions";

const initialState: AddToCartState = { status: "idle", message: "" };

export function AddToCartForm({ productId, inStock }: { productId: string; inStock: boolean }) {
  const [state, formAction, pending] = useActionState(addToCart, initialState);

  if (!inStock) {
    return <p className="font-medium text-zinc-600 dark:text-zinc-400">Currently unavailable</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="productId" value={productId} />
      <label className="flex flex-col gap-1 text-sm">
        Quantity
        <input
          type="number"
          name="quantity"
          defaultValue={1}
          min={1}
          max={99}
          required
          className="w-20 rounded-md border border-black/20 bg-transparent px-2 py-1.5 dark:border-white/25"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to cart"}
      </button>
      <p aria-live="polite" className="basis-full text-sm">
        {state.status === "added" && (
          <>
            {state.message}{" "}
            <Link href="/cart" className="underline">
              View cart
            </Link>
          </>
        )}
        {state.status === "error" && <span className="text-red-600 dark:text-red-400">{state.message}</span>}
      </p>
    </form>
  );
}
