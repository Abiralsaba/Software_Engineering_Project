-- NationX compatibility migration 000
-- Core dump installability marker.
--
-- schema_full.sql contains a stale water_issues placeholder whose AUTO_INCREMENT
-- id is not declared as a key, which MySQL/MariaDB refuses to create. The
-- allowlisted installer applies one exact, fail-closed in-memory transform that
-- adds PRIMARY KEY (id). water_schema.sql later drops this placeholder and
-- installs the authoritative water domain tables, so no water business meaning
-- is changed. The original dump remains untouched.

CREATE TABLE IF NOT EXISTS nationx_schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO nationx_schema_migrations (version, description)
VALUES ('000', 'Make the stale core water placeholder structurally installable before domain replacement');
