-- =============================================
-- NBR (National Board of Revenue) Schema
-- Bangladesh Central Government Portal
-- =============================================

-- Tax Zones & Circles Reference
CREATE TABLE IF NOT EXISTS nbr_tax_zones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    zone_name VARCHAR(100) NOT NULL,
    zone_name_bn VARCHAR(200),
    circle_name VARCHAR(100),
    circle_name_bn VARCHAR(200),
    division VARCHAR(50),
    district VARCHAR(80),
    zone_code VARCHAR(20) UNIQUE,
    office_address TEXT,
    phone VARCHAR(30),
    email VARCHAR(100),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TIN (Taxpayer Identification Number) Registrations
CREATE TABLE IF NOT EXISTS nbr_tin_registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tin_number VARCHAR(20) UNIQUE,
    taxpayer_name VARCHAR(200) NOT NULL,
    father_name VARCHAR(200),
    mother_name VARCHAR(200),
    date_of_birth DATE,
    nid_number VARCHAR(20),
    passport_number VARCHAR(30),
    mobile VARCHAR(20),
    email VARCHAR(100),
    present_address TEXT,
    permanent_address TEXT,
    taxpayer_type ENUM('Individual','Company','Firm','AOP','Trust','Other') DEFAULT 'Individual',
    source_of_income VARCHAR(255),
    zone_id INT,
    circle VARCHAR(100),
    status ENUM('Pending','Approved','Rejected','Suspended') DEFAULT 'Pending',
    remarks TEXT,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY fk_tin_user (user_id),
    KEY fk_tin_zone (zone_id),
    CONSTRAINT fk_tin_user FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    CONSTRAINT fk_tin_zone FOREIGN KEY (zone_id) REFERENCES nbr_tax_zones(id) ON DELETE SET NULL
);

-- Detailed Tax Returns (e-Return)
CREATE TABLE IF NOT EXISTS nbr_tax_returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tin_id INT,
    assessment_year VARCHAR(20) NOT NULL,
    income_year VARCHAR(20) NOT NULL,
    return_type ENUM('Normal','Revised','Belated') DEFAULT 'Normal',

    -- Income Breakdown
    salary_income DECIMAL(15,2) DEFAULT 0,
    house_property_income DECIMAL(15,2) DEFAULT 0,
    agriculture_income DECIMAL(15,2) DEFAULT 0,
    business_income DECIMAL(15,2) DEFAULT 0,
    capital_gains DECIMAL(15,2) DEFAULT 0,
    other_income DECIMAL(15,2) DEFAULT 0,
    total_income DECIMAL(15,2) DEFAULT 0,

    -- Tax Computation
    tax_exempted_income DECIMAL(15,2) DEFAULT 0,
    taxable_income DECIMAL(15,2) DEFAULT 0,
    tax_on_income DECIMAL(15,2) DEFAULT 0,
    tax_rebate DECIMAL(15,2) DEFAULT 0,
    net_tax_liability DECIMAL(15,2) DEFAULT 0,
    tax_paid_advance DECIMAL(15,2) DEFAULT 0,
    tax_deducted_source DECIMAL(15,2) DEFAULT 0,
    tax_due DECIMAL(15,2) DEFAULT 0,

    -- Assets & Liabilities
    total_assets DECIMAL(15,2) DEFAULT 0,
    total_liabilities DECIMAL(15,2) DEFAULT 0,
    net_wealth DECIMAL(15,2) DEFAULT 0,

    -- Lifestyle & Expenditure
    total_expenditure DECIMAL(15,2) DEFAULT 0,

    -- Submission
    submission_ref VARCHAR(30) UNIQUE,
    status ENUM('Draft','Submitted','Under Review','Assessed','Accepted','Rejected') DEFAULT 'Draft',
    admin_remarks TEXT,
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY fk_return_user (user_id),
    KEY fk_return_tin (tin_id),
    CONSTRAINT fk_return_user FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    CONSTRAINT fk_return_tin FOREIGN KEY (tin_id) REFERENCES nbr_tin_registrations(id) ON DELETE SET NULL
);

-- Tax Payments
CREATE TABLE IF NOT EXISTS nbr_tax_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    return_id INT,
    tin_id INT,
    payment_type ENUM('Income Tax','VAT','Supplementary Duty','Customs Duty','Excise Duty','Other') DEFAULT 'Income Tax',
    amount DECIMAL(15,2) NOT NULL,
    payment_method ENUM('Bank Transfer','Online','Mobile Banking','Cash','Challan') DEFAULT 'Online',
    bank_name VARCHAR(100),
    branch_name VARCHAR(100),
    transaction_id VARCHAR(50),
    challan_no VARCHAR(30),
    payment_date DATE NOT NULL,
    fiscal_year VARCHAR(20),
    status ENUM('Pending','Verified','Failed','Refunded') DEFAULT 'Pending',
    receipt_no VARCHAR(30) UNIQUE,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY fk_payment_user (user_id),
    KEY fk_payment_return (return_id),
    CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_return FOREIGN KEY (return_id) REFERENCES nbr_tax_returns(id) ON DELETE SET NULL
);

-- VAT/BIN Registrations
CREATE TABLE IF NOT EXISTS nbr_vat_registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    bin_number VARCHAR(20) UNIQUE,
    business_name VARCHAR(255) NOT NULL,
    business_name_bn VARCHAR(255),
    business_type ENUM('Manufacturer','Trader','Service Provider','Importer','Exporter','Other') DEFAULT 'Service Provider',
    trade_license_no VARCHAR(50),
    business_address TEXT,
    annual_turnover DECIMAL(15,2) DEFAULT 0,
    vat_applicable TINYINT(1) DEFAULT 1,
    turnover_tax TINYINT(1) DEFAULT 0,
    contact_person VARCHAR(200),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    status ENUM('Pending','Active','Suspended','Cancelled') DEFAULT 'Pending',
    approved_by INT,
    approved_at TIMESTAMP NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY fk_vat_user (user_id),
    CONSTRAINT fk_vat_user FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
);

-- Tax Notices (Issued by Admin to Taxpayers)
CREATE TABLE IF NOT EXISTS nbr_tax_notices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tin_id INT,
    notice_type ENUM('Assessment','Demand','Penalty','Hearing','Information','Reminder','Other') DEFAULT 'Information',
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    due_date DATE,
    priority ENUM('Low','Medium','High','Urgent') DEFAULT 'Medium',
    status ENUM('Issued','Read','Responded','Resolved','Expired') DEFAULT 'Issued',
    issued_by INT,
    response TEXT,
    responded_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY fk_notice_user (user_id),
    CONSTRAINT fk_notice_user FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
);

-- Challans (Treasury Deposit Receipts)
CREATE TABLE IF NOT EXISTS nbr_tax_challan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    challan_no VARCHAR(30) UNIQUE NOT NULL,
    tin_number VARCHAR(20),
    assessment_year VARCHAR(20),
    tax_zone VARCHAR(100),
    deposit_type ENUM('Income Tax','VAT','Advance Tax','TDS','Penalty','Other') DEFAULT 'Income Tax',
    amount DECIMAL(15,2) NOT NULL,
    bank_name VARCHAR(100),
    branch_name VARCHAR(100),
    deposit_date DATE NOT NULL,
    status ENUM('Generated','Deposited','Verified','Cancelled') DEFAULT 'Generated',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY fk_challan_user (user_id),
    CONSTRAINT fk_challan_user FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
);


-- SAMPLE DATA: Tax Zones
INSERT IGNORE INTO nbr_tax_zones (zone_name, zone_name_bn, circle_name, division, district, zone_code, office_address) VALUES
('Tax Zone-1, Dhaka', 'কর অঞ্চল-১, ঢাকা', 'Circle-1', 'Dhaka', 'Dhaka', 'TZ-DHK-01', 'Segunbagicha, Dhaka-1000'),
('Tax Zone-2, Dhaka', 'কর অঞ্চল-২, ঢাকা', 'Circle-2', 'Dhaka', 'Dhaka', 'TZ-DHK-02', 'Kakrail, Dhaka-1000'),
('Tax Zone-3, Dhaka', 'কর অঞ্চল-৩, ঢাকা', 'Circle-3', 'Dhaka', 'Dhaka', 'TZ-DHK-03', 'Motijheel, Dhaka-1000'),
('Tax Zone-4, Dhaka', 'কর অঞ্চল-৪, ঢাকা', 'Circle-4', 'Dhaka', 'Dhaka', 'TZ-DHK-04', 'Wari, Dhaka-1203'),
('Tax Zone, Chittagong', 'কর অঞ্চল, চট্টগ্রাম', 'Circle-1', 'Chittagong', 'Chittagong', 'TZ-CTG-01', 'Agrabad, Chittagong'),
('Tax Zone, Rajshahi', 'কর অঞ্চল, রাজশাহী', 'Circle-1', 'Rajshahi', 'Rajshahi', 'TZ-RAJ-01', 'Rajshahi Sadar'),
('Tax Zone, Khulna', 'কর অঞ্চল, খুলনা', 'Circle-1', 'Khulna', 'Khulna', 'TZ-KHL-01', 'Khulna Sadar'),
('Tax Zone, Sylhet', 'কর অঞ্চল, সিলেট', 'Circle-1', 'Sylhet', 'Sylhet', 'TZ-SYL-01', 'Sylhet Sadar'),
('Tax Zone, Barishal', 'কর অঞ্চল, বরিশাল', 'Circle-1', 'Barishal', 'Barishal', 'TZ-BAR-01', 'Barishal Sadar'),
('Tax Zone, Rangpur', 'কর অঞ্চল, রংপুর', 'Circle-1', 'Rangpur', 'Rangpur', 'TZ-RNG-01', 'Rangpur Sadar'),
('Tax Zone, Mymensingh', 'কর অঞ্চল, ময়মনসিংহ', 'Circle-1', 'Mymensingh', 'Mymensingh', 'TZ-MYM-01', 'Mymensingh Sadar'),
('Tax Zone, Gazipur', 'কর অঞ্চল, গাজীপুর', 'Circle-1', 'Dhaka', 'Gazipur', 'TZ-GAZ-01', 'Gazipur Sadar'),
('Tax Zone, Narayanganj', 'কর অঞ্চল, নারায়ণগঞ্জ', 'Circle-1', 'Dhaka', 'Narayanganj', 'TZ-NRG-01', 'Narayanganj Sadar'),
('Tax Zone, Comilla', 'কর অঞ্চল, কুমিল্লা', 'Circle-1', 'Chittagong', 'Comilla', 'TZ-COM-01', 'Comilla Sadar');
