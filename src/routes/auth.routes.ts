import { Router } from "express";
import type { AppEnv } from "../config/env.js";
import { AuthController } from "../controllers/auth.controller.js";
import { createRequireAuth } from "../middleware/auth.middleware.js";
import { createCsrfProtection } from "../middleware/csrf.middleware.js";
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  resetPasswordRateLimiter,
} from "../middleware/rate-limit.middleware.js";
import { SessionService } from "../services/session.service.js";

export function createAuthRouter(controller: AuthController, sessions: SessionService, env: AppEnv): Router {
  const router = Router();
  const requireAuth = createRequireAuth(sessions);
  const csrf = createCsrfProtection(env);
  router.get("/csrf-token", controller.csrfToken);
  router.post("/login", loginRateLimiter, csrf, controller.login);
  router.get("/me", requireAuth, controller.me);
  router.post("/logout", requireAuth, csrf, controller.logout);
  router.post("/forgot-password", forgotPasswordRateLimiter, csrf, controller.forgotPassword);
  router.post("/reset-password", resetPasswordRateLimiter, csrf, controller.resetPassword);
  return router;
}
