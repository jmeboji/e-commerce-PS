import type { NextFunction, Request, Response } from "express";
import * as productsService from "../services/products.service.js";
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
} from "../schemas/product.schema.js";

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const products = await productsService.listProducts();
    res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = productIdParamSchema.parse(req.params);
    const product = await productsService.getProduct(id);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createProductSchema.parse(req.body);
    const product = await productsService.createProduct(input);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = productIdParamSchema.parse(req.params);
    const input = updateProductSchema.parse(req.body);
    const product = await productsService.updateProduct(id, input);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function destroy(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = productIdParamSchema.parse(req.params);
    await productsService.deleteProduct(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
