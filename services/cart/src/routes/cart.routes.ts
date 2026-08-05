import { Router } from "express";
import * as cartController from "../controllers/cart.controller.js";

export const cartRouter = Router();

cartRouter.get("/:cartId", cartController.show);
cartRouter.post("/:cartId/items", cartController.addItem);
