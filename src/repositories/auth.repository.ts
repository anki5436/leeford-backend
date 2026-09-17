import type { Pool, PoolClient, QueryResultRow } from "pg";
import type { SafeAdmin } from "../types/auth.js";

type DatabaseConnection = Pool | PoolClient;

export interface AdminRecord extends QueryResultRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  role_name: string;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
}

interface SessionAdminRow extends QueryResultRow {
  id: string;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_name: string;
}

export interface ResetTokenRecord extends QueryResultRow {
  id: string;
  admin_user_id: string;
  expires_at: Date;
  used_at: Date | null;
}

function toSafeAdmin(row: SessionAdminRow | AdminRecord): SafeAdmin {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role_name,
  };
}

export class AuthRepository {
  constructor(private readonly pool: Pool) {}

  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findAdminByLogin(login: string, connection: DatabaseConnection = this.pool): Promise<AdminRecord | null> {
    const result = await connection.query<AdminRecord>(
      `SELECT au.id, au.username, au.email, au.password_hash, au.first_name, au.last_name,
              au.is_active, au.failed_login_attempts, au.locked_until, r.name AS role_name
         FROM admin_users au
         JOIN roles r ON r.id = au.role_id
        WHERE LOWER(au.username) = LOWER($1) OR LOWER(au.email) = LOWER($1)
        LIMIT 1`,
      [login],
    );
    return result.rows[0] ?? null;
  }

  async findActiveAdminByEmail(email: string): Promise<AdminRecord | null> {
    const result = await this.pool.query<AdminRecord>(
      `SELECT au.id, au.username, au.email, au.password_hash, au.first_name, au.last_name,
              au.is_active, au.failed_login_attempts, au.locked_until, r.name AS role_name
         FROM admin_users au
         JOIN roles r ON r.id = au.role_id
        WHERE LOWER(au.email) = LOWER($1) AND au.is_active = TRUE
        LIMIT 1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async recordFailedLogin(adminId: string, maxAttempts: number, lockedUntil: Date): Promise<number> {
    const result = await this.pool.query<{ failed_login_attempts: number }>(
      `UPDATE admin_users
          SET failed_login_attempts = failed_login_attempts + 1,
              locked_until = CASE
                WHEN failed_login_attempts + 1 >= $2 THEN $3
                ELSE locked_until
              END,
              updated_at = NOW()
        WHERE id = $1
        RETURNING failed_login_attempts`,
      [adminId, maxAttempts, lockedUntil],
    );
    return result.rows[0]?.failed_login_attempts ?? 0;
  }

  async recordSuccessfulLogin(adminId: string, connection: DatabaseConnection): Promise<void> {
    await connection.query(
      `UPDATE admin_users
          SET failed_login_attempts = 0, locked_until = NULL,
              last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [adminId],
    );
  }

  async createSession(
    adminId: string,
    tokenHash: string,
    expiresAt: Date,
    connection: DatabaseConnection,
  ): Promise<void> {
    await connection.query(
      `INSERT INTO admin_sessions (admin_user_id, session_token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [adminId, tokenHash, expiresAt],
    );
  }

  async findAdminBySessionHash(tokenHash: string): Promise<SafeAdmin | null> {
    const result = await this.pool.query<SessionAdminRow>(
      `UPDATE admin_sessions s
          SET last_used_at = NOW()
         FROM admin_users au, roles r
        WHERE s.session_token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
          AND au.id = s.admin_user_id
          AND au.is_active = TRUE
          AND r.id = au.role_id
        RETURNING au.id, au.username, au.email, au.first_name, au.last_name, r.name AS role_name`,
      [tokenHash],
    );
    return result.rows[0] ? toSafeAdmin(result.rows[0]) : null;
  }

  async revokeSession(tokenHash: string): Promise<string | null> {
    const result = await this.pool.query<{ admin_user_id: string }>(
      `UPDATE admin_sessions
          SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE session_token_hash = $1
        RETURNING admin_user_id`,
      [tokenHash],
    );
    return result.rows[0]?.admin_user_id ?? null;
  }

  async revokeAllSessions(adminId: string, connection: DatabaseConnection): Promise<void> {
    await connection.query(
      `UPDATE admin_sessions SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE admin_user_id = $1 AND revoked_at IS NULL`,
      [adminId],
    );
  }

  async invalidateResetTokens(adminId: string, connection: DatabaseConnection): Promise<void> {
    await connection.query(
      `UPDATE password_reset_tokens SET used_at = COALESCE(used_at, NOW())
        WHERE admin_user_id = $1 AND used_at IS NULL`,
      [adminId],
    );
  }

  async createResetToken(
    adminId: string,
    tokenHash: string,
    expiresAt: Date,
    connection: DatabaseConnection,
  ): Promise<void> {
    await connection.query(
      `INSERT INTO password_reset_tokens (admin_user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [adminId, tokenHash, expiresAt],
    );
  }

  async lockResetToken(tokenHash: string, connection: DatabaseConnection): Promise<ResetTokenRecord | null> {
    const result = await connection.query<ResetTokenRecord>(
      `SELECT id, admin_user_id, expires_at, used_at
         FROM password_reset_tokens
        WHERE token_hash = $1
        FOR UPDATE`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async updatePassword(adminId: string, passwordHash: string, connection: DatabaseConnection): Promise<void> {
    await connection.query(
      `UPDATE admin_users
          SET password_hash = $2, password_changed_at = NOW(), must_change_password = FALSE,
              failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
        WHERE id = $1`,
      [adminId, passwordHash],
    );
  }

  async markResetTokenUsed(tokenId: string, connection: DatabaseConnection): Promise<void> {
    await connection.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1 AND used_at IS NULL`,
      [tokenId],
    );
  }

  async addAuditLog(
    eventType: string,
    adminId: string | null,
    ipAddress: string | null,
    userAgent: string | null,
    metadata: Record<string, unknown> = {},
    connection: DatabaseConnection = this.pool,
  ): Promise<void> {
    await connection.query(
      `INSERT INTO audit_logs (admin_user_id, event_type, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [adminId, eventType, ipAddress, userAgent, JSON.stringify(metadata)],
    );
  }

  async adminIdentityExists(username: string, email: string): Promise<{ username: boolean; email: boolean }> {
    const result = await this.pool.query<{ username_exists: boolean; email_exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM admin_users WHERE LOWER(username) = LOWER($1)) AS username_exists,
              EXISTS(SELECT 1 FROM admin_users WHERE LOWER(email) = LOWER($2)) AS email_exists`,
      [username, email],
    );
    return {
      username: result.rows[0]?.username_exists ?? false,
      email: result.rows[0]?.email_exists ?? false,
    };
  }

  async createSuperAdmin(username: string, email: string, passwordHash: string): Promise<void> {
    const result = await this.pool.query(
      `INSERT INTO admin_users (username, email, password_hash, role_id, is_active, is_email_verified)
       SELECT $1, $2, $3, id, TRUE, TRUE FROM roles WHERE name = 'SUPER_ADMIN'`,
      [username, email, passwordHash],
    );
    if (result.rowCount !== 1) {
      throw new Error("SUPER_ADMIN role is missing. Run migrations before creating an administrator.");
    }
  }
}
