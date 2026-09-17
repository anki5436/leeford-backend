import { z } from "zod";

const passwordPolicy = z
  .string()
  .min(10, "Password must contain at least 10 characters")
  .max(256, "Password is too long")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

export const loginSchema = z.object({
  login: z.string().trim().min(1, "Username or email is required").max(320),
  password: z.string().min(1, "Password is required").max(256),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(320),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(32, "Reset token is invalid").max(512),
    newPassword: passwordPolicy,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createAdminSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "Username must contain at least 3 characters")
      .max(64)
      .regex(/^[a-z0-9][a-z0-9._-]*$/, "Use letters, numbers, dots, underscores, or hyphens"),
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(320),
    password: passwordPolicy,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export { passwordPolicy };
