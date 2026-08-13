import { Router } from "express";
import * as notificationsController from "../controllers/notifications.controller.js";

export const notificationsRouter = Router();

notificationsRouter.get("/:orderId", notificationsController.index);
