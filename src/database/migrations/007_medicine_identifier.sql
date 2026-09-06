-- NationX Medicine Identifier scan history.
-- Raw images are never stored. Existing medicine catalogue/application tables are not altered.

CREATE TABLE IF NOT EXISTS medicine_scan_sessions (
    scan_id CHAR(36) PRIMARY KEY,
    user_id INT NOT NULL,
    scan_mode ENUM('prescription','package') NOT NULL,
    status ENUM('PROCESSING','RETAKE_REQUIRED','WAITING_CONFIRMATION','CONFIRMED','NO_MATCH','FAILED') NOT NULL,
    provider_name VARCHAR(40) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    schema_version VARCHAR(80) NOT NULL,
    image_count TINYINT UNSIGNED NOT NULL,
    image_hashes JSON NOT NULL,
    image_metadata JSON NOT NULL,
    consented_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_medicine_scan_owner_created (user_id, created_at),
    KEY idx_medicine_scan_status (status),
    CONSTRAINT fk_medicine_scan_user FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_scan_items (
    item_id CHAR(36) PRIMARY KEY,
    scan_id CHAR(36) NOT NULL,
    item_index SMALLINT UNSIGNED NOT NULL,
    raw_visible_text TEXT NOT NULL,
    structured_extraction JSON NOT NULL,
    user_corrections JSON NULL,
    brand_candidate VARCHAR(255) NULL,
    generic_candidate VARCHAR(500) NULL,
    strength_candidate VARCHAR(255) NULL,
    dosage_form_candidate VARCHAR(150) NULL,
    manufacturer_candidate VARCHAR(255) NULL,
    registration_candidate VARCHAR(100) NULL,
    uncertain_fields JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_medicine_scan_item_order (scan_id, item_index),
    KEY idx_medicine_scan_item_scan (scan_id),
    CONSTRAINT fk_medicine_scan_item_session FOREIGN KEY (scan_id) REFERENCES medicine_scan_sessions(scan_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_scan_candidates (
    candidate_id CHAR(36) PRIMARY KEY,
    item_id CHAR(36) NOT NULL,
    medicine_id VARCHAR(40) NOT NULL,
    candidate_rank TINYINT UNSIGNED NOT NULL,
    match_score DECIMAL(10,4) NOT NULL,
    matching_evidence JSON NOT NULL,
    conflicts_or_missing JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_medicine_scan_candidate (item_id, medicine_id),
    KEY idx_medicine_scan_candidate_rank (item_id, candidate_rank),
    CONSTRAINT fk_medicine_scan_candidate_item FOREIGN KEY (item_id) REFERENCES medicine_scan_items(item_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_scan_candidate_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_scan_confirmations (
    confirmation_id CHAR(36) PRIMARY KEY,
    item_id CHAR(36) NOT NULL,
    selection_type ENUM('CATALOGUE','NONE','MANUAL') NOT NULL,
    medicine_id VARCHAR(40) NULL,
    manual_label VARCHAR(500) NULL,
    user_corrections JSON NULL,
    confirmed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_medicine_scan_confirmation_item (item_id),
    KEY idx_medicine_confirmation_medicine (medicine_id),
    CONSTRAINT fk_medicine_scan_confirmation_item FOREIGN KEY (item_id) REFERENCES medicine_scan_items(item_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_scan_confirmation_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_savings_estimates (
    savings_estimate_id CHAR(36) PRIMARY KEY,
    item_id CHAR(36) NOT NULL,
    original_medicine_id VARCHAR(40) NOT NULL,
    alternative_medicine_id VARCHAR(40) NOT NULL,
    required_quantity DECIMAL(24,9) NULL,
    original_package_selection JSON NULL,
    alternative_package_selection JSON NULL,
    original_estimated_cost DECIMAL(14,4) NULL,
    alternative_estimated_cost DECIMAL(14,4) NULL,
    estimated_saving DECIMAL(14,4) NULL,
    currency CHAR(3) NULL,
    comparison_evidence JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_medicine_savings_item_alternative (item_id, alternative_medicine_id),
    KEY idx_medicine_savings_item (item_id),
    CONSTRAINT fk_medicine_savings_item FOREIGN KEY (item_id) REFERENCES medicine_scan_items(item_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_savings_original FOREIGN KEY (original_medicine_id) REFERENCES medicines(medicine_id),
    CONSTRAINT fk_medicine_savings_alternative FOREIGN KEY (alternative_medicine_id) REFERENCES medicines(medicine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
