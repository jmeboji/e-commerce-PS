import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { startOrderPlacedConsumer, shutdownSqsClient } from "./consumers/order-placed.consumer.js";

const controller = new AbortController();

process.on("SIGINT", () => {
  console.log("[inventory-worker] received SIGINT, shutting down...");
  controller.abort();
});

process.on("SIGTERM", () => {
  console.log("[inventory-worker] received SIGTERM, shutting down...");
  controller.abort();
});

startOrderPlacedConsumer(controller.signal)
  .then(async () => {
    // Without these, the SQS client's HTTP keep-alive pool and Prisma's DB
    // connection pool both stay open, and the process never exits on its
    // own — the loop stopping isn't enough by itself.
    shutdownSqsClient();
    await prisma.$disconnect();
    console.log("[inventory-worker] shutdown complete");
  })
  .catch((err) => {
    console.error("[inventory-worker] crashed:", err);
    process.exit(1);
  });

console.log(`[inventory-worker] started (env: ${env.NODE_ENV})`);
