-- Separate applicant identities: reg_info and its existing NID relationships stay unchanged.
-- No USE, cross-schema SQL, destructive statements, routines or trigger side effects.
-- A NationX demonstration application is NOT government NID issuance.
CREATE TABLE IF NOT EXISTS nid_applicant_accounts (
 id CHAR(36) PRIMARY KEY,
 name VARCHAR(200) NOT NULL,
 email VARCHAR(200) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 mobile VARCHAR(15) NOT NULL,
 contact_verified_at DATETIME NULL,
 contact_mode VARCHAR(30) NOT NULL DEFAULT 'DEMO',
 verification_hash CHAR(64) NULL,
 verification_expires DATETIME NULL,
 verification_attempts INT NOT NULL DEFAULT 0,
 identity_state VARCHAR(40) NOT NULL DEFAULT 'NID_APPLICANT',
 active TINYINT NOT NULL DEFAULT 1,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing nid_applications requires reg_info.id. Reusing it would conflate identities.
-- One application per applicant in this MVP; rejected/cancelled reapplications are deferred.
CREATE TABLE IF NOT EXISTS nid_first_time_applications (
 id CHAR(36) PRIMARY KEY,
 applicant_id CHAR(36) NOT NULL UNIQUE,
 status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
 version INT NOT NULL DEFAULT 1,
 fields_json JSON NOT NULL,
 tracking_number VARCHAR(50) NULL UNIQUE,
 submitted_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (applicant_id) REFERENCES nid_applicant_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Private authenticated downloads only. No public upload paths or arbitrary filenames.
CREATE TABLE IF NOT EXISTS nid_application_documents (
 id CHAR(36) PRIMARY KEY,
 application_id CHAR(36) NOT NULL,
 kind VARCHAR(40) NOT NULL,
 mime_type VARCHAR(40) NOT NULL,
 content MEDIUMBLOB NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY application_kind (application_id,kind),
 FOREIGN KEY (application_id) REFERENCES nid_first_time_applications(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nid_application_status_history (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 application_id CHAR(36) NOT NULL,
 from_status VARCHAR(40) NULL,
 to_status VARCHAR(40) NOT NULL,
 actor_type VARCHAR(20) NOT NULL,
 actor_id VARCHAR(36) NOT NULL,
 remarks VARCHAR(1000) NOT NULL DEFAULT '',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (application_id) REFERENCES nid_first_time_applications(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assistant_sessions (
 id CHAR(36) PRIMARY KEY,
 applicant_id CHAR(36) NULL,
 citizen_id INT NULL,
 state VARCHAR(40) NOT NULL DEFAULT 'NEW',
 intent VARCHAR(40) NOT NULL DEFAULT 'UNKNOWN',
 application_id CHAR(36) NULL,
 expires_at DATETIME NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ((applicant_id IS NULL) <> (citizen_id IS NULL)),
 FOREIGN KEY (applicant_id) REFERENCES nid_applicant_accounts(id),
 FOREIGN KEY (citizen_id) REFERENCES reg_info(id),
 FOREIGN KEY (application_id) REFERENCES nid_first_time_applications(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The application is the authoritative draft; no duplicate assistant draft copy.
CREATE TABLE IF NOT EXISTS assistant_confirmations (
 id CHAR(36) PRIMARY KEY,
 application_id CHAR(36) NOT NULL,
 draft_version INT NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE,
 expires_at DATETIME NOT NULL,
 consumed_at DATETIME NULL,
 FOREIGN KEY (application_id) REFERENCES nid_first_time_applications(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assistant_events (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 session_id CHAR(36) NOT NULL,
 event_code VARCHAR(50) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (session_id) REFERENCES assistant_sessions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
