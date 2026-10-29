"use client";

import { useActionState } from "react";
import { placeOrder, type CheckoutState } from "@/app/cart/actions";

const initialState: CheckoutState = { message: "" };

export function CheckoutButton() {
  const [state, formAction, pending] = useActionState(placeOrder, initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <button
        type="submit"
        // Disabled while pending so a double click can't place two orders:
        // orders has no idempotency key, and both requests would read the
        // cart before either clears it.
        disabled={pending}
        className="rounded-md bg-foreground px-6 py-3 font-medium text-background disabled:opacity-60"
      >
        {pending ? "Placing order…" : "Checkout"}
      </button>
      <p aria-live="polite" className="text-sm text-red-600 dark:text-red-400">
        {state.message}
      </p>
    </form>
  );
}
