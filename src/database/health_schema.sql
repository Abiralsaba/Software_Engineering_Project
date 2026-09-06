-- =============================================
-- স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়
-- Ministry of Health and Family Welfare
-- Health Module Database Schema
-- =============================================

-- Drop existing tables if any (in reverse dependency order)
DROP TABLE IF EXISTS health_complaints;
DROP TABLE IF EXISTS health_ambulance_requests;
DROP TABLE IF EXISTS health_appointments;
DROP TABLE IF EXISTS health_vaccinations;
DROP TABLE IF EXISTS health_hospitals;
DROP TABLE IF EXISTS health_cards;

-- 1. Health Cards (ডিজিটাল স্বাস্থ্য কার্ড)
CREATE TABLE IF NOT EXISTS health_cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    card_number VARCHAR(20) UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    father_name VARCHAR(150),
    mother_name VARCHAR(150),
    nid_number VARCHAR(20) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender ENUM('Male','Female','Other') NOT NULL,
    blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') DEFAULT NULL,
    phone VARCHAR(15) NOT NULL,
    emergency_contact VARCHAR(15),
    division VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    upazila VARCHAR(80) NOT NULL,
    address TEXT,
    allergies TEXT,
    chronic_diseases TEXT,
    disability ENUM('None','Physical','Visual','Hearing','Intellectual','Multiple') DEFAULT 'None',
    status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
    admin_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Vaccination Records (টিকাদান)
CREATE TABLE IF NOT EXISTS health_vaccinations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    health_card_id INT DEFAULT NULL,
    vaccine_name VARCHAR(100) NOT NULL,
    vaccine_type ENUM('COVID-19','Hepatitis B','BCG','Polio','DPT','Measles','TT','Pneumococcal','Influenza','Rabies','Typhoid','Cholera','Other') NOT NULL,
    dose_number INT DEFAULT 1,
    vaccination_date DATE DEFAULT NULL,
    vaccination_center VARCHAR(200),
    batch_number VARCHAR(50),
    administered_by VARCHAR(100),
    next_dose_date DATE DEFAULT NULL,
    side_effects TEXT,
    certificate_number VARCHAR(50),
    status ENUM('Registered','Scheduled','Completed','Cancelled') DEFAULT 'Registered',
    admin_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    FOREIGN KEY (health_card_id) REFERENCES health_cards(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Hospitals Directory (সরকারি হাসপাতাল)
CREATE TABLE IF NOT EXISTS health_hospitals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    name_bn VARCHAR(200),
    hospital_type ENUM('Medical College','District Hospital','Upazila Health Complex','Union Sub-Center','Specialized Hospital','Community Clinic','Private Hospital') NOT NULL,
    division VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    upazila VARCHAR(80),
    address TEXT,
    phone VARCHAR(20),
    emergency_phone VARCHAR(20),
    email VARCHAR(100),
    total_beds INT DEFAULT 0,
    icu_beds INT DEFAULT 0,
    available_beds INT DEFAULT 0,
    available_icu_beds INT DEFAULT 0,
    departments TEXT,
    facilities TEXT,
    ambulance_available TINYINT(1) DEFAULT 0,
    blood_bank TINYINT(1) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Medical Appointments (ডাক্তার অ্যাপয়েন্টমেন্ট)
CREATE TABLE IF NOT EXISTS health_appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    hospital_id INT DEFAULT NULL,
    patient_name VARCHAR(150) NOT NULL,
    patient_age INT,
    patient_gender ENUM('Male','Female','Other'),
    phone VARCHAR(15) NOT NULL,
    department ENUM('Medicine','Surgery','Gynecology','Pediatrics','Orthopedics','ENT','Eye','Dermatology','Cardiology','Neurology','Psychiatry','Dental','Emergency','Other') NOT NULL,
    doctor_name VARCHAR(150),
    appointment_date DATE NOT NULL,
    appointment_time VARCHAR(20),
    symptoms TEXT,
    urgency ENUM('Normal','Urgent','Emergency') DEFAULT 'Normal',
    status ENUM('Pending','Confirmed','Completed','Cancelled','No Show') DEFAULT 'Pending',
    prescription TEXT,
    admin_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES health_hospitals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Ambulance Requests (অ্যাম্বুলেন্স সেবা)
CREATE TABLE IF NOT EXISTS health_ambulance_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    patient_name VARCHAR(150) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    emergency_type ENUM('Accident','Heart Attack','Stroke','Pregnancy','Burns','Breathing Difficulty','Unconscious','Other') NOT NULL,
    pickup_address TEXT NOT NULL,
    destination_hospital VARCHAR(200),
    division VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    urgency ENUM('Normal','Urgent','Critical') DEFAULT 'Urgent',
    ambulance_type ENUM('Basic','Advanced','ICU') DEFAULT 'Basic',
    status ENUM('Requested','Dispatched','En Route','Arrived','Completed','Cancelled') DEFAULT 'Requested',
    driver_name VARCHAR(100),
    driver_phone VARCHAR(15),
    vehicle_number VARCHAR(30),
    estimated_arrival VARCHAR(20),
    admin_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Health Complaints (অভিযোগ)
CREATE TABLE IF NOT EXISTS health_complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    complaint_type ENUM('Hospital Service','Doctor Conduct','Medicine Quality','Ambulance Delay','Corruption','Unsanitary Conditions','Staff Behavior','Other') NOT NULL,
    hospital_name VARCHAR(200),
    description TEXT NOT NULL,
    division VARCHAR(50),
    district VARCHAR(50),
    status ENUM('Submitted','Under Review','Resolved','Rejected') DEFAULT 'Submitted',
    resolution TEXT,
    admin_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES reg_info(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============ INSERT SAMPLE HOSPITALS ============
INSERT INTO health_hospitals (name, name_bn, hospital_type, division, district, upazila, phone, emergency_phone, total_beds, icu_beds, available_beds, available_icu_beds, departments, ambulance_available, blood_bank) VALUES
('Dhaka Medical College Hospital', 'ঢাকা মেডিকেল কলেজ হাসপাতাল', 'Medical College', 'Dhaka', 'Dhaka', 'Dhaka Sadar', '02-55165001', '999', 2600, 50, 120, 5, 'Medicine,Surgery,Gynecology,Pediatrics,Orthopedics,ENT,Eye,Cardiology,Neurology,Emergency', 1, 1),
('Sir Salimullah Medical College & Mitford Hospital', 'স্যার সলিমুল্লাহ মেডিকেল কলেজ ও মিটফোর্ড হাসপাতাল', 'Medical College', 'Dhaka', 'Dhaka', 'Dhaka Sadar', '02-7319002', '999', 1200, 20, 45, 3, 'Medicine,Surgery,Gynecology,Pediatrics,Orthopedics,ENT,Eye,Emergency', 1, 1),
('Chittagong Medical College Hospital', 'চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল', 'Medical College', 'Chittagong', 'Chittagong', 'Chittagong Sadar', '031-636751', '999', 1550, 30, 78, 4, 'Medicine,Surgery,Gynecology,Pediatrics,Orthopedics,Cardiology,Emergency', 1, 1),
('Rajshahi Medical College Hospital', 'রাজশাহী মেডিকেল কলেজ হাসপাতাল', 'Medical College', 'Rajshahi', 'Rajshahi', 'Rajshahi Sadar', '0721-772150', '999', 1100, 25, 60, 3, 'Medicine,Surgery,Gynecology,Pediatrics,Orthopedics,Emergency', 1, 1),
('Sylhet MAG Osmani Medical College Hospital', 'সিলেট এমএজি ওসমানী মেডিকেল কলেজ', 'Medical College', 'Sylhet', 'Sylhet', 'Sylhet Sadar', '0821-716981', '999', 1000, 20, 55, 2, 'Medicine,Surgery,Gynecology,Pediatrics,Emergency', 1, 1),
('Khulna Medical College Hospital', 'খুলনা মেডিকেল কলেজ হাসপাতাল', 'Medical College', 'Khulna', 'Khulna', 'Khulna Sadar', '041-720054', '999', 1000, 18, 48, 2, 'Medicine,Surgery,Gynecology,Pediatrics,Emergency', 1, 1),
('Rangpur Medical College Hospital', 'রংপুর মেডিকেল কলেজ হাসপাতাল', 'Medical College', 'Rangpur', 'Rangpur', 'Rangpur Sadar', '0521-63051', '999', 800, 15, 40, 2, 'Medicine,Surgery,Gynecology,Pediatrics,Emergency', 1, 1),
('Barishal Sher-E-Bangla Medical College Hospital', 'বরিশাল শেরেবাংলা মেডিকেল কলেজ', 'Medical College', 'Barishal', 'Barishal', 'Barishal Sadar', '0431-62109', '999', 750, 12, 35, 2, 'Medicine,Surgery,Gynecology,Pediatrics,Emergency', 1, 1),
('Mymensingh Medical College Hospital', 'ময়মনসিংহ মেডিকেল কলেজ হাসপাতাল', 'Medical College', 'Mymensingh', 'Mymensingh', 'Mymensingh Sadar', '091-66401', '999', 850, 14, 38, 2, 'Medicine,Surgery,Gynecology,Pediatrics,Emergency', 1, 1),
('National Institute of Cardiovascular Diseases (NICVD)', 'জাতীয় হৃদরোগ ইনস্টিটিউট', 'Specialized Hospital', 'Dhaka', 'Dhaka', 'Dhaka Sadar', '02-9116651', '999', 400, 40, 12, 3, 'Cardiology,Cardiac Surgery,Emergency', 1, 1),
('Bangabandhu Sheikh Mujib Medical University (BSMMU)', 'বঙ্গবন্ধু শেখ মুজিব মেডিকেল বিশ্ববিদ্যালয়', 'Specialized Hospital', 'Dhaka', 'Dhaka', 'Dhaka Sadar', '02-8614001', '999', 1900, 60, 90, 8, 'Medicine,Surgery,Gynecology,Pediatrics,Orthopedics,ENT,Eye,Cardiology,Neurology,Dermatology,Psychiatry,Dental,Emergency', 1, 1),
('National Institute of Mental Health (NIMH)', 'জাতীয় মানসিক স্বাস্থ্য ইনস্টিটিউট', 'Specialized Hospital', 'Dhaka', 'Dhaka', 'Dhaka Sadar', '02-9116551', '999', 200, 5, 20, 1, 'Psychiatry,Neurology', 0, 0);
