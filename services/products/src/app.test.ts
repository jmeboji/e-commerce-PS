import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { prisma } from "./db/prisma.js";

const app = createApp();

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

  it("creates a product", async () => {
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

  it("updates the product", async () => {
    const res = await request(app).patch(`/products/${createdId}`).send({ stock: 42 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: createdId,
      stock: 42,
    });
  });

  it("returns 404 when updating an unknown id", async () => {
    const res = await request(app).patch(`/products/${randomUUID()}`).send({ stock: 1 });
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting an unknown id", async () => {
    const res = await request(app).delete(`/products/${randomUUID()}`);
    expect(res.status).toBe(404);
  });

  it("deletes the product", async () => {
    const deleteRes = await request(app).delete(`/products/${createdId}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/products/${createdId}`);
    expect(getRes.status).toBe(404);
  });
});
