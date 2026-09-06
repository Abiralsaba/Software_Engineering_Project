-- =====================================================
-- BANGLADESH UNIVERSITY ADMISSION SYSTEM
-- Database Schema for University Applications
-- =====================================================

-- UNIVERSITIES TABLE
CREATE TABLE IF NOT EXISTS universities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    name_bn VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    code VARCHAR(20) NOT NULL UNIQUE,
    type ENUM('General', 'Engineering', 'Medical', 'Agricultural', 'Science & Technology', 'Public', 'Private', 'National') DEFAULT 'General',
    location VARCHAR(100),
    website VARCHAR(200),
    logo_url VARCHAR(300),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ADMISSION POSTS TABLE (University Admission Circulars)
CREATE TABLE IF NOT EXISTS admission_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    university_id INT NOT NULL,
    session VARCHAR(20) NOT NULL,
    unit_code VARCHAR(20) NOT NULL,
    unit_name VARCHAR(100) NOT NULL,
    unit_description TEXT,
    
    -- Eligibility Requirements
    min_gpa DECIMAL(3,2) NOT NULL DEFAULT 3.50,
    min_gpa_science DECIMAL(3,2),
    min_gpa_english DECIMAL(3,2),
    required_group ENUM('Science', 'Commerce', 'Arts', 'Any') DEFAULT 'Any',
    
    -- Fees & Dates
    application_fee DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    exam_date DATE,
    result_date DATE,
    
    -- Capacity
    total_seats INT,
    
    -- Status
    status ENUM('Upcoming', 'Active', 'Closed', 'Cancelled') DEFAULT 'Upcoming',
    
    -- Additional Requirements (JSON)
    requirements TEXT,
    instructions TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE
);

-- UNIVERSITY APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS university_applications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    application_id VARCHAR(30) NOT NULL UNIQUE,
    admission_post_id INT NOT NULL,
    
    -- HSC Information (from hsc_results table)
    hsc_roll VARCHAR(20) NOT NULL,
    hsc_reg VARCHAR(30),
    hsc_year YEAR NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100),
    mother_name VARCHAR(100),
    date_of_birth DATE,
    hsc_gpa DECIMAL(3,2) NOT NULL,
    hsc_group VARCHAR(20),
    hsc_board VARCHAR(50),
    hsc_institution VARCHAR(200),
    
    -- Contact Information
    mobile VARCHAR(15) NOT NULL,
    email VARCHAR(100),
    present_address TEXT,
    
    -- Payment Information
    payment_status ENUM('Pending', 'Paid', 'Failed', 'Refunded') DEFAULT 'Pending',
    payment_id VARCHAR(100),
    payment_amount DECIMAL(10,2),
    payment_date DATETIME,
    payment_method VARCHAR(50),
    
    -- Application Status
    application_status ENUM('Draft', 'Submitted', 'Verified', 'Rejected', 'Cancelled') DEFAULT 'Draft',
    rejection_reason TEXT,
    verified_by INT,
    verified_at DATETIME,
    
    -- Exam Details (if applicable)
    admit_card_generated BOOLEAN DEFAULT FALSE,
    exam_roll VARCHAR(20),
    exam_center VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (admission_post_id) REFERENCES admission_posts(id) ON DELETE RESTRICT,
    UNIQUE KEY unique_application (admission_post_id, hsc_roll, hsc_year)
);

-- INDEXES
CREATE INDEX idx_admission_posts_status ON admission_posts(status);
CREATE INDEX idx_admission_posts_dates ON admission_posts(start_date, end_date);
CREATE INDEX idx_applications_hsc ON university_applications(hsc_roll, hsc_year);
CREATE INDEX idx_applications_status ON university_applications(application_status);
CREATE INDEX idx_applications_payment ON university_applications(payment_status);

-- SAMPLE DATA: UNIVERSITIES
INSERT INTO universities (name, name_bn, code, type, location, website) VALUES
('University of Dhaka', 'ঢাকা বিশ্ববিদ্যালয়', 'DU', 'General', 'Dhaka', 'https://www.du.ac.bd'),
('Bangladesh University of Engineering and Technology', 'বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয়', 'BUET', 'Engineering', 'Dhaka', 'https://www.buet.ac.bd'),
('Dhaka Medical College', 'ঢাকা মেডিকেল কলেজ', 'DMC', 'Medical', 'Dhaka', 'https://www.dmc.edu.bd'),
('Jahangirnagar University', 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়', 'JU', 'General', 'Savar, Dhaka', 'https://www.juniv.edu'),
('Rajshahi University', 'রাজশাহী বিশ্ববিদ্যালয়', 'RU', 'General', 'Rajshahi', 'https://www.ru.ac.bd'),
('Chittagong University', 'চট্টগ্রাম বিশ্ববিদ্যালয়', 'CU', 'General', 'Chittagong', 'https://www.cu.ac.bd'),
('Bangladesh Agricultural University', 'বাংলাদেশ কৃষি বিশ্ববিদ্যালয়', 'BAU', 'Agricultural', 'Mymensingh', 'https://www.bau.edu.bd'),
('Shahjalal University of Science and Technology', 'শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SUST', 'Science & Technology', 'Sylhet', 'https://www.sust.edu'),
('Khulna University', 'খুলনা বিশ্ববিদ্যালয়', 'KU', 'General', 'Khulna', 'https://www.ku.ac.bd'),
('Chittagong Medical College', 'চট্টগ্রাম মেডিকেল কলেজ', 'CMC', 'Medical', 'Chittagong', 'https://www.cmc.edu.bd');

-- SAMPLE DATA: ADMISSION POSTS (2024-2025 Session)

-- University of Dhaka - General Units
INSERT INTO admission_posts (university_id, session, unit_code, unit_name, unit_description, min_gpa, required_group, application_fee, start_date, end_date, exam_date, total_seats, status) VALUES
(1, '2024-2025', 'A', 'Science Unit (ক ইউনিট)', 'Science Faculty Admission', 4.50, 'Science', 1200.00, '2024-06-01', '2024-06-30', '2024-07-15', 3500, 'Active'),
(1, '2024-2025', 'B', 'Arts Unit (খ ইউনিট)', 'Arts & Humanities Faculty Admission', 4.00, 'Any', 1200.00, '2024-06-01', '2024-06-30', '2024-07-16', 4000, 'Active'),
(1, '2024-2025', 'C', 'Commerce Unit (গ ইউনিট)', 'Business Studies Faculty Admission', 4.00, 'Commerce', 1200.00, '2024-06-01', '2024-06-30', '2024-07-17', 2500, 'Active'),
(1, '2024-2025', 'D', 'Change Unit (ঘ ইউনিট)', 'Faculty Change Admission', 3.50, 'Any', 1200.00, '2024-06-01', '2024-06-30', '2024-07-18', 1500, 'Active');

-- BUET - Engineering
INSERT INTO admission_posts (university_id, session, unit_code, unit_name, unit_description, min_gpa, min_gpa_science, required_group, application_fee, start_date, end_date, exam_date, total_seats, status) VALUES
(2, '2024-2025', 'ENG', 'Engineering Admission', 'Bachelor of Science in Engineering', 5.00, 4.00, 'Science', 1500.00, '2024-05-15', '2024-06-15', '2024-06-30', 1200, 'Active');

-- Dhaka Medical College - Medical
INSERT INTO admission_posts (university_id, session, unit_code, unit_name, unit_description, min_gpa, min_gpa_science, required_group, application_fee, start_date, end_date, exam_date, total_seats, status) VALUES
(3, '2024-2025', 'MED', 'Medical Admission', 'MBBS Admission', 5.00, 4.50, 'Science', 1000.00, '2024-05-01', '2024-05-31', '2024-06-20', 200, 'Active');

-- Jahangirnagar University
INSERT INTO admission_posts (university_id, session, unit_code, unit_name, unit_description, min_gpa, required_group, application_fee, start_date, end_date, exam_date, total_seats, status) VALUES
(4, '2024-2025', 'A', 'Science Unit', 'Mathematical & Physical Sciences', 4.00, 'Science', 1000.00, '2024-06-10', '2024-07-10', '2024-07-25', 1800, 'Active'),
(4, '2024-2025', 'B', 'Arts Unit', 'Social Sciences & Humanities', 3.50, 'Any', 1000.00, '2024-06-10', '2024-07-10', '2024-07-26', 2000, 'Active');

-- SUST
INSERT INTO admission_posts (university_id, session, unit_code, unit_name, unit_description, min_gpa, required_group, application_fee, start_date, end_date, exam_date, total_seats, status) VALUES
(8, '2024-2025', 'A', 'Science & Engineering', 'Engineering and Applied Sciences', 4.50, 'Science', 1100.00, '2024-06-05', '2024-07-05', '2024-07-20', 1500, 'Active'),
(8, '2024-2025', 'B', 'Social Science', 'Social Science and Business', 4.00, 'Any', 1100.00, '2024-06-05', '2024-07-05', '2024-07-21', 1200, 'Active');
