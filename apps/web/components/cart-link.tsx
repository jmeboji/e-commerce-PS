import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { getCurrentCart } from "@/lib/cart-session";

// Rendered by the root layout, which no error.tsx covers, so a cart
// service outage must degrade to a plain link here rather than throw and
// take down every page.
export async function CartLink() {
  let count = 0;
  try {
    const cart = await getCurrentCart();
    count = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  } catch (err) {
    // cookies() signals dynamic rendering by throwing; that must reach
    // Next, not be swallowed as a cart outage.
    unstable_rethrow(err);
    console.error("Couldn't load cart for header count:", err);
  }

  return (
    <Link href="/cart" className="font-medium hover:underline">
      Cart{count > 0 && ` (${count})`}
    </Link>
  );
}
