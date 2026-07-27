import { prisma } from "../db/prisma.js";
import { HttpError } from "../middleware/error-handler.js";
import type { CreateUserInput, UpdateUserInput } from "../schemas/user.schema.js";

export function listUsers() {
  return prisma.user.findMany();
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new HttpError(404, `User ${id} not found`);
  }
  return user;
}

export function createUser(input: CreateUserInput) {
  return prisma.user.create({ data: input });
}

export async function updateUser(id: string, input: UpdateUserInput) {
  await getUser(id);
  return prisma.user.update({ where: { id }, data: input });
}

export async function deleteUser(id: string) {
  await getUser(id);
  await prisma.user.delete({ where: { id } });
}
