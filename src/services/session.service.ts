import type { PoolClient } from "pg";
import { securityConfig } from "../config/security.js";
import { AuthRepository } from "../repositories/auth.repository.js";
import type { SafeAdmin } from "../types/auth.js";
import { createSecureToken, hashToken } from "../utils/crypto.js";

export class SessionService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly secret: string,
  ) {}

  async create(adminId: string, rememberMe: boolean, connection: PoolClient): Promise<{ token: string; expiresAt: Date }> {
    const token = createSecureToken();
    const durationMs = rememberMe
      ? securityConfig.rememberedSessionDays * 24 * 60 * 60 * 1000
      : securityConfig.standardSessionHours * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + durationMs);
    await this.repository.createSession(adminId, hashToken(token, this.secret), expiresAt, connection);
    return { token, expiresAt };
  }

  authenticate(token: string): Promise<SafeAdmin | null> {
    return this.repository.findAdminBySessionHash(hashToken(token, this.secret));
  }

  revoke(token: string): Promise<string | null> {
    return this.repository.revokeSession(hashToken(token, this.secret));
  }
}
