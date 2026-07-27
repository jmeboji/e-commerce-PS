import { Router } from "express";
import * as usersController from "../controllers/users.controller.js";

export const usersRouter = Router();

usersRouter.get("/", usersController.index);
usersRouter.get("/:id", usersController.show);
usersRouter.post("/", usersController.create);
usersRouter.patch("/:id", usersController.update);
usersRouter.delete("/:id", usersController.destroy);
