import { env } from "./config/env.js";
import { startOrderPlacedConsumer } from "./consumers/order-placed.consumer.js";

const controller = new AbortController();

process.on("SIGINT", () => {
  console.log("[inventory-worker] received SIGINT, shutting down...");
  controller.abort();
});

process.on("SIGTERM", () => {
  console.log("[inventory-worker] received SIGTERM, shutting down...");
  controller.abort();
});

startOrderPlacedConsumer(controller.signal).catch((err) => {
  console.error("[inventory-worker] crashed:", err);
  process.exit(1);
});

console.log(`[inventory-worker] started (env: ${env.NODE_ENV})`);
