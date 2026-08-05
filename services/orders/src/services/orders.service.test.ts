import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma.js";
import * as cartClient from "../clients/cart.client.js";
import * as snsClient from "../clients/sns.client.js";
import type { CartResponse } from "../clients/cart.client.js";
import { createOrder, getOrder } from "./orders.service.js";

vi.mock("../clients/cart.client.js");
vi.mock("../clients/sns.client.js");

const getCartByIdMock = vi.mocked(cartClient.getCartById);
const publishOrderCreatedMock = vi.mocked(snsClient.publishOrderCreated);

function fakeCart(overrides: Partial<CartResponse> = {}): CartResponse {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("createOrder", () => {
  let createdOrderId: string | undefined;

  beforeEach(() => {
    vi.resetAllMocks();
    createdOrderId = undefined;
  });

  afterEach(async () => {
    if (createdOrderId) {
      await prisma.order.delete({ where: { id: createdOrderId } }).catch(() => {});
    }
  });

  it("throws a 404 when the cart does not exist", async () => {
    getCartByIdMock.mockResolvedValueOnce(null);

    await expect(
      createOrder({ userId: randomUUID(), cartId: randomUUID() }),
    ).rejects.toMatchObject({ status: 404 });

    expect(publishOrderCreatedMock).not.toHaveBeenCalled();
  });

  it("throws a 400 when the cart is empty", async () => {
    getCartByIdMock.mockResolvedValueOnce(fakeCart({ items: [] }));

    await expect(
      createOrder({ userId: randomUUID(), cartId: randomUUID() }),
    ).rejects.toMatchObject({ status: 400 });

    expect(publishOrderCreatedMock).not.toHaveBeenCalled();
  });

  it("computes the total, copies line items, and publishes OrderCreated", async () => {
    const userId = randomUUID();
    const productA = randomUUID();
    const productB = randomUUID();
    const cart = fakeCart({
      userId,
      items: [
        {
          id: randomUUID(),
          cartId: randomUUID(),
          productId: productA,
          quantity: 2,
          price: "10.00",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: randomUUID(),
          cartId: randomUUID(),
          productId: productB,
          quantity: 1,
          price: "5.25",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    getCartByIdMock.mockResolvedValueOnce(cart);
    publishOrderCreatedMock.mockResolvedValueOnce(undefined);

    const order = await createOrder({ userId, cartId: cart.id });
    createdOrderId = order.id;

    expect(order.userId).toBe(userId);
    expect(order.status).toBe("PENDING");
    expect(order.total.toString()).toBe("25.25");
    expect(order.items).toHaveLength(2);
    expect(order.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: productA, quantity: 2 }),
        expect.objectContaining({ productId: productB, quantity: 1 }),
      ]),
    );

    expect(publishOrderCreatedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: order.id,
        userId,
        total: "25.25",
      }),
    );
  });
});

describe("getOrder", () => {
  it("throws a 404 for an unknown order", async () => {
    await expect(getOrder(randomUUID())).rejects.toMatchObject({ status: 404 });
  });

  it("returns the order with its items", async () => {
    const order = await prisma.order.create({
      data: {
        userId: randomUUID(),
        total: "9.99",
        items: { create: [{ productId: randomUUID(), quantity: 1, price: "9.99" }] },
      },
    });

    const found = await getOrder(order.id);

    expect(found.id).toBe(order.id);
    expect(found.items).toHaveLength(1);

    await prisma.order.delete({ where: { id: order.id } });
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
