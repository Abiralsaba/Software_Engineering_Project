-- NationX role-based administration: platform, central domain and divisional scope.

CREATE TABLE IF NOT EXISTS admin_service_domains (
    code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    name_bn VARCHAR(160) NOT NULL,
    parent_authority VARCHAR(200) NOT NULL,
    icon VARCHAR(40) NOT NULL DEFAULT 'fa-building-columns',
    supports_division_scope TINYINT(1) NOT NULL DEFAULT 1,
    sort_order SMALLINT NOT NULL DEFAULT 100,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_service_domains
    (code, name, name_bn, parent_authority, icon, sort_order)
VALUES
    ('nid', 'National Identity Services', 'জাতীয় পরিচয় সেবা', 'Bangladesh Election Commission', 'fa-id-card', 10),
    ('passport', 'Passport Services', 'পাসপোর্ট সেবা', 'Department of Immigration and Passports · Ministry of Home Affairs', 'fa-passport', 20),
    ('health', 'Health Services', 'স্বাস্থ্য সেবা', 'Ministry of Health and Family Welfare', 'fa-heart-pulse', 30),
    ('water', 'Water Services', 'পানি সেবা', 'Ministry of Water Resources', 'fa-droplet', 40),
    ('land', 'Land Services', 'ভূমি সেবা', 'Ministry of Land', 'fa-map-location-dot', 50),
    ('agriculture', 'Agriculture Services', 'কৃষি সেবা', 'Ministry of Agriculture', 'fa-seedling', 60),
    ('tax', 'Revenue and Tax Services', 'রাজস্ব ও কর সেবা', 'National Board of Revenue · Internal Resources Division', 'fa-file-invoice-dollar', 70),
    ('education', 'Education and Student Services', 'শিক্ষা ও শিক্ষার্থী সেবা', 'Ministry of Education', 'fa-graduation-cap', 80),
    ('community', 'Community Services', 'কমিউনিটি সেবা', 'Local Government Division', 'fa-people-group', 90),
    ('commerce', 'Commerce and Marketplace', 'বাণিজ্য ও মার্কেটপ্লেস', 'Ministry of Commerce', 'fa-store', 100)
ON DUPLICATE KEY UPDATE
    name = VALUES(name), name_bn = VALUES(name_bn),
    parent_authority = VALUES(parent_authority), icon = VALUES(icon),
    sort_order = VALUES(sort_order), is_active = 1;

ALTER TABLE admin_service_domains
    ADD COLUMN IF NOT EXISTS supports_division_scope TINYINT(1) NOT NULL DEFAULT 1 AFTER icon;

UPDATE admin_service_domains SET supports_division_scope = 0 WHERE code IN ('community', 'commerce');

ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS requested_domain_code VARCHAR(32) NULL AFTER nid,
    ADD COLUMN IF NOT EXISTS requested_scope_level ENUM('central','division') NULL AFTER requested_domain_code,
    ADD COLUMN IF NOT EXISTS requested_division_id INT NULL AFTER requested_scope_level,
    ADD COLUMN IF NOT EXISTS access_request_note VARCHAR(500) NULL AFTER requested_division_id;

CREATE TABLE IF NOT EXISTS admin_role_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    role_type ENUM('SUPER_ADMIN','DOMAIN_ADMIN','DIVISION_ADMIN') NOT NULL,
    domain_code VARCHAR(32) NULL,
    division_id INT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    assigned_by INT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_admin_role_assignment (admin_id),
    KEY idx_admin_scope (role_type, domain_code, division_id, is_active),
    CONSTRAINT fk_admin_role_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    CONSTRAINT fk_admin_role_domain FOREIGN KEY (domain_code) REFERENCES admin_service_domains(code),
    CONSTRAINT fk_admin_role_division FOREIGN KEY (division_id) REFERENCES divisions(id),
    CONSTRAINT fk_admin_role_assigner FOREIGN KEY (assigned_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_access_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_admin_id INT NOT NULL,
    target_admin_id INT NOT NULL,
    action_type ENUM('APPROVE','REJECT','ASSIGN','CHANGE_SCOPE','SUSPEND') NOT NULL,
    previous_access JSON NULL,
    new_access JSON NULL,
    note VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_access_audit_actor (actor_admin_id, created_at),
    KEY idx_access_audit_target (target_admin_id, created_at),
    CONSTRAINT fk_access_audit_actor FOREIGN KEY (actor_admin_id) REFERENCES admins(id),
    CONSTRAINT fk_access_audit_target FOREIGN KEY (target_admin_id) REFERENCES admins(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve access to an existing installation: the earliest approved administrator
-- becomes the first platform super administrator. Every later assignment is explicit.
INSERT INTO admin_role_assignments (admin_id, role_type, domain_code, division_id, assigned_by)
SELECT a.id, 'SUPER_ADMIN', NULL, NULL, NULL
FROM admins a
WHERE a.status = 'approved'
  AND NOT EXISTS (SELECT 1 FROM admin_role_assignments)
ORDER BY a.id
LIMIT 1;

INSERT INTO nationx_schema_migrations (version, description)
VALUES ('009', 'Role-based ministry and divisional admin scopes')
ON DUPLICATE KEY UPDATE description = VALUES(description), applied_at = CURRENT_TIMESTAMP;
