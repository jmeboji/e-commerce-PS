import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { startOrderPlacedConsumer, shutdownSqsClient } from "./consumers/order-placed.consumer.js";

const controller = new AbortController();

process.on("SIGINT", () => {
  console.log("[notifications-worker] received SIGINT, shutting down...");
  controller.abort();
});

process.on("SIGTERM", () => {
  console.log("[notifications-worker] received SIGTERM, shutting down...");
  controller.abort();
});

startOrderPlacedConsumer(controller.signal)
  .then(async () => {
    // Without these, the SQS client's HTTP keep-alive pool and Prisma's DB
    // connection pool both stay open, and the process never exits on its
    // own — the loop stopping isn't enough by itself.
    shutdownSqsClient();
    await prisma.$disconnect();
    console.log("[notifications-worker] shutdown complete");
  })
  .catch((err) => {
    console.error("[notifications-worker] crashed:", err);
    process.exit(1);
  });

console.log(`[notifications-worker] started (env: ${env.NODE_ENV})`);
