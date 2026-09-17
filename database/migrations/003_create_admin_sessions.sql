CREATE TABLE admin_sessions (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX admin_sessions_user_index ON admin_sessions (admin_user_id);
CREATE INDEX admin_sessions_active_index
  ON admin_sessions (session_token_hash, expires_at)
  WHERE revoked_at IS NULL;
