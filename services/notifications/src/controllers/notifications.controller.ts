import type { NextFunction, Request, Response } from "express";
import * as notificationService from "../services/notification.service.js";
import { orderIdParamSchema } from "../schemas/notification.schema.js";

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderId } = orderIdParamSchema.parse(req.params);
    const logs = await notificationService.getNotificationLogsByOrderId(orderId);
    res.json(logs);
  } catch (err) {
    next(err);
  }
}
