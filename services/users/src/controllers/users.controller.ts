import type { NextFunction, Request, Response } from "express";
import * as usersService from "../services/users.service.js";
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
} from "../schemas/user.schema.js";

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await usersService.listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const user = await usersService.getUser(id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createUserSchema.parse(req.body);
    const user = await usersService.createUser(input);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const input = updateUserSchema.parse(req.body);
    const user = await usersService.updateUser(id, input);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function destroy(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    await usersService.deleteUser(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
