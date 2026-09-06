-- NationX compatibility migration 005
-- Environment-specific routine deferral.
--
-- Applied only when the running MariaDB reports an incompatible mysql.proc
-- system-table layout. Active application code has no CALL statements. Tables,
-- views, triggers, and API contracts continue to install, while unused stored
-- routines remain explicitly unavailable until the host owner authorizes and
-- performs the system-table upgrade outside the NationX databases.

CREATE TABLE IF NOT EXISTS nationx_installation_limitations (
    limitation_code VARCHAR(100) PRIMARY KEY,
    description TEXT NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO nationx_installation_limitations (limitation_code, description)
VALUES (
    'ROUTINES_DEFERRED_MYSQL_PROC',
    'Stored routines were not installed because the MariaDB mysql.proc system table is incompatible with the running server. Active code contains no CALL statements.'
);

INSERT INTO nationx_schema_migrations (version, description)
VALUES ('005', 'Record environment-required deferral of unused stored routines');
