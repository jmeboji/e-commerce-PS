import { Router } from "express";
import * as productsController from "../controllers/products.controller.js";

export const productsRouter = Router();

productsRouter.get("/", productsController.index);
productsRouter.get("/:id", productsController.show);
productsRouter.post("/", productsController.create);
productsRouter.patch("/:id", productsController.update);
productsRouter.delete("/:id", productsController.destroy);
