CREATE TABLE webauthn_credentials (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, credential_id TEXT NOT NULL UNIQUE, public_key TEXT NOT NULL, alg INTEGER NOT NULL, sign_count INTEGER NOT NULL DEFAULT 0, transports TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT 'Passkey', aaguid TEXT NOT NULL DEFAULT '', user_handle TEXT NOT NULL DEFAULT '', last_used_at INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX webauthn_credential_user ON webauthn_credentials(user_id);
CREATE TABLE webauthn_challenges (challenge TEXT PRIMARY KEY, flow TEXT NOT NULL CHECK(flow IN ('register','login','manage')), user_id TEXT, payload TEXT NOT NULL DEFAULT '', expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX webauthn_challenge_expiry ON webauthn_challenges(expires_at);
ALTER TABLE credentials ADD COLUMN auth_method TEXT;
