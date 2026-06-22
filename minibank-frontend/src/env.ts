// src/env.ts
import { z } from "zod";

// 1. Define the exact shape your environment MUST take
const envSchema = z.object({
  // It must exist, and it MUST be a valid URL format
  VITE_API_URL: z.string().url("VITE_API_URL is missing or is not a valid URL"),
  
  // You can add future variables here! (e.g., Stripe keys, Analytics IDs)
  // VITE_STRIPE_KEY: z.string().min(1), 
});

// 2. Intercept Vite's environment variables and test them against Zod
const parsedEnv = envSchema.safeParse(import.meta.env);

// 3. If validation fails, intentionally crash the app and print a beautiful error
if (!parsedEnv.success) {
  console.error("❌ CRITICAL: Invalid environment variables detected!");
  console.error(parsedEnv.error.format());
  
  // Throwing an error stops the app from rendering entirely
  throw new Error("Missing or invalid environment variables. Check your .env file.");
}

// 4. Export the validated variables so the rest of the app can use them safely
export const ENV = parsedEnv.data;