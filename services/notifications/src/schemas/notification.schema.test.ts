import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { orderCreatedEventSchema } from "./notification.schema.js";

function event(userId: string) {
  return { orderId: randomUUID(), userId, total: "10.00", items: [] };
}

describe("orderCreatedEventSchema", () => {
  it("accepts a guest (non-UUID) userId", () => {
    expect(orderCreatedEventSchema.safeParse(event("guest-abc123")).success).toBe(true);
  });

  it("rejects an empty userId", () => {
    expect(orderCreatedEventSchema.safeParse(event("")).success).toBe(false);
  });
});
