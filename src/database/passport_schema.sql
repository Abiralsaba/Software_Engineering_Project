-- =============================================
-- Department of Immigration & Passports (DIP)
-- e-Passport System - Database Schema
-- Government of the People's Republic of Bangladesh
-- =============================================

USE central_govt_db;

-- Drop existing tables if needed (in reverse FK order)
DROP TABLE IF EXISTS passport_status_history;
DROP TABLE IF EXISTS passport_books;
DROP TABLE IF EXISTS passport_applications;
DROP TABLE IF EXISTS passport_fee_schedule;
DROP TABLE IF EXISTS passport_offices;

-- 1. Regional Passport Offices
CREATE TABLE IF NOT EXISTS passport_offices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    office_code VARCHAR(10) NOT NULL UNIQUE,
    office_name VARCHAR(150) NOT NULL,
    office_name_bn VARCHAR(200),
    division VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    working_hours VARCHAR(100) DEFAULT 'Sun-Thu, 9:00 AM - 5:00 PM',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Regional Passport Offices
INSERT INTO passport_offices (office_code, office_name, office_name_bn, division, district, address, phone) VALUES
('RPO-DHK',   'RPO Dhaka (Agargaon)',     'আঞ্চলিক পাসপোর্ট অফিস, ঢাকা (আগারগাঁও)',    'Dhaka',       'Dhaka',        'E/8-E, Agargaon, Sher-e-Bangla Nagar, Dhaka-1207', '02-9116842'),
('RPO-DHK-U', 'RPO Dhaka (Uttara)',       'আঞ্চলিক পাসপোর্ট অফিস, ঢাকা (উত্তরা)',       'Dhaka',       'Dhaka',        'Sector 3, Uttara, Dhaka-1230', '02-8953100'),
('RPO-CTG',   'RPO Chittagong',           'আঞ্চলিক পাসপোর্ট অফিস, চট্টগ্রাম',           'Chittagong',  'Chittagong',   'Muradpur, Chittagong', '031-2850866'),
('RPO-RAJ',   'RPO Rajshahi',             'আঞ্চলিক পাসপোর্ট অফিস, রাজশাহী',             'Rajshahi',    'Rajshahi',     'Rajshahi City', '0721-775544'),
('RPO-KHU',   'RPO Khulna',               'আঞ্চলিক পাসপোর্ট অফিস, খুলনা',               'Khulna',      'Khulna',       'Khulna City', '041-720060'),
('RPO-SYL',   'RPO Sylhet',               'আঞ্চলিক পাসপোর্ট অফিস, সিলেট',               'Sylhet',      'Sylhet',       'Sylhet City', '0821-716070'),
('RPO-BAR',   'RPO Barisal',              'আঞ্চলিক পাসপোর্ট অফিস, বরিশাল',              'Barisal',     'Barisal',      'Barisal City', '0431-2176060'),
('RPO-RAN',   'RPO Rangpur',              'আঞ্চলিক পাসপোর্ট অফিস, রংপুর',               'Rangpur',     'Rangpur',      'Rangpur City', '0521-63470'),
('RPO-MYM',   'RPO Mymensingh',           'আঞ্চলিক পাসপোর্ট অফিস, ময়মনসিংহ',            'Mymensingh',  'Mymensingh',   'Mymensingh City', '091-66470'),
('RPO-COM',   'RPO Comilla',              'আঞ্চলিক পাসপোর্ট অফিস, কুমিল্লা',             'Chittagong',  'Comilla',      'Comilla City', '081-76660'),
('RPO-GAZ',   'RPO Gazipur',              'আঞ্চলিক পাসপোর্ট অফিস, গাজীপুর',              'Dhaka',       'Gazipur',      'Gazipur City', '02-9298070'),
('RPO-NAR',   'RPO Narayanganj',          'আঞ্চলিক পাসপোর্ট অফিস, নারায়ণগঞ্জ',           'Dhaka',       'Narayanganj',  'Narayanganj City', '02-7642070'),
('RPO-JES',   'RPO Jessore',              'আঞ্চলিক পাসপোর্ট অফিস, যশোর',                'Khulna',      'Jessore',      'Jessore City', '0421-68670'),
('RPO-FAR',   'RPO Faridpur',             'আঞ্চলিক পাসপোর্ট অফিস, ফরিদপুর',              'Dhaka',       'Faridpur',     'Faridpur City', '0631-65670'),
('RPO-CXB',   'RPO Coxs Bazar',           'আঞ্চলিক পাসপোর্ট অফিস, কক্সবাজার',            'Chittagong',  'Coxs Bazar',   'Coxs Bazar City', '0341-63670');


-- 2. Fee Schedule (Updatable by admin)
CREATE TABLE IF NOT EXISTS passport_fee_schedule (
    id INT AUTO_INCREMENT PRIMARY KEY,
    passport_type ENUM('Ordinary','Official','Diplomatic') NOT NULL,
    page_count ENUM('48','64') NOT NULL,
    validity_years ENUM('5','10') NOT NULL,
    delivery_type ENUM('Regular','Express','Super Express') NOT NULL,
    fee_bdt DECIMAL(10,2) NOT NULL,
    penalty_bdt DECIMAL(10,2) DEFAULT 0.00,
    description VARCHAR(255),
    effective_from DATE NOT NULL DEFAULT '2024-01-01',
    effective_to DATE DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_fee_lookup (passport_type, page_count, validity_years, delivery_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Ordinary Passport Fees (Real BDT values)
INSERT INTO passport_fee_schedule (passport_type, page_count, validity_years, delivery_type, fee_bdt, description, effective_from) VALUES
-- 48 Pages
('Ordinary', '48', '5',  'Regular',       3450.00,  '48 পৃষ্ঠা, ৫ বছর, সাধারণ', '2024-01-01'),
('Ordinary', '48', '5',  'Express',       6900.00,  '48 পৃষ্ঠা, ৫ বছর, জরুরি', '2024-01-01'),
('Ordinary', '48', '5',  'Super Express', 13800.00, '48 পৃষ্ঠা, ৫ বছর, অতি জরুরি', '2024-01-01'),
('Ordinary', '48', '10', 'Regular',       5750.00,  '48 পৃষ্ঠা, ১০ বছর, সাধারণ', '2024-01-01'),
('Ordinary', '48', '10', 'Express',       11500.00, '48 পৃষ্ঠা, ১০ বছর, জরুরি', '2024-01-01'),
('Ordinary', '48', '10', 'Super Express', 23000.00, '48 পৃষ্ঠা, ১০ বছর, অতি জরুরি', '2024-01-01'),
-- 64 Pages
('Ordinary', '64', '5',  'Regular',       4600.00,  '64 পৃষ্ঠা, ৫ বছর, সাধারণ', '2024-01-01'),
('Ordinary', '64', '5',  'Express',       9200.00,  '64 পৃষ্ঠা, ৫ বছর, জরুরি', '2024-01-01'),
('Ordinary', '64', '5',  'Super Express', 18400.00, '64 পৃষ্ঠা, ৫ বছর, অতি জরুরি', '2024-01-01'),
('Ordinary', '64', '10', 'Regular',       6900.00,  '64 পৃষ্ঠা, ১০ বছর, সাধারণ', '2024-01-01'),
('Ordinary', '64', '10', 'Express',       13800.00, '64 পৃষ্ঠা, ১০ বছর, জরুরি', '2024-01-01'),
('Ordinary', '64', '10', 'Super Express', 27600.00, '64 পৃষ্ঠা, ১০ বছর, অতি জরুরি', '2024-01-01');


-- 3. Main Passport Applications Table
CREATE TABLE IF NOT EXISTS passport_applications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    application_number VARCHAR(20) NOT NULL UNIQUE,
    
    -- === Service Selection ===
    service_type ENUM('New','Renewal','Lost Replacement','Damaged Replacement','Correction','Duplicate','Spouse Addition') NOT NULL DEFAULT 'New',
    passport_type ENUM('Ordinary','Official','Diplomatic') NOT NULL DEFAULT 'Ordinary',
    page_count ENUM('48','64') NOT NULL DEFAULT '48',
    validity_years ENUM('5','10') NOT NULL DEFAULT '5',
    delivery_type ENUM('Regular','Express','Super Express') NOT NULL DEFAULT 'Regular',
    
    -- === Personal Information ===
    full_name_bn VARCHAR(255) COMMENT 'নাম (বাংলায়)',
    full_name_en VARCHAR(255) NOT NULL COMMENT 'Name in English (Block Letters)',
    father_name_bn VARCHAR(255) COMMENT 'পিতার নাম (বাংলায়)',
    father_name_en VARCHAR(255) NOT NULL COMMENT 'Father Name (English)',
    mother_name_bn VARCHAR(255) COMMENT 'মাতার নাম (বাংলায়)',
    mother_name_en VARCHAR(255) NOT NULL COMMENT 'Mother Name (English)',
    spouse_name_bn VARCHAR(255) DEFAULT NULL COMMENT 'স্বামী/স্ত্রীর নাম (বাংলায়)',
    spouse_name_en VARCHAR(255) DEFAULT NULL COMMENT 'Spouse Name (English)',
    date_of_birth DATE NOT NULL,
    gender ENUM('Male','Female','Other') NOT NULL,
    religion ENUM('Islam','Hinduism','Buddhism','Christianity','Other') DEFAULT 'Islam',
    marital_status ENUM('Single','Married','Divorced','Widowed') NOT NULL DEFAULT 'Single',
    nationality VARCHAR(50) NOT NULL DEFAULT 'Bangladeshi',
    nid_number VARCHAR(17) COMMENT 'জাতীয় পরিচয়পত্র নম্বর (10 or 17 digit)',
    birth_certificate_no VARCHAR(17) COMMENT 'জন্ম নিবন্ধন নম্বর (17-digit)',
    tin_number VARCHAR(12) DEFAULT NULL COMMENT 'TIN Number (Optional)',
    blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') DEFAULT NULL,
    profession VARCHAR(100),
    education ENUM('No Formal Education','PSC','JSC','SSC','HSC','Diploma','Graduate','Post Graduate','PhD','Others') DEFAULT 'SSC',
    height_ft TINYINT DEFAULT NULL,
    height_in TINYINT DEFAULT NULL,
    distinguishing_mark VARCHAR(255) DEFAULT NULL COMMENT 'সনাক্তকরণ চিহ্ন',
    
    -- === Present Address ===
    present_care_of VARCHAR(255) DEFAULT NULL,
    present_village_road VARCHAR(255),
    present_post_office VARCHAR(100),
    present_postal_code VARCHAR(10),
    present_upazila VARCHAR(100),
    present_district VARCHAR(50),
    present_division VARCHAR(50),
    
    -- === Permanent Address ===
    same_as_present BOOLEAN DEFAULT FALSE,
    permanent_care_of VARCHAR(255) DEFAULT NULL,
    permanent_village_road VARCHAR(255),
    permanent_post_office VARCHAR(100),
    permanent_postal_code VARCHAR(10),
    permanent_upazila VARCHAR(100),
    permanent_district VARCHAR(50),
    permanent_division VARCHAR(50),
    
    -- === Contact Information ===
    mobile_number VARCHAR(15),
    email VARCHAR(255),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(15),
    emergency_contact_relation VARCHAR(50),
    
    -- === Previous Passport (For Renewal/Re-issue) ===
    old_passport_number VARCHAR(15) DEFAULT NULL,
    old_passport_issue_date DATE DEFAULT NULL,
    old_passport_expiry_date DATE DEFAULT NULL,
    old_passport_issue_place VARCHAR(100) DEFAULT NULL,
    reason_for_reissue ENUM('Expired','Lost','Damaged','Pages Exhausted','Name Change','Other') DEFAULT NULL,
    
    -- === Office & Processing ===
    preferred_office VARCHAR(10) DEFAULT 'RPO-DHK',
    
    -- === Status Tracking ===
    status ENUM(
        'Submitted',
        'Payment Verified',
        'Under Review',
        'Biometric Scheduled',
        'Biometric Enrolled',
        'Police Verification',
        'Police Verification Completed',
        'Approved',
        'Printing',
        'Dispatched',
        'Ready for Delivery',
        'Delivered',
        'Rejected',
        'On Hold',
        'Cancelled'
    ) NOT NULL DEFAULT 'Submitted',
    rejection_reason TEXT DEFAULT NULL,
    admin_remarks TEXT DEFAULT NULL,
    
    -- === Fees & Payment ===
    fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    penalty_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_status ENUM('Unpaid','Paid','Refunded') DEFAULT 'Unpaid',
    payment_method ENUM('Sonali Bank Challan','bKash','Nagad','Rocket','VISA/MasterCard','Online Banking') DEFAULT NULL,
    payment_transaction_id VARCHAR(100) DEFAULT NULL,
    payment_date DATETIME DEFAULT NULL,
    
    -- === Document Uploads ===
    photo_path VARCHAR(500) DEFAULT NULL,
    nid_scan_path VARCHAR(500) DEFAULT NULL,
    birth_cert_path VARCHAR(500) DEFAULT NULL,
    old_passport_scan_path VARCHAR(500) DEFAULT NULL,
    noc_path VARCHAR(500) DEFAULT NULL,
    affidavit_path VARCHAR(500) DEFAULT NULL,
    additional_doc_path VARCHAR(500) DEFAULT NULL,
    
    -- === Timestamps ===
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    biometric_date DATETIME DEFAULT NULL,
    police_verification_date DATETIME DEFAULT NULL,
    approved_at DATETIME DEFAULT NULL,
    printed_at DATETIME DEFAULT NULL,
    dispatched_at DATETIME DEFAULT NULL,
    delivered_at DATETIME DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- === Foreign Keys & Indexes ===
    CONSTRAINT fk_passport_user FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    CONSTRAINT fk_passport_office FOREIGN KEY (preferred_office) REFERENCES passport_offices(office_code),
    
    INDEX idx_passport_status (status),
    INDEX idx_passport_user (user_id),
    INDEX idx_passport_nid (nid_number),
    INDEX idx_passport_app_number (application_number),
    INDEX idx_passport_service (service_type),
    INDEX idx_passport_payment (payment_status),
    INDEX idx_passport_submitted (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 4. Status History / Audit Trail
CREATE TABLE IF NOT EXISTS passport_status_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(100) DEFAULT 'System',
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_status_history_app FOREIGN KEY (application_id) REFERENCES passport_applications(id) ON DELETE CASCADE,
    INDEX idx_history_app (application_id),
    INDEX idx_history_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 5. Issued Passport Books
CREATE TABLE IF NOT EXISTS passport_books (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT NOT NULL UNIQUE,
    passport_number VARCHAR(9) NOT NULL UNIQUE COMMENT 'Format: 2 letters + 7 digits (e.g., AT0123456)',
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    issuing_authority VARCHAR(150) DEFAULT 'Department of Immigration & Passports, Bangladesh',
    place_of_issue VARCHAR(100),
    mrz_line1 VARCHAR(44) DEFAULT NULL COMMENT 'Machine Readable Zone Line 1',
    mrz_line2 VARCHAR(44) DEFAULT NULL COMMENT 'Machine Readable Zone Line 2',
    passport_type_code CHAR(2) DEFAULT 'P' COMMENT 'P=Ordinary, PO=Official, PD=Diplomatic',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_book_application FOREIGN KEY (application_id) REFERENCES passport_applications(id) ON DELETE CASCADE,
    INDEX idx_book_passport_no (passport_number),
    INDEX idx_book_expiry (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 6. Useful Views

-- View: Application Summary with User & Office details
CREATE OR REPLACE VIEW vw_passport_application_summary AS
SELECT 
    pa.id,
    pa.application_number,
    pa.user_id,
    ri.name AS applicant_name,
    ri.email AS user_email,
    pa.service_type,
    pa.passport_type,
    pa.page_count,
    pa.validity_years,
    pa.delivery_type,
    pa.full_name_en,
    pa.full_name_bn,
    pa.date_of_birth,
    pa.gender,
    pa.nid_number,
    pa.mobile_number,
    pa.preferred_office,
    po.office_name,
    po.office_name_bn,
    pa.status,
    pa.fee_amount,
    pa.penalty_amount,
    pa.total_fee,
    pa.payment_status,
    pa.payment_method,
    pa.submitted_at,
    pa.biometric_date,
    pa.delivered_at,
    pa.updated_at,
    pb.passport_number,
    pb.issue_date AS passport_issue_date,
    pb.expiry_date AS passport_expiry_date
FROM passport_applications pa
JOIN reg_info ri ON pa.user_id = ri.id
LEFT JOIN passport_offices po ON pa.preferred_office = po.office_code
LEFT JOIN passport_books pb ON pa.id = pb.application_id;

-- View: Status-wise Application Count
CREATE OR REPLACE VIEW vw_passport_status_summary AS
SELECT 
    status,
    COUNT(*) as total_count,
    SUM(CASE WHEN payment_status = 'Paid' THEN total_fee ELSE 0 END) as total_revenue
FROM passport_applications
GROUP BY status;

-- View: Office-wise Application Count
CREATE OR REPLACE VIEW vw_passport_office_summary AS
SELECT 
    po.office_code,
    po.office_name,
    po.division,
    COUNT(pa.id) as total_applications,
    SUM(CASE WHEN pa.status NOT IN ('Delivered','Rejected','Cancelled') THEN 1 ELSE 0 END) as active_applications
FROM passport_offices po
LEFT JOIN passport_applications pa ON po.office_code = pa.preferred_office
GROUP BY po.office_code, po.office_name, po.division;


-- 7. Stored Procedures

DELIMITER //

-- Procedure: Generate unique application number
CREATE PROCEDURE IF NOT EXISTS sp_generate_passport_app_number(
    OUT app_number VARCHAR(20)
)
BEGIN
    DECLARE today_str VARCHAR(8);
    DECLARE seq_num INT;
    
    SET today_str = DATE_FORMAT(NOW(), '%Y%m%d');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(application_number, 11) AS UNSIGNED)), 0) + 1
    INTO seq_num
    FROM passport_applications
    WHERE application_number LIKE CONCAT('EP', today_str, '%');
    
    SET app_number = CONCAT('EP', today_str, LPAD(seq_num, 5, '0'));
END //

-- Procedure: Update application status with history logging
CREATE PROCEDURE IF NOT EXISTS sp_update_passport_status(
    IN p_app_id BIGINT,
    IN p_new_status VARCHAR(50),
    IN p_changed_by VARCHAR(100),
    IN p_remarks TEXT
)
BEGIN
    DECLARE v_old_status VARCHAR(50);
    
    SELECT status INTO v_old_status FROM passport_applications WHERE id = p_app_id;
    
    UPDATE passport_applications SET status = p_new_status WHERE id = p_app_id;
    
    -- Update relevant timestamp based on new status
    CASE p_new_status
        WHEN 'Biometric Scheduled' THEN 
            UPDATE passport_applications SET biometric_date = NOW() WHERE id = p_app_id;
        WHEN 'Approved' THEN 
            UPDATE passport_applications SET approved_at = NOW() WHERE id = p_app_id;
        WHEN 'Printing' THEN 
            UPDATE passport_applications SET printed_at = NOW() WHERE id = p_app_id;
        WHEN 'Dispatched' THEN 
            UPDATE passport_applications SET dispatched_at = NOW() WHERE id = p_app_id;
        WHEN 'Delivered' THEN 
            UPDATE passport_applications SET delivered_at = NOW() WHERE id = p_app_id;
        ELSE BEGIN END;
    END CASE;
    
    -- Log status change
    INSERT INTO passport_status_history (application_id, old_status, new_status, changed_by, remarks)
    VALUES (p_app_id, v_old_status, p_new_status, p_changed_by, p_remarks);
END //

-- Procedure: Calculate passport fee
CREATE PROCEDURE IF NOT EXISTS sp_calculate_passport_fee(
    IN p_passport_type VARCHAR(20),
    IN p_page_count VARCHAR(2),
    IN p_validity_years VARCHAR(2),
    IN p_delivery_type VARCHAR(20),
    IN p_service_type VARCHAR(30),
    OUT p_fee DECIMAL(10,2),
    OUT p_penalty DECIMAL(10,2),
    OUT p_total DECIMAL(10,2)
)
BEGIN
    -- Get base fee
    SELECT fee_bdt INTO p_fee
    FROM passport_fee_schedule
    WHERE passport_type = p_passport_type
      AND page_count = p_page_count
      AND validity_years = p_validity_years
      AND delivery_type = p_delivery_type
      AND is_active = TRUE
    LIMIT 1;
    
    IF p_fee IS NULL THEN
        SET p_fee = 0;
    END IF;
    
    -- Calculate penalty for lost/damaged
    SET p_penalty = 0;
    IF p_service_type IN ('Lost Replacement', 'Damaged Replacement') THEN
        SET p_penalty = 5000.00;
    END IF;
    
    SET p_total = p_fee + p_penalty;
END //

DELIMITER ;


-- 8. Triggers

DELIMITER //

-- Trigger: Auto-log status on insert
CREATE TRIGGER trg_passport_after_insert
AFTER INSERT ON passport_applications
FOR EACH ROW
BEGIN
    INSERT INTO passport_status_history (application_id, old_status, new_status, changed_by, remarks)
    VALUES (NEW.id, NULL, NEW.status, 'System', 'Application submitted');
END //

-- Trigger: Auto-log status changes on update
CREATE TRIGGER trg_passport_after_update
AFTER UPDATE ON passport_applications
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO passport_status_history (application_id, old_status, new_status, changed_by, remarks)
        VALUES (NEW.id, OLD.status, NEW.status, 'System', CONCAT('Status changed from ', OLD.status, ' to ', NEW.status));
    END IF;
END //

DELIMITER ;
