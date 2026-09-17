import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import type { AppEnv } from "../../src/config/env.js";
import { AuthRepository, type AdminRecord, type ResetTokenRecord } from "../../src/repositories/auth.repository.js";
import { AuthService } from "../../src/services/auth.service.js";
import type { EmailService } from "../../src/services/email.service.js";
import { hashPassword } from "../../src/services/password.service.js";
import { SessionService } from "../../src/services/session.service.js";
import type { SafeAdmin } from "../../src/types/auth.js";

interface MemorySession { adminId: string; expiresAt: Date; revoked: boolean }
interface MemoryReset { id: string; adminId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }

export class MemoryRepository {
  admins: AdminRecord[] = [];
  sessions = new Map<string, MemorySession>();
  resets: MemoryReset[] = [];
  audits: string[] = [];

  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    return work({} as PoolClient);
  }

  async findAdminByLogin(login: string): Promise<AdminRecord | null> {
    const normalized = login.toLowerCase();
    return this.admins.find((admin) => admin.username.toLowerCase() === normalized || admin.email.toLowerCase() === normalized) ?? null;
  }

  async findActiveAdminByEmail(email: string): Promise<AdminRecord | null> {
    return this.admins.find((admin) => admin.is_active && admin.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async recordFailedLogin(adminId: string, maxAttempts: number, lockedUntil: Date): Promise<number> {
    const admin = this.admins.find((entry) => entry.id === adminId)!;
    admin.failed_login_attempts += 1;
    if (admin.failed_login_attempts >= maxAttempts) admin.locked_until = lockedUntil;
    return admin.failed_login_attempts;
  }

  async recordSuccessfulLogin(adminId: string): Promise<void> {
    const admin = this.admins.find((entry) => entry.id === adminId)!;
    admin.failed_login_attempts = 0;
    admin.locked_until = null;
  }

  async createSession(adminId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.sessions.set(tokenHash, { adminId, expiresAt, revoked: false });
  }

  async findAdminBySessionHash(tokenHash: string): Promise<SafeAdmin | null> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.revoked || session.expiresAt <= new Date()) return null;
    const admin = this.admins.find((entry) => entry.id === session.adminId && entry.is_active);
    return admin ? safeAdmin(admin) : null;
  }

  async revokeSession(tokenHash: string): Promise<string | null> {
    const session = this.sessions.get(tokenHash);
    if (!session) return null;
    session.revoked = true;
    return session.adminId;
  }

  async revokeAllSessions(adminId: string): Promise<void> {
    for (const session of this.sessions.values()) if (session.adminId === adminId) session.revoked = true;
  }

  async invalidateResetTokens(adminId: string): Promise<void> {
    for (const token of this.resets) if (token.adminId === adminId && !token.usedAt) token.usedAt = new Date();
  }

  async createResetToken(adminId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.resets.push({ id: String(this.resets.length + 1), adminId, tokenHash, expiresAt, usedAt: null });
  }

  async lockResetToken(tokenHash: string): Promise<ResetTokenRecord | null> {
    const token = this.resets.find((entry) => entry.tokenHash === tokenHash);
    return token
      ? { id: token.id, admin_user_id: token.adminId, expires_at: token.expiresAt, used_at: token.usedAt }
      : null;
  }

  async updatePassword(adminId: string, passwordHash: string): Promise<void> {
    const admin = this.admins.find((entry) => entry.id === adminId)!;
    admin.password_hash = passwordHash;
    admin.failed_login_attempts = 0;
    admin.locked_until = null;
  }

  async markResetTokenUsed(tokenId: string): Promise<void> {
    const token = this.resets.find((entry) => entry.id === tokenId)!;
    token.usedAt = new Date();
  }

  async addAuditLog(eventType: string): Promise<void> { this.audits.push(eventType); }

  async adminIdentityExists(username: string, email: string): Promise<{ username: boolean; email: boolean }> {
    return {
      username: this.admins.some((admin) => admin.username.toLowerCase() === username.toLowerCase()),
      email: this.admins.some((admin) => admin.email.toLowerCase() === email.toLowerCase()),
    };
  }
}

export class MemoryEmailService implements EmailService {
  messages: Array<{ email: string; token: string }> = [];
  async sendPasswordReset(email: string, token: string): Promise<void> { this.messages.push({ email, token }); }
}

export const testEnv: AppEnv = {
  NODE_ENV: "test",
  PORT: 5000,
  APP_URL: "http://localhost:3000",
  FRONTEND_URL: "http://localhost:3000",
  DB_HOST: "localhost",
  DB_PORT: 5432,
  DB_NAME: "test",
  DB_USER: "test",
  DB_PASSWORD: "",
  DB_SSL: false,
  SESSION_SECRET: "test-secret-with-at-least-thirty-two-characters",
  SMTP_PORT: 587,
  SMTP_SECURE: false,
};

export async function createAuthFixture() {
  const repository = new MemoryRepository();
  const uniqueId = randomBytes(8).toString("hex");
  const credential = {
    username: `testadmin_${uniqueId}`,
    email: `admin-${uniqueId}@example.test`,
    password: `A!a9${randomBytes(18).toString("base64url")}`,
  };
  repository.admins.push({
    id: "1",
    username: credential.username,
    email: credential.email,
    password_hash: await hashPassword(credential.password),
    first_name: "Leeford",
    last_name: "Admin",
    role_name: "SUPER_ADMIN",
    is_active: true,
    failed_login_attempts: 0,
    locked_until: null,
  });
  repository.admins.push({
    id: "2",
    username: `inactive_${uniqueId}`,
    email: `inactive-${uniqueId}@example.test`,
    password_hash: await hashPassword(credential.password),
    first_name: null,
    last_name: null,
    role_name: "SUPER_ADMIN",
    is_active: false,
    failed_login_attempts: 0,
    locked_until: null,
  });
  const email = new MemoryEmailService();
  const typedRepository = repository as unknown as AuthRepository;
  const sessions = new SessionService(typedRepository, testEnv.SESSION_SECRET);
  const auth = new AuthService(typedRepository, sessions, email, testEnv.SESSION_SECRET);
  return { repository, email, sessions, auth, credential };
}

function safeAdmin(admin: AdminRecord): SafeAdmin {
  return {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    firstName: admin.first_name,
    lastName: admin.last_name,
    role: admin.role_name,
  };
}
