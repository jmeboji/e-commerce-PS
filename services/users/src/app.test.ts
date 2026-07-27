import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

const app = createApp();

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("validation", () => {
  it("rejects an invalid user payload on create", async () => {
    const res = await request(app).post("/users").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("rejects a non-uuid id on get", async () => {
    const res = await request(app).get("/users/not-a-uuid");
    expect(res.status).toBe(400);
  });
});

describe("unknown routes", () => {
  it("returns 404", async () => {
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
  });
});
