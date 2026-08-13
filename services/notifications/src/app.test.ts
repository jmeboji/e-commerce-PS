import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
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

describe("GET /notifications/:orderId", () => {
  let orderId: string;

  afterEach(async () => {
    if (orderId) {
      await prisma.notificationLog.deleteMany({ where: { orderId } });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns the logged entries for a known order over real HTTP", async () => {
    orderId = randomUUID();
    const userId = randomUUID();
    await prisma.notificationLog.create({ data: { orderId, userId } });

    const res = await request(app).get(`/notifications/${orderId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ orderId, userId });
  });

  it("returns an empty array for an order with no logged notifications", async () => {
    const res = await request(app).get(`/notifications/${randomUUID()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
