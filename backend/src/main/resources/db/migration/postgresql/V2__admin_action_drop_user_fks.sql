-- admin_action is an audit trail: a row recording DELETE_USER must keep the deleted
-- user's id, which ON DELETE SET NULL (V1) would have wiped. The columns stay as plain
-- historical ids with no referential integrity. Names are Postgres' defaults for the
-- inline REFERENCES clauses in V1.
ALTER TABLE admin_action DROP CONSTRAINT IF EXISTS admin_action_admin_user_id_fkey;
ALTER TABLE admin_action DROP CONSTRAINT IF EXISTS admin_action_target_user_id_fkey;
