import type { NextFunction, Request, Response } from "express";
import * as cartService from "../services/cart.service.js";
import { addItemSchema, cartIdParamSchema, createCartSchema } from "../schemas/cart.schema.js";

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    const { cartId } = cartIdParamSchema.parse(req.params);
    const cart = await cartService.getCartWithItems(cartId);
    res.json(cart);
  } catch (err) {
    next(err);
  }
}

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

export async function clear(req: Request, res: Response, next: NextFunction) {
  try {
    const { cartId } = cartIdParamSchema.parse(req.params);
    await cartService.clearCart(cartId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createCartSchema.parse(req.body);
    const cart = await cartService.createCart(input.userId);
    res.status(201).json(cart);
  } catch (err) {
    next(err);
  }
}
