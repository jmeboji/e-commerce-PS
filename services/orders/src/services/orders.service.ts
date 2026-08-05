import { Prisma } from "../generated/prisma/index.js";
import { prisma } from "../db/prisma.js";
import { HttpError } from "../middleware/error-handler.js";
import { getCartById } from "../clients/cart.client.js";
import { publishOrderCreated } from "../clients/sns.client.js";
import type { CreateOrderInput } from "../schemas/order.schema.js";

export async function createOrder(input: CreateOrderInput) {
  const cart = await getCartById(input.cartId);
  if (!cart) {
    throw new HttpError(404, `Cart ${input.cartId} not found`);
  }
  if (cart.items.length === 0) {
    throw new HttpError(400, "Cart is empty");
  }

  const total = cart.items.reduce(
    (sum, item) => sum.plus(new Prisma.Decimal(item.price).times(item.quantity)),
    new Prisma.Decimal(0),
  );

  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      total,
      items: {
        create: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      },
    },
    include: { items: true },
  });

  await publishOrderCreated({
    orderId: order.id,
    userId: order.userId,
    total: order.total.toString(),
    items: order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.price.toString(),
    })),
  });

  // Known gap, tracked in ECOM-13b: the source cart isn't cleared after
  // checkout, so a second checkout against the same cart currently produces
  // a duplicate order instead of hitting the "cart is empty" 400 above.
  return order;
}

export async function getOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) {
    throw new HttpError(404, `Order ${id} not found`);
  }
  return order;
}
