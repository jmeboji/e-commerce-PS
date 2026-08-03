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
