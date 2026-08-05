import { Router } from "express";
import * as ordersController from "../controllers/orders.controller.js";

export const ordersRouter = Router();

ordersRouter.post("/", ordersController.create);
ordersRouter.get("/:id", ordersController.show);
