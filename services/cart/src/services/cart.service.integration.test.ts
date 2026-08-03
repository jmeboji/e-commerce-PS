import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { prisma as PrismaClient } from "../db/prisma.js";
import type { addItemToCart as AddItemToCart } from "./cart.service.js";

// Set before any dynamic import of the cart service chain below, since
// products.client.ts reads this once at module-evaluation time.
const TEST_PORT = 4097;
const PRODUCTS_SERVICE_URL = `http://localhost:${TEST_PORT}`;
process.env.PRODUCTS_SERVICE_URL = PRODUCTS_SERVICE_URL;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsDir = path.resolve(__dirname, "../../../products");

async function waitForHealth(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // not up yet, keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`products service did not become healthy within ${timeoutMs}ms`);
}

describe("addItemToCart (integration, real products service)", () => {
  let productsProcess: ChildProcess;
  let prisma: typeof PrismaClient;
  let addItemToCart: typeof AddItemToCart;
  let cartId: string;
  let productId: string;

  beforeAll(async () => {
    productsProcess = spawn("pnpm", ["exec", "tsx", "src/index.ts"], {
      cwd: productsDir,
      env: { ...process.env, PORT: String(TEST_PORT) },
      stdio: "pipe",
    });

    await waitForHealth(PRODUCTS_SERVICE_URL);

    // Dynamic import: must happen after PRODUCTS_SERVICE_URL is set above.
    ({ prisma } = await import("../db/prisma.js"));
    ({ addItemToCart } = await import("./cart.service.js"));

    const createRes = await fetch(`${PRODUCTS_SERVICE_URL}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Integration Widget",
        description: "Created by cart integration test",
        price: 42.5,
        sku: `INTEGRATION-${randomUUID()}`,
        stock: 10,
      }),
    });
    const created = (await createRes.json()) as { id: string };
    productId = created.id;

    const cart = await prisma.cart.create({ data: { userId: `user-${randomUUID()}` } });
    cartId = cart.id;
  }, 30000);

  afterAll(async () => {
    if (productId) {
      await fetch(`${PRODUCTS_SERVICE_URL}/products/${productId}`, { method: "DELETE" }).catch(() => {});
    }
    if (cartId) {
      await prisma?.cart.delete({ where: { id: cartId } }).catch(() => {});
    }
    await prisma?.$disconnect();
    productsProcess?.kill();
  });

  it("adds a real product to the cart via the real, running products service", async () => {
    const item = await addItemToCart(cartId, { productId, quantity: 1 });
    expect(item.productId).toBe(productId);
    expect(item.quantity).toBe(1);
    expect(item.price.toString()).toBe("42.5");
  });

  it("propagates a 404 for a product that doesn't exist in the real service", async () => {
    await expect(
      addItemToCart(cartId, { productId: randomUUID(), quantity: 1 }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
