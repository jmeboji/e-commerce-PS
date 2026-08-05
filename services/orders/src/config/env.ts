import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4004),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CART_SERVICE_URL: z.string().url().default("http://localhost:4003"),
  AWS_REGION: z.string().min(1).default("us-east-1"),
  AWS_ENDPOINT_URL: z.string().url().default("http://localhost:4566"),
  ORDER_CREATED_TOPIC_ARN: z.string().min(1, "ORDER_CREATED_TOPIC_ARN is required"),
});

export const env = envSchema.parse(process.env);
