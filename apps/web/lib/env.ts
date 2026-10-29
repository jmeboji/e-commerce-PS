function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  PRODUCTS_URL: requireEnv("NEXT_PUBLIC_PRODUCTS_URL"),
  CART_URL: requireEnv("NEXT_PUBLIC_CART_URL"),
  ORDERS_URL: requireEnv("NEXT_PUBLIC_ORDERS_URL"),
  RECOMMENDATIONS_URL: requireEnv("NEXT_PUBLIC_RECOMMENDATIONS_URL"),
};
