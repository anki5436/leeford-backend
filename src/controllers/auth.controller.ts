import type { NextFunction, Request, Response } from "express";
import type { AppEnv } from "../config/env.js";
import { securityConfig } from "../config/security.js";
import { AuthService } from "../services/auth.service.js";
import type { AuthenticatedRequest, RequestContext } from "../types/auth.js";
import { createSecureToken } from "../utils/crypto.js";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from "../validators/auth.validator.js";

function requestContext(request: Request): RequestContext {
  return {
    ipAddress: request.ip || null,
    userAgent: request.get("user-agent")?.slice(0, 1_000) ?? null,
  };
}

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly env: AppEnv,
  ) {}

  csrfToken = (_request: Request, response: Response): void => {
    const token = createSecureToken();
    response.cookie(securityConfig.csrfCookieName, token, {
      httpOnly: false,
      secure: this.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60 * 1000,
    });
    response.set("Cache-Control", "no-store").status(200).json({ success: true, data: { csrfToken: token } });
  };

  login = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const input = loginSchema.parse(request.body);
      const result = await this.authService.login(input.login, input.password, input.rememberMe, requestContext(request));
      response.cookie(securityConfig.sessionCookieName, result.token, {
        httpOnly: true,
        secure: this.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: result.expiresAt,
      });
      response.set("Cache-Control", "no-store").status(200).json({ success: true, data: { admin: result.admin } });
    } catch (error) {
      next(error);
    }
  };

  me = (request: AuthenticatedRequest, response: Response): void => {
    response.set("Cache-Control", "no-store").status(200).json({ success: true, data: { admin: request.admin } });
  };

  logout = async (request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.logout(request.sessionToken, requestContext(request));
      response.clearCookie(securityConfig.sessionCookieName, {
        httpOnly: true,
        secure: this.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      response.status(200).json({ success: true, message: "Signed out successfully." });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const input = forgotPasswordSchema.parse(request.body);
      const message = await this.authService.requestPasswordReset(input.email, requestContext(request));
      response.status(200).json({ success: true, message });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const input = resetPasswordSchema.parse(request.body);
      await this.authService.resetPassword(input.token, input.newPassword, requestContext(request));
      response.status(200).json({
        success: true,
        message: "Your password has been reset successfully. Please sign in using your new password.",
      });
    } catch (error) {
      next(error);
    }
  };
}
