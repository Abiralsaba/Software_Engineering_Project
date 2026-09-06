-- ==========================================
-- NORMALIZED SCHEMA ENHANCEMENTS (3NF)
-- Central Government System
-- ==========================================

-- ADDRESS NORMALIZATION

-- Address Types (Lookup table - 1NF, 2NF, 3NF compliant)
CREATE TABLE IF NOT EXISTS address_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) UNIQUE NOT NULL COMMENT 'Permanent, Present, Office, etc.'
);

-- Insert default address types
INSERT IGNORE INTO address_types (type_name) VALUES 
('Permanent'), ('Present'), ('Office'), ('Emergency');

-- Normalized Addresses Table
CREATE TABLE IF NOT EXISTS addresses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    address_type_id INT NOT NULL,
    division_id INT,
    district_id INT,
    upazila_id INT,
    village_area VARCHAR(255),
    post_office VARCHAR(100),
    post_code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    FOREIGN KEY (address_type_id) REFERENCES address_types(id),
    FOREIGN KEY (division_id) REFERENCES divisions(id),
    FOREIGN KEY (district_id) REFERENCES districts(id),
    FOREIGN KEY (upazila_id) REFERENCES upazilas(id),
    UNIQUE KEY unique_user_address_type (user_id, address_type_id)
);

-- DOCUMENT STATUS NORMALIZATION

-- Document Statuses (Eliminates repeated ENUMs across tables)
CREATE TABLE IF NOT EXISTS document_statuses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    status_name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    color_code VARCHAR(7) DEFAULT '#6B7280' COMMENT 'Hex color for UI display'
);

-- Insert default statuses
INSERT IGNORE INTO document_statuses (status_name, description, color_code) VALUES 
('Pending', 'Awaiting review', '#F59E0B'),
('Approved', 'Successfully approved', '#10B981'),
('Rejected', 'Application rejected', '#EF4444'),
('Expired', 'Document has expired', '#6B7280'),
('Processing', 'Under processing', '#3B82F6'),
('Cancelled', 'Cancelled by user', '#9CA3AF');

-- PAYMENT NORMALIZATION

-- Payment Methods (Lookup table)
CREATE TABLE IF NOT EXISTS payment_methods (
    id INT PRIMARY KEY AUTO_INCREMENT,
    method_name VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    processing_fee_percent DECIMAL(5,2) DEFAULT 0
);

-- Insert default payment methods
INSERT IGNORE INTO payment_methods (method_name, processing_fee_percent) VALUES 
('bKash', 1.50),
('Nagad', 1.40),
('Rocket', 1.45),
('Bank Transfer', 0),
('Cash', 0),
('Card', 2.50);

-- Unified Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    payment_method_id INT NOT NULL,
    service_type VARCHAR(50) NOT NULL COMMENT 'land_tax, passport_fee, nid_fee, etc.',
    reference_table VARCHAR(50) NOT NULL COMMENT 'Table name of related service',
    reference_id INT NOT NULL COMMENT 'ID in the reference table',
    amount DECIMAL(15,2) NOT NULL,
    processing_fee DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(15,2) GENERATED ALWAYS AS (amount + processing_fee) STORED,
    transaction_id VARCHAR(100) UNIQUE,
    status_id INT NOT NULL DEFAULT 1,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP NULL,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
    FOREIGN KEY (status_id) REFERENCES document_statuses(id),
    INDEX idx_user_payments (user_id),
    INDEX idx_service_reference (service_type, reference_id)
);

-- AUDIT LOG TABLE

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    table_name VARCHAR(100) NOT NULL,
    record_id INT NOT NULL,
    action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    old_values JSON,
    new_values JSON,
    changed_fields TEXT COMMENT 'Comma-separated list of changed columns',
    user_id INT,
    session_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_table_record (table_name, record_id),
    INDEX idx_user_actions (user_id, action_timestamp),
    INDEX idx_timestamp (action_timestamp)
);

-- ENHANCED MY_LAND_RECORD (Add location FKs)

-- Add columns if they don't exist
ALTER TABLE my_land_record 
    ADD COLUMN IF NOT EXISTS division_id INT,
    ADD COLUMN IF NOT EXISTS district_id INT,
    ADD COLUMN IF NOT EXISTS upazila_id INT,
    ADD COLUMN IF NOT EXISTS land_price DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS deed_no VARCHAR(100),
    ADD COLUMN IF NOT EXISTS jl_no VARCHAR(50),
    ADD COLUMN IF NOT EXISTS hold_no VARCHAR(50),
    ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS division VARCHAR(100),
    ADD COLUMN IF NOT EXISTS district VARCHAR(100),
    ADD COLUMN IF NOT EXISTS upazila VARCHAR(100);

-- Add foreign key constraints if not exist (wrapped in procedure to handle errors)
-- Note: Run manually if ALTER fails due to existing constraints

-- ENHANCED GOVT_USER_DOCUMENTS

ALTER TABLE govt_user_documents
    ADD COLUMN IF NOT EXISTS expiry_date DATE,
    ADD COLUMN IF NOT EXISTS issue_date DATE,
    ADD COLUMN IF NOT EXISTS verified_by INT,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP NULL;

-- INDEXES FOR PERFORMANCE

-- Create indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_reg_info_nid ON reg_info(nid);
CREATE INDEX IF NOT EXISTS idx_reg_info_email ON reg_info(email);
CREATE INDEX IF NOT EXISTS idx_service_requests_user ON service_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_land_mutations_status ON land_mutations_v2(status, created_at);
CREATE INDEX IF NOT EXISTS idx_community_posts_group ON community_posts(group_id, status);
