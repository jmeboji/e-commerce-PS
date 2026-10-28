// Prices arrive as Decimal(10, 2) strings. Sum in integer cents so a cart
// total never picks up floating-point noise like 0.30000000000000004.
export function toCents(price: string): number {
  return Math.round(Number(price) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
