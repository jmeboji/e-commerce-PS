import type { NextFunction, Request, Response } from "express";
import * as ordersService from "../services/orders.service.js";
import { createOrderSchema, orderIdParamSchema } from "../schemas/order.schema.js";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createOrderSchema.parse(req.body);
    const order = await ordersService.createOrder(input);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = orderIdParamSchema.parse(req.params);
    const order = await ordersService.getOrder(id);
    res.json(order);
  } catch (err) {
    next(err);
  }
}
