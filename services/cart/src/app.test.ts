import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { prisma } from "./db/prisma.js";
import * as productsClient from "./clients/products.client.js";
import type { ProductResponse } from "./clients/products.client.js";

vi.mock("./clients/products.client.js");

const getProductByIdMock = vi.mocked(productsClient.getProductById);

const app = createApp();

describe("POST /carts/:cartId/items", () => {
  let cartId: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    const cart = await prisma.cart.create({ data: { userId: `user-${randomUUID()}` } });
    cartId = cart.id;
  });

  afterEach(async () => {
    await prisma.cart.delete({ where: { id: cartId } }).catch(() => {});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("adds an item to the cart over real HTTP and returns the created row", async () => {
    const product: ProductResponse = {
      id: randomUUID(),
      name: "Widget",
      description: "A test widget",
      price: "9.99",
      sku: `WIDGET-${randomUUID()}`,
      stock: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    getProductByIdMock.mockResolvedValueOnce(product);

    const res = await request(app)
      .post(`/carts/${cartId}/items`)
      .send({ productId: product.id, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      cartId,
      productId: product.id,
      quantity: 2,
      price: "9.99",
    });
  });
});

describe("GET /carts/:cartId", () => {
  let cartId: string;

  beforeEach(async () => {
    const cart = await prisma.cart.create({ data: { userId: `user-${randomUUID()}` } });
    cartId = cart.id;
  });

  afterEach(async () => {
    await prisma.cart.delete({ where: { id: cartId } }).catch(() => {});
  });

  it("returns the cart with its items over real HTTP", async () => {
    const productId = randomUUID();
    await prisma.cartItem.create({
      data: { cartId, productId, quantity: 1, price: "5.00" },
    });

    const res = await request(app).get(`/carts/${cartId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(cartId);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ productId, quantity: 1 });
  });

  it("returns 404 for an unknown cart", async () => {
    const res = await request(app).get(`/carts/${randomUUID()}`);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /carts/:cartId/items", () => {
  let cartId: string;

  beforeEach(async () => {
    const cart = await prisma.cart.create({ data: { userId: `user-${randomUUID()}` } });
    cartId = cart.id;
  });

  afterEach(async () => {
    await prisma.cart.delete({ where: { id: cartId } }).catch(() => {});
  });

  it("clears the cart's items over real HTTP", async () => {
    await prisma.cartItem.create({
      data: { cartId, productId: randomUUID(), quantity: 2, price: "9.99" },
    });

    const res = await request(app).delete(`/carts/${cartId}/items`);
    expect(res.status).toBe(204);

    const followUp = await request(app).get(`/carts/${cartId}`);
    expect(followUp.status).toBe(200);
    expect(followUp.body.items).toEqual([]);
  });

  it("returns 404 for an unknown cart", async () => {
    const res = await request(app).delete(`/carts/${randomUUID()}/items`);
    expect(res.status).toBe(404);
  });
});
