import type { NextFunction, Response } from "express";
import { securityConfig } from "../config/security.js";
import { AppError } from "../errors/app-error.js";
import { SessionService } from "../services/session.service.js";
import type { AuthenticatedRequest } from "../types/auth.js";
import { parseCookies } from "../utils/cookies.js";

export function createRequireAuth(sessions: SessionService) {
  return async (request: AuthenticatedRequest, _response: Response, next: NextFunction): Promise<void> => {
    try {
      const token = parseCookies(request)[securityConfig.sessionCookieName];
      if (!token) throw new AppError(401, "Authentication is required.", "AUTHENTICATION_REQUIRED");
      const admin = await sessions.authenticate(token);
      if (!admin) throw new AppError(401, "Authentication is required.", "AUTHENTICATION_REQUIRED");
      request.admin = admin;
      request.sessionToken = token;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roles: string[]) {
  return (request: AuthenticatedRequest, _response: Response, next: NextFunction): void => {
    if (!request.admin || !roles.includes(request.admin.role)) {
      next(new AppError(403, "You do not have permission to access this resource.", "FORBIDDEN"));
      return;
    }
    next();
  };
}
