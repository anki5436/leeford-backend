CREATE TABLE roles (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (name, description)
VALUES ('SUPER_ADMIN', 'Full administrative access to the Leeford Healthcare Admin Portal')
ON CONFLICT (name) DO NOTHING;
