import type { NextFunction, Request, Response } from "express";
import type { AppEnv } from "../config/env.js";
import { securityConfig } from "../config/security.js";
import { AppError } from "../errors/app-error.js";
import { parseCookies } from "../utils/cookies.js";
import { safeEqual } from "../utils/crypto.js";

export function createCsrfProtection(env: AppEnv) {
  const expectedOrigin = new URL(env.FRONTEND_URL).origin;
  return (request: Request, _response: Response, next: NextFunction): void => {
    const origin = request.get("origin");
    if (origin && origin !== expectedOrigin) {
      next(new AppError(403, "Request origin is not allowed.", "CSRF_VALIDATION_FAILED"));
      return;
    }

    const cookieToken = parseCookies(request)[securityConfig.csrfCookieName];
    const headerToken = request.get("x-csrf-token");
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
      next(new AppError(403, "Security token is missing or invalid.", "CSRF_VALIDATION_FAILED"));
      return;
    }
    next();
  };
}
