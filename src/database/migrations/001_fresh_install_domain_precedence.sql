-- NationX compatibility migration 001
-- Fresh-install domain precedence
--
-- schema_full.sql is the authoritative core dump. Its agriculture tables are
-- older, smaller definitions. agriculture_schema.sql is the later domain
-- schema used by the active agriculture routes, but its CREATE IF NOT EXISTS
-- statements cannot replace the core versions. The allowlisted installer runs
-- this migration after schema_full.sql and before agriculture_schema.sql.
-- Destructive statements are therefore limited to a newly created NationX DB.

DROP TABLE IF EXISTS agri_crop_reports;
DROP TABLE IF EXISTS agri_subsidies;

CREATE TABLE IF NOT EXISTS nationx_schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO nationx_schema_migrations (version, description)
VALUES ('001', 'Allow the later agriculture domain schema to replace stale core definitions');
