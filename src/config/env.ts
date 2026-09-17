import { z } from "zod";

const optionalString = z.string().trim().optional().transform((value) => value || undefined);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(5000),
    APP_URL: z.string().url().default("http://localhost:3000"),
    FRONTEND_URL: optionalString,
    DATABASE_URL: optionalString,
    DB_HOST: z.string().min(1).default("localhost"),
    DB_PORT: z.coerce.number().int().min(1).max(65_535).default(5432),
    DB_NAME: z.string().min(1).default("leeford_admin"),
    DB_USER: z.string().min(1).default("postgres"),
    DB_PASSWORD: z.string().default(""),
    DB_SSL: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    SMTP_FROM: optionalString,
  })
  .transform((values) => ({
    ...values,
    FRONTEND_URL: values.FRONTEND_URL ?? values.APP_URL,
  }));

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = undefined;
}
