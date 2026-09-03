import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { prisma } from "./db/prisma.js";
import * as snsClient from "./clients/sns.client.js";

vi.mock("./clients/sns.client.js");

const publishProductChangedMock = vi.mocked(snsClient.publishProductChanged);

const app = createApp();

beforeEach(() => {
  vi.resetAllMocks();
  publishProductChangedMock.mockResolvedValue(undefined);
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("validation", () => {
  it("rejects an invalid product payload on create", async () => {
    const res = await request(app).post("/products").send({ name: "Widget", price: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(publishProductChangedMock).not.toHaveBeenCalled();
  });

  it("rejects a non-uuid id on get", async () => {
    const res = await request(app).get("/products/not-a-uuid");
    expect(res.status).toBe(400);
  });
});

describe("unknown routes", () => {
  it("returns 404", async () => {
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("CRUD happy path", () => {
  const payload = {
    name: "Widget",
    description: "A basic widget",
    price: 19.99,
    sku: `WIDGET-${randomUUID()}`,
    stock: 100,
  };
  let createdId: string;

  afterAll(async () => {
    if (createdId) {
      await prisma.product.delete({ where: { id: createdId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("creates a product and publishes a created event", async () => {
    const res = await request(app).post("/products").send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: payload.name,
      description: payload.description,
      price: String(payload.price),
      sku: payload.sku,
      stock: payload.stock,
    });
    expect(res.body.id).toEqual(expect.any(String));
    createdId = res.body.id;

    expect(publishProductChangedMock).toHaveBeenCalledTimes(1);
    expect(publishProductChangedMock).toHaveBeenCalledWith({
      eventType: "created",
      productId: createdId,
      name: payload.name,
      description: payload.description,
    });
  });

  it("lists products including the created one", async () => {
    const res = await request(app).get("/products");
    expect(res.status).toBe(200);
    expect(res.body.some((product: { id: string }) => product.id === createdId)).toBe(true);
  });

  it("gets the product by id", async () => {
    const res = await request(app).get(`/products/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: createdId,
      name: payload.name,
      sku: payload.sku,
    });
  });

  it("updates the product and publishes an updated event with the full current name/description", async () => {
    const res = await request(app).patch(`/products/${createdId}`).send({ stock: 42 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: createdId,
      stock: 42,
    });

    // The PATCH only touched stock, but the published event must still carry
    // the product's full current name/description — recommendations needs
    // the complete text to re-embed, not just whatever this request changed.
    expect(publishProductChangedMock).toHaveBeenCalledTimes(1);
    expect(publishProductChangedMock).toHaveBeenCalledWith({
      eventType: "updated",
      productId: createdId,
      name: payload.name,
      description: payload.description,
    });
  });

  it("returns 404 when updating an unknown id", async () => {
    const res = await request(app).patch(`/products/${randomUUID()}`).send({ stock: 1 });
    expect(res.status).toBe(404);
    expect(publishProductChangedMock).not.toHaveBeenCalled();
  });

  it("returns 404 when deleting an unknown id", async () => {
    const res = await request(app).delete(`/products/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(publishProductChangedMock).not.toHaveBeenCalled();
  });

  it("deletes the product and publishes a deleted event with only productId", async () => {
    const deleteRes = await request(app).delete(`/products/${createdId}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/products/${createdId}`);
    expect(getRes.status).toBe(404);

    expect(publishProductChangedMock).toHaveBeenCalledTimes(1);
    expect(publishProductChangedMock).toHaveBeenCalledWith({
      eventType: "deleted",
      productId: createdId,
    });
  });
});
