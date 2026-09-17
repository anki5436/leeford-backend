CREATE TABLE password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX password_reset_tokens_user_index
  ON password_reset_tokens (admin_user_id);
CREATE INDEX password_reset_tokens_active_index
  ON password_reset_tokens (token_hash, expires_at)
  WHERE used_at IS NULL;
