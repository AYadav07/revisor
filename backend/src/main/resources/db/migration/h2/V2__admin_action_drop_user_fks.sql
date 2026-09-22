-- H2 copy of postgresql/V2: drop the admin_action -> app_user foreign keys so audit rows
-- keep the deleted user's id. H2 auto-generates unpredictable names for V1's inline
-- foreign keys, so the table is recreated instead of altered — safe because the local
-- profile's database is in-memory and empty at this point.
--
-- `timestamp` is deliberately unquoted (unlike the Postgres files): Hibernate emits it unquoted,
-- and H2 upper-cases unquoted names but keeps a quoted one's exact case, so a quoted
-- lowercase column is invisible to Hibernate's queries.
DROP TABLE admin_action;

CREATE TABLE admin_action (
    id             BIGSERIAL PRIMARY KEY,
    admin_user_id  BIGINT,
    action         VARCHAR(100) NOT NULL,
    target_user_id BIGINT,
    timestamp      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_action_admin_user_id ON admin_action (admin_user_id);
CREATE INDEX idx_admin_action_target_user_id ON admin_action (target_user_id);
