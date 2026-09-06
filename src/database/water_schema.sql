-- =============================================
-- পানি সম্পদ মন্ত্রণালয়
-- Ministry of Water Resources
-- Water Module Database Schema
-- =============================================

-- Drop existing tables (reverse dependency order)
DROP TABLE IF EXISTS water_complaints;
DROP TABLE IF EXISTS water_bill_payments;
DROP TABLE IF EXISTS water_connections;
DROP TABLE IF EXISTS water_projects;
DROP TABLE IF EXISTS water_quality_reports;
DROP TABLE IF EXISTS water_issues;

-- 1. Water Connections (পানির সংযোগ আবেদন)
CREATE TABLE IF NOT EXISTS water_connections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    connection_number VARCHAR(20) UNIQUE,
    holder_name VARCHAR(150) NOT NULL,
    nid_number VARCHAR(20) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    connection_type ENUM('Residential','Commercial','Industrial','Agricultural','Institutional') NOT NULL,
    pipe_size ENUM('0.5 inch','0.75 inch','1 inch','1.5 inch','2 inch') DEFAULT '0.5 inch',
    division VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    upazila VARCHAR(80) NOT NULL,
    address TEXT NOT NULL,
    ward_no VARCHAR(10),
    zone VARCHAR(50),
    wasa_region ENUM('Dhaka WASA','Chittagong WASA','Khulna WASA','Rajshahi WASA','DPHE Regional') DEFAULT 'DPHE Regional',
    status ENUM('Pending','Under Review','Approved','Rejected','Active','Disconnected') DEFAULT 'Pending',
    monthly_rate DECIMAL(10,2) DEFAULT 0.00,
    admin_remarks TEXT,
    approved_date DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Water Bill Payments (পানির বিল পরিশোধ)
CREATE TABLE IF NOT EXISTS water_bill_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    connection_id INT DEFAULT NULL,
    connection_number VARCHAR(20),
    billing_month VARCHAR(7) NOT NULL,
    meter_reading_prev INT DEFAULT 0,
    meter_reading_current INT DEFAULT 0,
    units_consumed INT DEFAULT 0,
    amount DECIMAL(10,2) NOT NULL,
    surcharge DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('bKash','Nagad','Rocket','Bank Transfer','Cash','Online') DEFAULT 'bKash',
    transaction_id VARCHAR(50),
    status ENUM('Pending','Paid','Failed','Overdue') DEFAULT 'Pending',
    paid_date DATETIME DEFAULT NULL,
    admin_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    FOREIGN KEY (connection_id) REFERENCES water_connections(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Water Quality Reports (পানির মান পরীক্ষা)
CREATE TABLE IF NOT EXISTS water_quality_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    source_type ENUM('Tube Well','Deep Tube Well','WASA Pipeline','Pond','River','Reservoir','Rain Water','Other') NOT NULL,
    division VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    upazila VARCHAR(80),
    location_details TEXT,
    issue_type ENUM('Arsenic Contamination','Iron Content','Salinity','Color/Odor','Bacterial','Chemical','Turbidity','Other') NOT NULL,
    severity ENUM('Low','Medium','High','Critical') DEFAULT 'Medium',
    description TEXT NOT NULL,
    affected_people INT DEFAULT 0,
    sample_collected TINYINT(1) DEFAULT 0,
    test_result TEXT,
    status ENUM('Reported','Under Investigation','Testing','Action Taken','Resolved','Closed') DEFAULT 'Reported',
    admin_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Water Complaints / Issues (অভিযোগ ও সমস্যা)
CREATE TABLE IF NOT EXISTS water_complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    complaint_type ENUM('No Water Supply','Low Pressure','Pipeline Leakage','Contaminated Water','Meter Fault','Billing Error','Sewage Overflow','Illegal Connection','Pump Failure','Other') NOT NULL,
    priority ENUM('Low','Normal','High','Emergency') DEFAULT 'Normal',
    division VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    upazila VARCHAR(80),
    address TEXT NOT NULL,
    description TEXT NOT NULL,
    contact_phone VARCHAR(15),
    status ENUM('Submitted','Assigned','In Progress','Resolved','Rejected','Closed') DEFAULT 'Submitted',
    assigned_to VARCHAR(100),
    resolution TEXT,
    admin_remarks TEXT,
    resolved_date DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Water Projects (পানি প্রকল্পসমূহ)
CREATE TABLE IF NOT EXISTS water_projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_name VARCHAR(250) NOT NULL,
    project_name_bn VARCHAR(250),
    project_type ENUM('Flood Control','Irrigation','Drainage','River Dredging','Embankment','Water Treatment Plant','Pipeline Extension','Tube Well Installation','Sewerage','Desalination','Other') NOT NULL,
    implementing_agency VARCHAR(200),
    division VARCHAR(50) NOT NULL,
    district VARCHAR(50),
    budget_crore DECIMAL(12,2) DEFAULT 0.00,
    start_date DATE,
    expected_completion DATE,
    progress_percent INT DEFAULT 0,
    beneficiaries INT DEFAULT 0,
    description TEXT,
    status ENUM('Planned','Ongoing','Completed','Suspended','Cancelled') DEFAULT 'Planned',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============ INSERT SAMPLE PROJECTS ============
INSERT INTO water_projects (project_name, project_name_bn, project_type, implementing_agency, division, district, budget_crore, start_date, expected_completion, progress_percent, beneficiaries, description, status) VALUES
('Padma River Training Project', 'পদ্মা নদী প্রশিক্ষণ প্রকল্প', 'River Dredging', 'BWDB', 'Dhaka', 'Munshiganj', 4500.00, '2023-01-15', '2027-06-30', 35, 500000, 'Comprehensive river training to protect Padma riverbanks and improve navigation.', 'Ongoing'),
('Teesta Barrage Irrigation Project', 'তিস্তা ব্যারেজ সেচ প্রকল্প', 'Irrigation', 'BWDB', 'Rangpur', 'Nilphamari', 8200.00, '2020-07-01', '2026-12-31', 60, 2000000, 'Large-scale irrigation project to irrigate northern Bangladesh agricultural land.', 'Ongoing'),
('Dhaka WASA Water Treatment Plant Phase-II', 'ঢাকা ওয়াসা পানি শোধনাগার ফেজ-২', 'Water Treatment Plant', 'Dhaka WASA', 'Dhaka', 'Dhaka', 3200.00, '2022-03-01', '2026-03-31', 45, 3000000, 'Expansion of Saidabad WTP to provide safe drinking water to Dhaka city.', 'Ongoing'),
('Coastal Embankment Improvement Project (CEIP)', 'উপকূলীয় বেড়িবাঁধ উন্নয়ন প্রকল্প', 'Embankment', 'BWDB', 'Barishal', 'Patuakhali', 3800.00, '2021-01-01', '2026-06-30', 70, 1500000, 'Strengthening coastal embankments to protect from cyclone and tidal surge.', 'Ongoing'),
('Chittagong Hill Tracts Water Supply', 'পার্বত্য চট্টগ্রাম পানি সরবরাহ', 'Pipeline Extension', 'DPHE', 'Chittagong', 'Rangamati', 1200.00, '2024-01-01', '2027-12-31', 15, 400000, 'Safe drinking water supply for communities in CHT hill districts.', 'Ongoing'),
('Sylhet Haor Area Flood Management', 'সিলেট হাওর এলাকা বন্যা ব্যবস্থাপনা', 'Flood Control', 'BWDB', 'Sylhet', 'Sunamganj', 2800.00, '2023-06-01', '2028-05-31', 20, 800000, 'Flood management infrastructure for haor areas of Sylhet division.', 'Ongoing'),
('Rajshahi City Sewerage Project', 'রাজশাহী সিটি পয়ঃনিষ্কাশন প্রকল্প', 'Sewerage', 'Rajshahi WASA', 'Rajshahi', 'Rajshahi', 950.00, '2024-07-01', '2027-06-30', 10, 350000, 'Modern sewerage system for Rajshahi metropolitan area.', 'Planned'),
('Khulna Desalination Plant', 'খুলনা লবণাক্ততা দূরীকরণ প্ল্যান্ট', 'Desalination', 'Khulna WASA', 'Khulna', 'Khulna', 1800.00, '2025-01-01', '2028-12-31', 5, 600000, 'Desalination plant to address salinity in southwestern coastal areas.', 'Planned');
