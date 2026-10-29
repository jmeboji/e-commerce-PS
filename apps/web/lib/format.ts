// products stores price as a bare Decimal(10, 2) with no currency, so the
// currency here is a display-only assumption, kept in one place.
const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatPrice(price: string): string {
  return priceFormatter.format(Number(price));
}
