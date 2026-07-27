import express from "express";
import { usersRouter } from "./routes/users.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get("/health", (req, res) => res.json({ status: "ok" }));
  app.use("/users", usersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
