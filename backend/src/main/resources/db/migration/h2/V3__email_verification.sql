-- H2 copy of postgresql/V3 (same schema; TIMESTAMP WITH TIME ZONE for TIMESTAMPTZ).
--
-- Email verification and password reset (SECURITY.md "Email verification & password reset").
-- email_verified_at: NULL means unverified; unverified users cannot log in. Accounts that
-- existed before this migration are backfilled as verified, so nobody is locked out.
ALTER TABLE app_user ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE;
UPDATE app_user SET email_verified_at = created_at;

-- One table for both purposes. Only the SHA-256 hash of the emailed token is stored.
-- Rows go with their user on the admin hard-delete (ON DELETE CASCADE).
CREATE TABLE email_token (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    purpose    VARCHAR(20)  NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at    TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_email_token_token_hash UNIQUE (token_hash)
);

-- Invalidating a user's older unused tokens when a new one is issued.
CREATE INDEX idx_email_token_user_id_purpose ON email_token (user_id, purpose);
