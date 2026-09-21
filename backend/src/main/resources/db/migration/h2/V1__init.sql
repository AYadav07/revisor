-- H2 copy of postgresql/V1__init.sql for the local profile (manual dev runs only —
-- automated repository/integration tests still use Testcontainers + real Postgres
-- per ARCHITECTURE.md §10). Only difference from the Postgres version: TIMESTAMPTZ
-- spelled out as TIMESTAMP WITH TIME ZONE, which H2 doesn't alias. Everything else
-- (BIGSERIAL, UUID, NUMERIC precision, CHECK, ON DELETE SET NULL) is supported as-is
-- under H2's MODE=PostgreSQL compatibility mode — keep both files in sync by hand.

-- app_user (named app_user, not "user" — reserved word in Postgres)
CREATE TABLE app_user (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL,
    enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    timezone      VARCHAR(64)  NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_app_user_email UNIQUE (email)
);

CREATE TABLE course (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE INDEX idx_course_user_id_id ON course (user_id, id);

CREATE TABLE topic (
    id          BIGSERIAL PRIMARY KEY,
    course_id   BIGINT       NOT NULL REFERENCES course (id) ON DELETE CASCADE,
    user_id     BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    order_index INTEGER      NOT NULL,
    deleted_at  TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_topic_user_id_id ON topic (user_id, id);
CREATE INDEX idx_topic_course_id ON topic (course_id);
CREATE INDEX idx_topic_deleted_at ON topic (deleted_at);

CREATE TABLE subtopic (
    id         BIGSERIAL PRIMARY KEY,
    topic_id   BIGINT       NOT NULL REFERENCES topic (id) ON DELETE CASCADE,
    user_id    BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL,
    notes      TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_subtopic_user_id_id ON subtopic (user_id, id);
CREATE INDEX idx_subtopic_topic_id ON subtopic (topic_id);
CREATE INDEX idx_subtopic_deleted_at ON subtopic (deleted_at);

CREATE TABLE learning_record (
    id          BIGSERIAL PRIMARY KEY,
    subtopic_id BIGINT      NOT NULL REFERENCES subtopic (id) ON DELETE CASCADE,
    user_id     BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    learned_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_learning_record_subtopic_id UNIQUE (subtopic_id)
);

CREATE INDEX idx_learning_record_user_id_id ON learning_record (user_id, id);

CREATE TABLE review_log (
    id               BIGSERIAL PRIMARY KEY,
    subtopic_id      BIGINT      NOT NULL REFERENCES subtopic (id) ON DELETE CASCADE,
    user_id          BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    reviewed_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    quality          INTEGER     NOT NULL,
    ease_factor      NUMERIC(4, 2) NOT NULL,
    interval_days    INTEGER     NOT NULL,
    repetition_count INTEGER     NOT NULL,
    CONSTRAINT chk_review_log_quality CHECK (quality BETWEEN 0 AND 5)
);

CREATE INDEX idx_review_log_user_id_id ON review_log (user_id, id);
CREATE INDEX idx_review_log_subtopic_id ON review_log (subtopic_id);

CREATE TABLE schedule_entry (
    id                BIGSERIAL PRIMARY KEY,
    subtopic_id       BIGINT NOT NULL REFERENCES subtopic (id) ON DELETE CASCADE,
    user_id           BIGINT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    next_review_date  DATE   NOT NULL,
    CONSTRAINT uq_schedule_entry_subtopic_id UNIQUE (subtopic_id)
);

CREATE INDEX idx_schedule_entry_user_id_id ON schedule_entry (user_id, id);
CREATE INDEX idx_schedule_entry_user_id_next_review_date ON schedule_entry (user_id, next_review_date);

CREATE TABLE refresh_token (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    family_id  UUID        NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_refresh_token_token_hash UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_token_user_id_id ON refresh_token (user_id, id);
CREATE INDEX idx_refresh_token_family_id ON refresh_token (family_id);

-- admin_user_id/target_user_id are nullable with ON DELETE SET NULL: an admin action
-- log entry must survive a later hard-delete of either user (see ARCHITECTURE.md §7 —
-- admin hard-delete cascades course/review data but AdminAction rows are the audit
-- trail and are not listed among the cascaded tables).
CREATE TABLE admin_action (
    id             BIGSERIAL PRIMARY KEY,
    admin_user_id  BIGINT REFERENCES app_user (id) ON DELETE SET NULL,
    action         VARCHAR(100) NOT NULL,
    target_user_id BIGINT REFERENCES app_user (id) ON DELETE SET NULL,
    timestamp      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_action_admin_user_id ON admin_action (admin_user_id);
CREATE INDEX idx_admin_action_target_user_id ON admin_action (target_user_id);
