-- Add mustChangePassword to admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Login attempts table (for rate limiting persistence across restarts — optional but good)
CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  blocked_until TIMESTAMPTZ,
  last_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS login_attempts_identifier_idx ON login_attempts(identifier);
