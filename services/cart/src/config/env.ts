import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4003),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PRODUCTS_SERVICE_URL: z.string().url().default("http://localhost:4002"),
});

export const env = envSchema.parse(process.env);
