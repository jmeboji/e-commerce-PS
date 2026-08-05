import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma.js";
import * as productsClient from "../clients/products.client.js";
import type { ProductResponse } from "../clients/products.client.js";
import { addItemToCart, getCartWithItems } from "./cart.service.js";

vi.mock("../clients/products.client.js");

const getProductByIdMock = vi.mocked(productsClient.getProductById);

function fakeProduct(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: randomUUID(),
    name: "Widget",
    description: "A test widget",
    price: "10.00",
    sku: `WIDGET-${randomUUID()}`,
    stock: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("addItemToCart", () => {
  let cartId: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    const cart = await prisma.cart.create({ data: { userId: `user-${randomUUID()}` } });
    cartId = cart.id;
  });

  afterEach(async () => {
    // Cascades to any CartItem rows created during the test.
    await prisma.cart.delete({ where: { id: cartId } }).catch(() => {});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("throws a 404 when the product does not exist", async () => {
    getProductByIdMock.mockResolvedValueOnce(null);

    await expect(addItemToCart(cartId, { productId: randomUUID(), quantity: 1 })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("does not touch the database when the product does not exist", async () => {
    getProductByIdMock.mockResolvedValueOnce(null);

    await expect(
      addItemToCart(cartId, { productId: randomUUID(), quantity: 1 }),
    ).rejects.toThrow();

    const items = await prisma.cartItem.findMany({ where: { cartId } });
    expect(items).toHaveLength(0);
  });

  it("creates a new cart item with a price snapshot from the products client", async () => {
    const product = fakeProduct({ price: "19.99" });
    getProductByIdMock.mockResolvedValueOnce(product);

    const item = await addItemToCart(cartId, { productId: product.id, quantity: 2 });

    expect(getProductByIdMock).toHaveBeenCalledWith(product.id);
    expect(item).toMatchObject({
      cartId,
      productId: product.id,
      quantity: 2,
    });
    expect(item.price.toString()).toBe("19.99");
  });

  it("merges quantity and keeps the original price snapshot on a repeat add, even if the catalog price changed", async () => {
    const product = fakeProduct({ price: "10.00" });
    getProductByIdMock.mockResolvedValueOnce(product);
    await addItemToCart(cartId, { productId: product.id, quantity: 2 });

    // Simulate the catalog price changing between the two adds.
    getProductByIdMock.mockResolvedValueOnce(fakeProduct({ id: product.id, price: "99.99" }));
    const merged = await addItemToCart(cartId, { productId: product.id, quantity: 3 });

    expect(merged).toMatchObject({
      cartId,
      productId: product.id,
      quantity: 5,
    });
    expect(merged.price.toString()).toBe("10");

    const items = await prisma.cartItem.findMany({ where: { cartId, productId: product.id } });
    expect(items).toHaveLength(1);
  });
});

describe("getCartWithItems", () => {
  let cartId: string;

  beforeEach(async () => {
    const cart = await prisma.cart.create({ data: { userId: `user-${randomUUID()}` } });
    cartId = cart.id;
  });

  afterEach(async () => {
    await prisma.cart.delete({ where: { id: cartId } }).catch(() => {});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("throws a 404 for an unknown cart", async () => {
    await expect(getCartWithItems(randomUUID())).rejects.toMatchObject({ status: 404 });
  });

  it("returns the cart with its items", async () => {
    const productId = randomUUID();
    await prisma.cartItem.create({
      data: { cartId, productId, quantity: 3, price: "12.50" },
    });

    const cart = await getCartWithItems(cartId);

    expect(cart.id).toBe(cartId);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ productId, quantity: 3 });
  });
});
