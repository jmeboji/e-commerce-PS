import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { prisma } from "./db/prisma.js";
import * as cartClient from "./clients/cart.client.js";
import * as snsClient from "./clients/sns.client.js";
import type { CartResponse } from "./clients/cart.client.js";

vi.mock("./clients/cart.client.js");
vi.mock("./clients/sns.client.js");

const getCartByIdMock = vi.mocked(cartClient.getCartById);
const publishOrderCreatedMock = vi.mocked(snsClient.publishOrderCreated);

const app = createApp();

beforeEach(() => {
  vi.resetAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /orders", () => {
  it("checks out a cart over real HTTP and returns the created order", async () => {
    const userId = randomUUID();
    const cartId = randomUUID();
    const productId = randomUUID();

    const cart: CartResponse = {
      id: cartId,
      userId,
      items: [
        {
          id: randomUUID(),
          cartId,
          productId,
          quantity: 2,
          price: "12.50",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    getCartByIdMock.mockResolvedValueOnce(cart);
    publishOrderCreatedMock.mockResolvedValueOnce(undefined);

    const res = await request(app).post("/orders").send({ userId, cartId });

    // Directly confirmed by running this test with the actual response body
    // printed: 2 * 12.50 = 25.00, and Prisma's Decimal.toString() strips the
    // trailing zero to "25" (same behavior observed everywhere else in this
    // repo that serializes a Decimal, e.g. cart's own price snapshots).
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      userId,
      status: "PENDING",
      total: "25",
    });
    expect(res.body.items).toHaveLength(1);

    // Not just "it didn't throw" — assert the exact shape sent to SNS.
    expect(publishOrderCreatedMock).toHaveBeenCalledTimes(1);
    expect(publishOrderCreatedMock).toHaveBeenCalledWith({
      orderId: res.body.id,
      userId,
      total: "25",
      items: [{ productId, quantity: 2, price: "12.5" }],
    });

    await prisma.order.delete({ where: { id: res.body.id } });
  });

  it("returns 404 and does not publish when the cart does not exist", async () => {
    getCartByIdMock.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/orders")
      .send({ userId: randomUUID(), cartId: randomUUID() });

    expect(res.status).toBe(404);
    expect(publishOrderCreatedMock).not.toHaveBeenCalled();
  });

  it("returns 400 and does not publish when the cart is empty", async () => {
    getCartByIdMock.mockResolvedValueOnce({
      id: randomUUID(),
      userId: randomUUID(),
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .post("/orders")
      .send({ userId: randomUUID(), cartId: randomUUID() });

    expect(res.status).toBe(400);
    expect(publishOrderCreatedMock).not.toHaveBeenCalled();
  });

  it("returns 400 via Zod for an invalid payload and never touches the cart client", async () => {
    const res = await request(app).post("/orders").send({ userId: "not-a-uuid" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(getCartByIdMock).not.toHaveBeenCalled();
  });
});

describe("GET /orders/:id", () => {
  it("returns the order over real HTTP", async () => {
    const order = await prisma.order.create({
      data: {
        userId: randomUUID(),
        total: "9.99",
        items: { create: [{ productId: randomUUID(), quantity: 1, price: "9.99" }] },
      },
    });

    const res = await request(app).get(`/orders/${order.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(order.id);
    expect(res.body.items).toHaveLength(1);

    await prisma.order.delete({ where: { id: order.id } });
  });

  it("returns 404 for an unknown order", async () => {
    const res = await request(app).get(`/orders/${randomUUID()}`);
    expect(res.status).toBe(404);
  });
});
