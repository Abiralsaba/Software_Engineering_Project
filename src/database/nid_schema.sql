-- =============================================
-- NID Wing - Election Commission of Bangladesh
-- National Identity Registration Wing Schema
-- জাতীয় পরিচয় নিবন্ধন অনুবিভাগ
-- =============================================

-- 1. NID REGISTRATION & PROFILE TABLE
CREATE TABLE IF NOT EXISTS nid_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    
    -- NID Number (10 or 17 digit)
    nid_number VARCHAR(20) UNIQUE,
    old_nid_number VARCHAR(13),
    
    -- Personal Info (Bengali & English)
    name_bn VARCHAR(200) NOT NULL COMMENT 'নাম (বাংলা)',
    name_en VARCHAR(200) NOT NULL COMMENT 'Name (English)',
    father_name_bn VARCHAR(200) COMMENT 'পিতার নাম (বাংলা)',
    father_name_en VARCHAR(200) COMMENT 'Father Name (English)',
    mother_name_bn VARCHAR(200) COMMENT 'মাতার নাম (বাংলা)',
    mother_name_en VARCHAR(200) COMMENT 'Mother Name (English)',
    spouse_name_bn VARCHAR(200) COMMENT 'স্বামী/স্ত্রীর নাম (বাংলা)',
    spouse_name_en VARCHAR(200) COMMENT 'Spouse Name (English)',
    
    -- Birth Info
    date_of_birth DATE NOT NULL,
    birth_place_bn VARCHAR(200),
    birth_place_en VARCHAR(200),
    birth_certificate_no VARCHAR(30),
    
    -- Gender & Blood Group
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown') DEFAULT 'Unknown',
    
    -- Contact
    mobile_primary VARCHAR(15),
    mobile_secondary VARCHAR(15),
    email VARCHAR(100),
    
    -- Present Address
    present_division_id INT,
    present_district_id INT,
    present_upazila_id INT,
    present_post_office VARCHAR(100),
    present_post_code VARCHAR(10),
    present_ward_no VARCHAR(10),
    present_village_bn VARCHAR(200) COMMENT 'গ্রাম/মহল্লা (বাংলা)',
    present_village_en VARCHAR(200) COMMENT 'Village/Area (English)',
    present_road_no VARCHAR(50),
    present_house_no VARCHAR(50),
    present_full_address TEXT,
    
    -- Permanent Address
    permanent_division_id INT,
    permanent_district_id INT,
    permanent_upazila_id INT,
    permanent_post_office VARCHAR(100),
    permanent_post_code VARCHAR(10),
    permanent_ward_no VARCHAR(10),
    permanent_village_bn VARCHAR(200),
    permanent_village_en VARCHAR(200),
    permanent_road_no VARCHAR(50),
    permanent_house_no VARCHAR(50),
    permanent_full_address TEXT,
    
    -- Education & Occupation
    educational_qualification VARCHAR(100),
    occupation VARCHAR(100),
    occupation_bn VARCHAR(100),
    
    -- Religion & Nationality
    religion ENUM('Islam', 'Hinduism', 'Buddhism', 'Christianity', 'Other') DEFAULT 'Islam',
    nationality VARCHAR(50) DEFAULT 'Bangladeshi',
    
    -- Voter Info
    voter_area_code VARCHAR(20),
    voter_serial_no VARCHAR(20),
    constituency_no VARCHAR(10),
    
    -- Photo & Biometrics
    photo_url VARCHAR(500),
    signature_url VARCHAR(500),
    fingerprint_registered TINYINT(1) DEFAULT 0,
    iris_registered TINYINT(1) DEFAULT 0,
    biometric_verified TINYINT(1) DEFAULT 0,
    
    -- Card Info
    card_type ENUM('Standard', 'Smart') DEFAULT 'Standard',
    card_issued TINYINT(1) DEFAULT 0,
    card_issue_date DATE,
    card_expiry_date DATE,
    smart_card_chip_id VARCHAR(50),
    
    -- Status
    profile_status ENUM('Draft', 'Pending', 'Verified', 'Active', 'Suspended', 'Deceased') DEFAULT 'Pending',
    verification_remarks TEXT,
    verified_by INT,
    verified_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    INDEX idx_nid_number (nid_number),
    INDEX idx_dob (date_of_birth),
    INDEX idx_mobile (mobile_primary)
);

-- 2. NID APPLICATIONS (New Registration)
CREATE TABLE IF NOT EXISTS nid_applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    
    -- Application Reference
    application_no VARCHAR(30) UNIQUE NOT NULL,
    application_type ENUM('New NID', 'New Voter', 'Minor to Adult', 'Overseas') DEFAULT 'New NID',
    
    -- Applicant Info (Same as profile fields)
    name_bn VARCHAR(200) NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    father_name_bn VARCHAR(200),
    father_name_en VARCHAR(200),
    mother_name_bn VARCHAR(200),
    mother_name_en VARCHAR(200),
    spouse_name_bn VARCHAR(200),
    spouse_name_en VARCHAR(200),
    
    date_of_birth DATE NOT NULL,
    birth_place VARCHAR(200),
    birth_certificate_no VARCHAR(30),
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    blood_group VARCHAR(5),
    
    mobile VARCHAR(15) NOT NULL,
    email VARCHAR(100),
    
    -- Present Address
    present_division_id INT,
    present_district_id INT,
    present_upazila_id INT,
    present_post_office VARCHAR(100),
    present_village VARCHAR(200),
    present_house_no VARCHAR(50),
    present_address TEXT,
    
    -- Permanent Address
    permanent_division_id INT,
    permanent_district_id INT,
    permanent_upazila_id INT,
    permanent_post_office VARCHAR(100),
    permanent_village VARCHAR(200),
    permanent_house_no VARCHAR(50),
    permanent_address TEXT,
    
    occupation VARCHAR(100),
    educational_qualification VARCHAR(100),
    religion VARCHAR(50),
    
    -- Documents Uploaded
    photo_url VARCHAR(500),
    signature_url VARCHAR(500),
    birth_cert_url VARCHAR(500),
    citizenship_cert_url VARCHAR(500),
    
    -- Collection Center
    collection_center_id INT,
    biometric_appointment DATE,
    biometric_completed TINYINT(1) DEFAULT 0,
    biometric_date TIMESTAMP NULL,
    
    -- Status Tracking
    status ENUM('Draft', 'Submitted', 'Under Review', 'Biometric Pending', 'Verified', 'Approved', 'Rejected', 'Card Printing', 'Ready for Collection', 'Delivered') DEFAULT 'Draft',
    rejection_reason TEXT,
    
    -- Admin
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    
    -- Generated NID
    assigned_nid VARCHAR(20),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    INDEX idx_app_no (application_no),
    INDEX idx_status (status)
);

-- 3. NID CORRECTION REQUESTS
CREATE TABLE IF NOT EXISTS nid_correction_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    nid_profile_id INT,
    
    -- Request Reference
    request_no VARCHAR(30) UNIQUE NOT NULL,
    nid_number VARCHAR(20) NOT NULL,
    
    -- Correction Category
    correction_category ENUM(
        'Name', 
        'Father Name', 
        'Mother Name', 
        'Spouse Name',
        'Date of Birth', 
        'Blood Group',
        'Present Address', 
        'Permanent Address',
        'Photo', 
        'Signature',
        'Educational Qualification',
        'Occupation',
        'Multiple Fields'
    ) NOT NULL,
    
    -- Current vs Corrected Values (JSON for multiple fields)
    current_value TEXT,
    corrected_value TEXT,
    
    -- Supporting Documents
    supporting_doc_1 VARCHAR(500),
    supporting_doc_2 VARCHAR(500),
    supporting_doc_3 VARCHAR(500),
    document_description TEXT,
    
    -- Fee Info
    fee_amount DECIMAL(10,2) DEFAULT 0,
    fee_paid TINYINT(1) DEFAULT 0,
    payment_ref VARCHAR(50),
    payment_date TIMESTAMP NULL,
    
    -- Status
    status ENUM('Draft', 'Submitted', 'Under Review', 'Document Verification', 'Approved', 'Rejected', 'Completed') DEFAULT 'Draft',
    rejection_reason TEXT,
    admin_remarks TEXT,
    
    -- Admin Processing
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    
    -- Verification at EC Office
    office_verification_required TINYINT(1) DEFAULT 0,
    office_verification_date DATE,
    office_id INT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    INDEX idx_request_no (request_no),
    INDEX idx_nid (nid_number)
);

-- 4. NID REISSUE REQUESTS (Lost/Damaged)
CREATE TABLE IF NOT EXISTS nid_reissue_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    nid_profile_id INT,
    
    -- Request Reference
    request_no VARCHAR(30) UNIQUE NOT NULL,
    nid_number VARCHAR(20) NOT NULL,
    
    -- Reissue Reason
    reason ENUM('Lost', 'Stolen', 'Damaged', 'Expired', 'Upgrade to Smart Card', 'Name Change After Marriage') NOT NULL,
    reason_details TEXT,
    
    -- Police Report (For Lost/Stolen)
    gd_number VARCHAR(50) COMMENT 'General Diary Number',
    gd_date DATE,
    police_station VARCHAR(100),
    gd_document_url VARCHAR(500),
    
    -- For Damaged Card
    damaged_card_returned TINYINT(1) DEFAULT 0,
    damaged_card_photo_url VARCHAR(500),
    
    -- Delivery Preference
    delivery_type ENUM('Collection Center', 'Post Office', 'Home Delivery') DEFAULT 'Collection Center',
    collection_center_id INT,
    delivery_address TEXT,
    
    -- Fee
    fee_amount DECIMAL(10,2) DEFAULT 345.00 COMMENT 'Standard reissue fee',
    fee_paid TINYINT(1) DEFAULT 0,
    payment_ref VARCHAR(50),
    payment_date TIMESTAMP NULL,
    
    -- Status
    status ENUM('Draft', 'Submitted', 'Payment Pending', 'Under Review', 'Verified', 'Card Printing', 'Ready for Collection', 'Delivered', 'Rejected') DEFAULT 'Draft',
    rejection_reason TEXT,
    
    -- Timelines
    expected_delivery DATE,
    actual_delivery DATE,
    
    -- Admin
    processed_by INT,
    processed_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    INDEX idx_reissue_no (request_no)
);

-- 5. SMART NID CARD APPLICATIONS
CREATE TABLE IF NOT EXISTS nid_smart_card_applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    nid_profile_id INT,
    
    -- Request Reference
    application_no VARCHAR(30) UNIQUE NOT NULL,
    nid_number VARCHAR(20) NOT NULL,
    
    -- Current Card Info
    current_card_type ENUM('Standard', 'Old Laminated', 'None') DEFAULT 'Standard',
    old_card_returned TINYINT(1) DEFAULT 0,
    
    -- Smart Card Features Request
    include_driving_license TINYINT(1) DEFAULT 0,
    include_passport_info TINYINT(1) DEFAULT 0,
    include_health_id TINYINT(1) DEFAULT 0,
    include_bank_account TINYINT(1) DEFAULT 0,
    
    -- Biometric Update Required
    biometric_update_required TINYINT(1) DEFAULT 1,
    biometric_appointment DATE,
    biometric_completed TINYINT(1) DEFAULT 0,
    
    -- Collection
    collection_center_id INT,
    
    -- Fee
    fee_amount DECIMAL(10,2) DEFAULT 575.00 COMMENT 'Smart card fee',
    fee_paid TINYINT(1) DEFAULT 0,
    payment_ref VARCHAR(50),
    payment_date TIMESTAMP NULL,
    
    -- Status
    status ENUM('Draft', 'Submitted', 'Payment Pending', 'Biometric Appointment', 'Biometric Done', 'Card Production', 'Quality Check', 'Ready for Collection', 'Delivered', 'Rejected') DEFAULT 'Draft',
    
    -- Chip Data
    chip_serial VARCHAR(50),
    chip_programmed TINYINT(1) DEFAULT 0,
    
    -- Delivery
    expected_delivery DATE,
    actual_delivery DATE,
    delivered_by INT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
);

-- 6. NID VERIFICATION REQUESTS
CREATE TABLE IF NOT EXISTS nid_verification_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    
    -- Verification Type
    verification_type ENUM('Self', 'Family Member', 'Employee', 'Customer') DEFAULT 'Self',
    purpose VARCHAR(200),
    
    -- NID to Verify
    verify_nid_number VARCHAR(20) NOT NULL,
    verify_name VARCHAR(200),
    verify_dob DATE,
    
    -- Result
    verification_status ENUM('Pending', 'Verified', 'Mismatch', 'Not Found', 'Failed') DEFAULT 'Pending',
    verified_data JSON COMMENT 'Returned verified data',
    mismatch_fields TEXT,
    
    -- API Response
    api_response_code VARCHAR(20),
    api_response_time TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    INDEX idx_verify_nid (verify_nid_number)
);

-- 7. NID ADDRESS CHANGE REQUESTS
CREATE TABLE IF NOT EXISTS nid_address_changes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    nid_profile_id INT,
    
    request_no VARCHAR(30) UNIQUE NOT NULL,
    nid_number VARCHAR(20) NOT NULL,
    
    -- Address Type
    address_type ENUM('Present', 'Permanent', 'Both') NOT NULL,
    
    -- Old Address
    old_division_id INT,
    old_district_id INT,
    old_upazila_id INT,
    old_address TEXT,
    
    -- New Address
    new_division_id INT,
    new_district_id INT,
    new_upazila_id INT,
    new_post_office VARCHAR(100),
    new_post_code VARCHAR(10),
    new_ward VARCHAR(20),
    new_village VARCHAR(200),
    new_road VARCHAR(100),
    new_house VARCHAR(50),
    new_full_address TEXT,
    
    -- Reason & Documents
    change_reason TEXT,
    proof_document_url VARCHAR(500) COMMENT 'Utility bill, deed, rent agreement',
    document_type VARCHAR(100),
    
    -- Fee
    fee_amount DECIMAL(10,2) DEFAULT 230.00,
    fee_paid TINYINT(1) DEFAULT 0,
    payment_ref VARCHAR(50),
    
    -- Status
    status ENUM('Draft', 'Submitted', 'Under Review', 'Verified', 'Updated', 'Rejected') DEFAULT 'Draft',
    rejection_reason TEXT,
    
    processed_by INT,
    processed_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
);

-- 8. NID COLLECTION CENTERS (EC Offices)
CREATE TABLE IF NOT EXISTS nid_collection_centers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    center_code VARCHAR(20) UNIQUE NOT NULL,
    center_name VARCHAR(200) NOT NULL,
    center_name_bn VARCHAR(200),
    
    division_id INT,
    district_id INT,
    upazila_id INT,
    
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    
    -- Operating Hours
    opening_time TIME DEFAULT '09:00:00',
    closing_time TIME DEFAULT '17:00:00',
    weekly_holiday VARCHAR(20) DEFAULT 'Friday',
    
    -- Services Available
    has_biometric_facility TINYINT(1) DEFAULT 1,
    has_photo_facility TINYINT(1) DEFAULT 1,
    has_card_delivery TINYINT(1) DEFAULT 1,
    
    -- Capacity
    daily_capacity INT DEFAULT 100,
    
    is_active TINYINT(1) DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. NID ACTIVITY LOG (Audit Trail)
CREATE TABLE IF NOT EXISTS nid_activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    nid_number VARCHAR(20),
    user_id INT,
    
    activity_type ENUM(
        'Profile View',
        'Profile Update',
        'Correction Request',
        'Reissue Request',
        'Smart Card Request',
        'Address Change',
        'Verification',
        'Download',
        'Print',
        'Biometric Update'
    ) NOT NULL,
    
    activity_details TEXT,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_nid_log (nid_number),
    INDEX idx_activity_date (created_at)
);

-- 10. NID FAMILY MEMBERS
CREATE TABLE IF NOT EXISTS nid_family_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nid_profile_id INT NOT NULL,
    user_id INT NOT NULL,
    
    relation ENUM('Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Other') NOT NULL,
    
    member_name VARCHAR(200),
    member_nid VARCHAR(20),
    member_dob DATE,
    member_occupation VARCHAR(100),
    
    is_dependent TINYINT(1) DEFAULT 0,
    verified TINYINT(1) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (nid_profile_id) REFERENCES nid_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
);

-- 11. NID BIOMETRIC APPOINTMENTS
CREATE TABLE IF NOT EXISTS nid_biometric_appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    
    appointment_ref VARCHAR(30) UNIQUE NOT NULL,
    application_type ENUM('New NID', 'Smart Card', 'Biometric Update', 'Correction') NOT NULL,
    related_application_id INT,
    
    center_id INT,
    appointment_date DATE NOT NULL,
    time_slot ENUM('09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '14:00-15:00', '15:00-16:00', '16:00-17:00') NOT NULL,
    
    -- Status
    status ENUM('Scheduled', 'Confirmed', 'Completed', 'Missed', 'Rescheduled', 'Cancelled') DEFAULT 'Scheduled',
    
    -- Completion Info
    completed_at TIMESTAMP NULL,
    fingerprint_captured TINYINT(1) DEFAULT 0,
    iris_captured TINYINT(1) DEFAULT 0,
    photo_captured TINYINT(1) DEFAULT 0,
    signature_captured TINYINT(1) DEFAULT 0,
    
    -- Officer
    processed_by INT,
    remarks TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    FOREIGN KEY (center_id) REFERENCES nid_collection_centers(id) ON DELETE SET NULL,
    INDEX idx_appointment_date (appointment_date)
);

-- 12. NID FEES CONFIGURATION
CREATE TABLE IF NOT EXISTS nid_fees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    service_type VARCHAR(100) NOT NULL,
    service_code VARCHAR(20) UNIQUE NOT NULL,
    
    normal_fee DECIMAL(10,2) NOT NULL,
    urgent_fee DECIMAL(10,2),
    
    processing_days_normal INT DEFAULT 15,
    processing_days_urgent INT DEFAULT 3,
    
    is_active TINYINT(1) DEFAULT 1,
    
    effective_from DATE,
    effective_to DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Fees
INSERT INTO nid_fees (service_type, service_code, normal_fee, urgent_fee, processing_days_normal, processing_days_urgent) VALUES
('New NID Application', 'NID_NEW', 0.00, 500.00, 30, 7),
('NID Correction - Single Field', 'NID_COR_1', 230.00, 460.00, 15, 3),
('NID Correction - Multiple Fields', 'NID_COR_M', 345.00, 690.00, 21, 5),
('NID Reissue - Lost/Stolen', 'NID_REI_L', 345.00, 690.00, 21, 5),
('NID Reissue - Damaged', 'NID_REI_D', 230.00, 460.00, 15, 3),
('Smart Card Application', 'NID_SMART', 575.00, 1150.00, 30, 7),
('Address Change', 'NID_ADDR', 230.00, 460.00, 15, 3),
('NID Verification', 'NID_VER', 50.00, NULL, 1, 1),
('Biometric Update', 'NID_BIO', 115.00, 230.00, 7, 2),
('Digital NID Download', 'NID_DIG', 0.00, NULL, 0, 0)
ON DUPLICATE KEY UPDATE normal_fee = VALUES(normal_fee);

-- SAMPLE COLLECTION CENTERS (Major Districts)
INSERT INTO nid_collection_centers (center_code, center_name, center_name_bn, address, phone) VALUES
('EC-DHK-01', 'Dhaka Regional EC Office', 'ঢাকা আঞ্চলিক নির্বাচন কার্যালয়', 'Nirbachan Bhaban, Agargaon, Dhaka-1207', '02-8181818'),
('EC-CTG-01', 'Chittagong Regional EC Office', 'চট্টগ্রাম আঞ্চলিক নির্বাচন কার্যালয়', 'Agrabad Commercial Area, Chittagong', '031-2520871'),
('EC-RAJ-01', 'Rajshahi Regional EC Office', 'রাজশাহী আঞ্চলিক নির্বাচন কার্যালয়', 'Ghoramara, Boalia, Rajshahi', '0721-775323'),
('EC-KHL-01', 'Khulna Regional EC Office', 'খুলনা আঞ্চলিক নির্বাচন কার্যালয়', 'KDA Avenue, Khulna', '041-720680'),
('EC-SYL-01', 'Sylhet Regional EC Office', 'সিলেট আঞ্চলিক নির্বাচন কার্যালয়', 'Jail Road, Sylhet', '0821-714789'),
('EC-BAR-01', 'Barisal Regional EC Office', 'বরিশাল আঞ্চলিক নির্বাচন কার্যালয়', 'Sadar Road, Barisal', '0431-2173456'),
('EC-RNG-01', 'Rangpur Regional EC Office', 'রংপুর আঞ্চলিক নির্বাচন কার্যালয়', 'Station Road, Rangpur', '0521-63456'),
('EC-MYM-01', 'Mymensingh Regional EC Office', 'ময়মনসিংহ আঞ্চলিক নির্বাচন কার্যালয়', 'Circuit House Road, Mymensingh', '091-66789')
ON DUPLICATE KEY UPDATE center_name = VALUES(center_name);
