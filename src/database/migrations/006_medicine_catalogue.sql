-- NationX medicine catalogue schema (isolated, batch-provenanced tables only).
-- Applied by scripts/medicine/import.js after an explicit DATABASE() guard.

CREATE TABLE IF NOT EXISTS medicine_import_batches (
    import_batch_id VARCHAR(40) PRIMARY KEY,
    pipeline_version VARCHAR(80) NOT NULL,
    market_sha256 CHAR(64) NOT NULL,
    registered_sha256 CHAR(64) NOT NULL,
    manifest_sha256 CHAR(64) NOT NULL,
    status ENUM('IMPORTING','VERIFIED','ROLLED_BACK','FAILED') NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP NULL,
    UNIQUE KEY uq_medicine_batch_inputs (pipeline_version, market_sha256, registered_sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_source_files (
    source_file_id VARCHAR(20) NOT NULL,
    import_batch_id VARCHAR(40) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    sha256 CHAR(64) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    source_format VARCHAR(30) NOT NULL,
    source_encoding VARCHAR(30) NOT NULL,
    data_row_count INT UNSIGNED NOT NULL,
    dataset_version VARCHAR(80) NOT NULL,
    source_verified TINYINT(1) NOT NULL DEFAULT 0,
    licence_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',
    imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (source_file_id, import_batch_id),
    CONSTRAINT fk_medicine_source_file_batch FOREIGN KEY (import_batch_id)
        REFERENCES medicine_import_batches(import_batch_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_source_records (
    source_record_id VARCHAR(40) PRIMARY KEY,
    source_file_id VARCHAR(20) NOT NULL,
    import_batch_id VARCHAR(40) NOT NULL,
    source_row_number INT UNSIGNED NOT NULL,
    source_record_key VARCHAR(100) NOT NULL,
    row_sha256 CHAR(64) NOT NULL,
    cell_types TEXT NOT NULL,
    outcome ENUM('MATCHED','UNMATCHED_VALID','POSSIBLE_DUPLICATE','CONFLICT','INVALID','REQUIRES_REVIEW') NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_medicine_source_row (source_file_id, import_batch_id, source_row_number),
    KEY idx_medicine_source_outcome (outcome),
    CONSTRAINT fk_medicine_source_record_file FOREIGN KEY (source_file_id, import_batch_id)
        REFERENCES medicine_source_files(source_file_id, import_batch_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_market_raw (
    source_record_id VARCHAR(40) PRIMARY KEY,
    brand_id_original TEXT NOT NULL,
    brand_name_original TEXT NOT NULL,
    medicine_type_original TEXT NOT NULL,
    slug_original TEXT NOT NULL,
    dosage_form_original TEXT NOT NULL,
    generic_original TEXT NOT NULL,
    strength_original TEXT NOT NULL,
    manufacturer_original TEXT NOT NULL,
    package_container_original TEXT NOT NULL,
    package_size_original TEXT NOT NULL,
    CONSTRAINT fk_medicine_market_raw_source FOREIGN KEY (source_record_id)
        REFERENCES medicine_source_records(source_record_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registered_drug_raw (
    source_record_id VARCHAR(40) PRIMARY KEY,
    sl_original TEXT NOT NULL,
    pharmaceutical_original TEXT NOT NULL,
    name_original TEXT NOT NULL,
    generic_name_original TEXT NOT NULL,
    strength_original TEXT NOT NULL,
    dosages_original TEXT NOT NULL,
    price_original TEXT NOT NULL,
    use_for_original TEXT NOT NULL,
    dar_original TEXT NOT NULL,
    CONSTRAINT fk_registered_drug_raw_source FOREIGN KEY (source_record_id)
        REFERENCES medicine_source_records(source_record_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_manufacturers (
    manufacturer_id VARCHAR(40) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    source_verified TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_medicine_manufacturer_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_dosage_forms (
    dosage_form_id VARCHAR(40) PRIMARY KEY,
    display_name VARCHAR(150) NOT NULL,
    normalized_name VARCHAR(150) NOT NULL,
    UNIQUE KEY uq_medicine_dosage_form_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_ingredients (
    ingredient_id VARCHAR(40) PRIMARY KEY,
    display_name VARCHAR(500) NOT NULL,
    normalized_name VARCHAR(500) NOT NULL,
    KEY idx_medicine_ingredient_normalized (normalized_name(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicines (
    medicine_id VARCHAR(40) PRIMARY KEY,
    import_batch_id VARCHAR(40) NOT NULL,
    manufacturer_id VARCHAR(40) NOT NULL,
    dosage_form_id VARCHAR(40) NOT NULL,
    brand_name VARCHAR(255) NOT NULL,
    brand_normalized VARCHAR(255) NOT NULL,
    generic_original TEXT NOT NULL,
    generic_signature TEXT NOT NULL,
    strength_original VARCHAR(500) NOT NULL,
    strength_signature VARCHAR(500) NOT NULL,
    release_type VARCHAR(100) NULL,
    medicine_type VARCHAR(30) NOT NULL,
    intended_use VARCHAR(30) NOT NULL,
    tier ENUM('A','B','C') NOT NULL,
    catalogue_status ENUM('STRUCTURED_MATCHED','IDENTIFICATION_ONLY','QUARANTINED') NOT NULL,
    reason_codes TEXT NOT NULL,
    identification_eligible TINYINT(1) NOT NULL DEFAULT 0,
    structured_comparison_eligible TINYINT(1) NOT NULL DEFAULT 0,
    price_comparison_eligible TINYINT(1) NOT NULL DEFAULT 0,
    savings_calculation_eligible TINYINT(1) NOT NULL DEFAULT 0,
    requires_professional_confirmation TINYINT(1) NOT NULL DEFAULT 1,
    source_verified TINYINT(1) NOT NULL DEFAULT 0,
    regulatory_verified TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_medicines_brand_normalized (brand_normalized),
    KEY idx_medicines_manufacturer (manufacturer_id),
    KEY idx_medicines_tier_eligibility (tier, structured_comparison_eligible, savings_calculation_eligible),
    CONSTRAINT fk_medicines_batch FOREIGN KEY (import_batch_id)
        REFERENCES medicine_import_batches(import_batch_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicines_manufacturer FOREIGN KEY (manufacturer_id)
        REFERENCES medicine_manufacturers(manufacturer_id),
    CONSTRAINT fk_medicines_dosage_form FOREIGN KEY (dosage_form_id)
        REFERENCES medicine_dosage_forms(dosage_form_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_manufacturer_aliases (
    manufacturer_alias_id VARCHAR(40) PRIMARY KEY,
    manufacturer_id VARCHAR(40) NOT NULL,
    alias_original VARCHAR(255) NOT NULL,
    alias_normalized VARCHAR(255) NOT NULL,
    source_record_id VARCHAR(40) NOT NULL,
    match_method VARCHAR(50) NOT NULL,
    KEY idx_medicine_manufacturer_alias (alias_normalized),
    CONSTRAINT fk_medicine_alias_manufacturer FOREIGN KEY (manufacturer_id)
        REFERENCES medicine_manufacturers(manufacturer_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_alias_source FOREIGN KEY (source_record_id)
        REFERENCES medicine_source_records(source_record_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_product_ingredients (
    medicine_ingredient_id VARCHAR(40) PRIMARY KEY,
    medicine_id VARCHAR(40) NOT NULL,
    ingredient_id VARCHAR(40) NOT NULL,
    ingredient_order SMALLINT UNSIGNED NOT NULL,
    strength_value DECIMAL(24,9) NULL,
    strength_unit VARCHAR(40) NULL,
    denominator_value DECIMAL(24,9) NULL,
    denominator_unit VARCHAR(50) NULL,
    strength_original VARCHAR(500) NULL,
    parse_status ENUM('PARSED','FAILED','AMBIGUOUS') NOT NULL,
    parse_reason VARCHAR(100) NULL,
    UNIQUE KEY uq_medicine_ingredient_order (medicine_id, ingredient_order),
    KEY idx_product_ingredient (ingredient_id, medicine_id),
    CONSTRAINT fk_product_ingredient_medicine FOREIGN KEY (medicine_id)
        REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    CONSTRAINT fk_product_ingredient_ingredient FOREIGN KEY (ingredient_id)
        REFERENCES medicine_ingredients(ingredient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_packages (
    package_id VARCHAR(40) PRIMARY KEY,
    medicine_id VARCHAR(40) NOT NULL,
    container_type VARCHAR(100) NULL,
    package_quantity DECIMAL(24,9) NULL,
    package_unit VARCHAR(50) NULL,
    units_per_package DECIMAL(24,9) NULL,
    package_original TEXT NOT NULL,
    source_record_id VARCHAR(40) NOT NULL,
    parse_status ENUM('PARSED','UNRESOLVED','MISSING') NOT NULL,
    parse_reason VARCHAR(100) NULL,
    KEY idx_medicine_packages_medicine (medicine_id),
    CONSTRAINT fk_medicine_package_medicine FOREIGN KEY (medicine_id)
        REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_package_source FOREIGN KEY (source_record_id)
        REFERENCES medicine_source_records(source_record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_prices (
    price_id VARCHAR(40) PRIMARY KEY,
    medicine_id VARCHAR(40) NOT NULL,
    package_id VARCHAR(40) NULL,
    amount DECIMAL(14,4) NULL,
    currency CHAR(3) NULL,
    price_basis VARCHAR(30) NOT NULL,
    price_original TEXT NOT NULL,
    source_record_id VARCHAR(40) NOT NULL,
    price_source VARCHAR(40) NOT NULL,
    price_status VARCHAR(40) NOT NULL,
    price_basis_verified TINYINT(1) NOT NULL DEFAULT 0,
    price_current_verified TINYINT(1) NOT NULL DEFAULT 0,
    price_comparison_eligible TINYINT(1) NOT NULL DEFAULT 0,
    savings_calculation_eligible TINYINT(1) NOT NULL DEFAULT 0,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_medicine_prices_medicine (medicine_id, savings_calculation_eligible, amount),
    CONSTRAINT fk_medicine_price_medicine FOREIGN KEY (medicine_id)
        REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_price_package FOREIGN KEY (package_id)
        REFERENCES medicine_packages(package_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_price_source FOREIGN KEY (source_record_id)
        REFERENCES medicine_source_records(source_record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_registrations (
    registration_id VARCHAR(40) PRIMARY KEY,
    medicine_id VARCHAR(40) NOT NULL,
    registration_reference VARCHAR(100) NOT NULL,
    registration_kind VARCHAR(50) NOT NULL,
    source_record_id VARCHAR(40) NOT NULL,
    format_status VARCHAR(40) NOT NULL,
    source_verified TINYINT(1) NOT NULL DEFAULT 0,
    regulatory_verified TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_medicine_registration_reference (registration_reference),
    KEY idx_medicine_registration_medicine (medicine_id),
    CONSTRAINT fk_medicine_registration_medicine FOREIGN KEY (medicine_id)
        REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_registration_source FOREIGN KEY (source_record_id)
        REFERENCES medicine_source_records(source_record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_source_links (
    source_link_id VARCHAR(40) PRIMARY KEY,
    medicine_id VARCHAR(40) NULL,
    source_record_id VARCHAR(40) NOT NULL,
    source_name VARCHAR(20) NOT NULL,
    source_row_number INT UNSIGNED NOT NULL,
    source_record_key VARCHAR(100) NOT NULL,
    outcome VARCHAR(30) NOT NULL,
    match_method VARCHAR(50) NOT NULL,
    reason_codes TEXT NOT NULL,
    UNIQUE KEY uq_medicine_source_link_record (source_record_id),
    KEY idx_medicine_source_link_medicine (medicine_id),
    CONSTRAINT fk_medicine_source_link_medicine FOREIGN KEY (medicine_id)
        REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_source_link_record FOREIGN KEY (source_record_id)
        REFERENCES medicine_source_records(source_record_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_field_provenance (
    field_provenance_id VARCHAR(40) PRIMARY KEY,
    medicine_id VARCHAR(40) NOT NULL,
    field_name VARCHAR(80) NOT NULL,
    source_record_id VARCHAR(40) NOT NULL,
    original_value TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    authority_decision VARCHAR(50) NOT NULL,
    KEY idx_medicine_field_provenance (medicine_id, field_name),
    CONSTRAINT fk_medicine_field_medicine FOREIGN KEY (medicine_id)
        REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_field_source FOREIGN KEY (source_record_id)
        REFERENCES medicine_source_records(source_record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_reason_codes (
    reason_code VARCHAR(100) PRIMARY KEY,
    description VARCHAR(500) NOT NULL,
    severity ENUM('INFO','REVIEW','CRITICAL') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_classification_reasons (
    medicine_id VARCHAR(40) NOT NULL,
    reason_code VARCHAR(100) NOT NULL,
    PRIMARY KEY (medicine_id, reason_code),
    CONSTRAINT fk_medicine_classification_medicine FOREIGN KEY (medicine_id)
        REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_classification_reason FOREIGN KEY (reason_code)
        REFERENCES medicine_reason_codes(reason_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_conflicts (
    conflict_id VARCHAR(40) PRIMARY KEY,
    medicine_id VARCHAR(40) NOT NULL,
    conflict_type VARCHAR(100) NOT NULL,
    source_record_ids TEXT NOT NULL,
    details TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    KEY idx_medicine_conflict_type (conflict_type, status),
    CONSTRAINT fk_medicine_conflict_medicine FOREIGN KEY (medicine_id)
        REFERENCES medicines(medicine_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_possible_duplicates (
    possible_duplicate_id VARCHAR(40) PRIMARY KEY,
    left_medicine_id VARCHAR(40) NOT NULL,
    right_medicine_id VARCHAR(40) NOT NULL,
    matching_fields TEXT NOT NULL,
    conflicting_fields TEXT NOT NULL,
    similarity_evidence DECIMAL(6,4) NOT NULL,
    reason_code VARCHAR(100) NOT NULL,
    review_priority VARCHAR(20) NOT NULL,
    final_status VARCHAR(30) NOT NULL,
    CONSTRAINT fk_possible_duplicate_left FOREIGN KEY (left_medicine_id)
        REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    CONSTRAINT fk_possible_duplicate_right FOREIGN KEY (right_medicine_id)
        REFERENCES medicines(medicine_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
