import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4005),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AWS_REGION: z.string().min(1).default("us-east-1"),
  AWS_ENDPOINT_URL: z.string().url().default("http://localhost:4566"),
  INVENTORY_QUEUE_URL: z.string().min(1, "INVENTORY_QUEUE_URL is required"),
});

export const env = envSchema.parse(process.env);
