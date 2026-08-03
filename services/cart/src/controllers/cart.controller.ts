import type { NextFunction, Request, Response } from "express";
import * as cartService from "../services/cart.service.js";
import { addItemSchema, cartIdParamSchema } from "../schemas/cart.schema.js";

export async function addItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { cartId } = cartIdParamSchema.parse(req.params);
    const input = addItemSchema.parse(req.body);
    const item = await cartService.addItemToCart(cartId, input);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}
