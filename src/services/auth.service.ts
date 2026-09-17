import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { securityConfig } from "../config/security.js";
import { AppError } from "../errors/app-error.js";
import { AuthRepository } from "../repositories/auth.repository.js";
import type { RequestContext, SafeAdmin } from "../types/auth.js";
import { createSecureToken, hashToken } from "../utils/crypto.js";
import type { EmailService } from "./email.service.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import { SessionService } from "./session.service.js";

const invalidLoginMessage = "Invalid username/email or password.";
const genericResetMessage =
  "If an account exists for this email address, password reset instructions have been sent.";

export class AuthService {
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly repository: AuthRepository,
    private readonly sessions: SessionService,
    private readonly email: EmailService,
    private readonly tokenSecret: string,
  ) {
    this.dummyHash = hashPassword(randomBytes(32).toString("base64url"));
  }

  async login(
    login: string,
    password: string,
    rememberMe: boolean,
    context: RequestContext,
  ): Promise<{ admin: SafeAdmin; token: string; expiresAt: Date }> {
    const admin = await this.repository.findAdminByLogin(login.trim());
    const hashToCheck = admin?.password_hash ?? (await this.dummyHash);
    const passwordMatches = await verifyPassword(hashToCheck, password);
    const isLocked = Boolean(admin?.locked_until && admin.locked_until.getTime() > Date.now());

    if (!admin || !admin.is_active || isLocked || !passwordMatches) {
      if (admin?.is_active && !isLocked && !passwordMatches) {
        const lockedUntil = new Date(Date.now() + securityConfig.loginLockMinutes * 60 * 1000);
        const attempts = await this.repository.recordFailedLogin(
          admin.id,
          securityConfig.loginMaxAttempts,
          lockedUntil,
        );
        await this.repository.addAuditLog("LOGIN_FAILED", admin.id, context.ipAddress, context.userAgent, {
          locked: attempts >= securityConfig.loginMaxAttempts,
        });
      } else {
        await this.repository.addAuditLog("LOGIN_FAILED", admin?.id ?? null, context.ipAddress, context.userAgent);
      }
      throw new AppError(401, invalidLoginMessage, "INVALID_CREDENTIALS");
    }

    return this.repository.withTransaction(async (client: PoolClient) => {
      await this.repository.recordSuccessfulLogin(admin.id, client);
      const session = await this.sessions.create(admin.id, rememberMe, client);
      await this.repository.addAuditLog("LOGIN_SUCCESS", admin.id, context.ipAddress, context.userAgent, {}, client);
      return {
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          firstName: admin.first_name,
          lastName: admin.last_name,
          role: admin.role_name,
        },
        ...session,
      };
    });
  }

  async logout(token: string | undefined, context: RequestContext): Promise<void> {
    if (!token) return;
    const adminId = await this.sessions.revoke(token);
    if (adminId) {
      await this.repository.addAuditLog("LOGOUT", adminId, context.ipAddress, context.userAgent);
    }
  }

  async requestPasswordReset(email: string, context: RequestContext): Promise<string> {
    const admin = await this.repository.findActiveAdminByEmail(email.toLowerCase());
    if (!admin) return genericResetMessage;

    const rawToken = createSecureToken();
    const tokenHash = hashToken(rawToken, this.tokenSecret);
    const expiresAt = new Date(Date.now() + securityConfig.passwordResetMinutes * 60 * 1000);

    await this.repository.withTransaction(async (client) => {
      await this.repository.invalidateResetTokens(admin.id, client);
      await this.repository.createResetToken(admin.id, tokenHash, expiresAt, client);
      await this.repository.addAuditLog(
        "PASSWORD_RESET_REQUESTED",
        admin.id,
        context.ipAddress,
        context.userAgent,
        {},
        client,
      );
    });

    try {
      await this.email.sendPasswordReset(admin.email, rawToken);
    } catch {
      // Preserve the enumeration-safe response. Tokens and addresses are intentionally not logged.
      console.error("Password reset email delivery failed");
    }
    return genericResetMessage;
  }

  async resetPassword(rawToken: string, newPassword: string, context: RequestContext): Promise<void> {
    const tokenHash = hashToken(rawToken, this.tokenSecret);
    const newPasswordHash = await hashPassword(newPassword);

    await this.repository.withTransaction(async (client) => {
      const resetToken = await this.repository.lockResetToken(tokenHash, client);
      if (!resetToken || resetToken.used_at || resetToken.expires_at.getTime() <= Date.now()) {
        throw new AppError(400, "This password reset link is invalid or has expired.", "INVALID_RESET_TOKEN");
      }

      await this.repository.updatePassword(resetToken.admin_user_id, newPasswordHash, client);
      await this.repository.markResetTokenUsed(resetToken.id, client);
      await this.repository.invalidateResetTokens(resetToken.admin_user_id, client);
      await this.repository.revokeAllSessions(resetToken.admin_user_id, client);
      await this.repository.addAuditLog(
        "PASSWORD_RESET_SUCCESS",
        resetToken.admin_user_id,
        context.ipAddress,
        context.userAgent,
        {},
        client,
      );
    });
  }
}
