import express from "express";
import { productsRouter } from "./routes/products.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get("/health", (req, res) => res.json({ status: "ok" }));
  app.use("/products", productsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
