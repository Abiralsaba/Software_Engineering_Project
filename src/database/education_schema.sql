-- =====================================================
-- BANGLADESH EDUCATION RESULTS SYSTEM
-- Database Schema for JSC, SSC, HSC Examinations
-- Following Bangladesh Education Board Standards
-- =====================================================

-- Education Boards Table
CREATE TABLE IF NOT EXISTS education_boards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Bangladesh Education Boards
INSERT IGNORE INTO education_boards (code, name) VALUES
('DHK', 'Dhaka Board'),
('CTG', 'Chittagong Board'),
('RAJ', 'Rajshahi Board'),
('JES', 'Jessore Board'),
('COM', 'Comilla Board'),
('SYL', 'Sylhet Board'),
('DIN', 'Dinajpur Board'),
('BAR', 'Barisal Board'),
('MYM', 'Mymensingh Board'),
('MAD', 'Madrasah Board'),
('TEC', 'Technical Board');

-- =====================================================
-- JSC RESULTS TABLE (Junior School Certificate - Class 8)
-- Subjects: 7 Core Subjects
-- =====================================================
CREATE TABLE IF NOT EXISTS jsc_results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    roll_number VARCHAR(20) NOT NULL,
    registration_number VARCHAR(30),
    exam_year YEAR NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100),
    mother_name VARCHAR(100),
    date_of_birth DATE,
    institution_name VARCHAR(200),
    board_id INT,
    
    -- Subject Grades (A+, A, A-, B, C, D, F)
    bangla VARCHAR(5),
    english VARCHAR(5),
    mathematics VARCHAR(5),
    general_science VARCHAR(5),
    bangladesh_global_studies VARCHAR(5),
    religion VARCHAR(5),
    ict VARCHAR(5),
    
    -- Results
    gpa DECIMAL(3,2),
    result_status ENUM('Passed', 'Failed', 'Withheld') DEFAULT 'Passed',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_jsc_result (roll_number, exam_year),
    FOREIGN KEY (board_id) REFERENCES education_boards(id)
);

-- =====================================================
-- SSC RESULTS TABLE (Secondary School Certificate - Class 10)
-- Science Group - 12 Subjects
-- =====================================================
CREATE TABLE IF NOT EXISTS ssc_results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    roll_number VARCHAR(20) NOT NULL,
    registration_number VARCHAR(30),
    exam_year YEAR NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100),
    mother_name VARCHAR(100),
    date_of_birth DATE,
    institution_name VARCHAR(200),
    board_id INT,
    exam_group ENUM('Science', 'Commerce', 'Arts') DEFAULT 'Science',
    
    -- Compulsory Subject Grades
    bangla_1st VARCHAR(5),
    bangla_2nd VARCHAR(5),
    english_1st VARCHAR(5),
    english_2nd VARCHAR(5),
    mathematics VARCHAR(5),
    religion VARCHAR(5),
    ict VARCHAR(5),
    
    -- Science Group Subjects
    physics VARCHAR(5),
    chemistry VARCHAR(5),
    biology VARCHAR(5),
    higher_math VARCHAR(5),
    
    -- General Subjects
    bangladesh_global_studies VARCHAR(5),
    
    -- Results
    gpa DECIMAL(3,2),
    result_status ENUM('Passed', 'Failed', 'Withheld') DEFAULT 'Passed',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_ssc_result (roll_number, exam_year),
    FOREIGN KEY (board_id) REFERENCES education_boards(id)
);

-- =====================================================
-- HSC RESULTS TABLE (Higher Secondary Certificate - Class 12)
-- Science Group - 9+ Subjects
-- =====================================================
CREATE TABLE IF NOT EXISTS hsc_results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    roll_number VARCHAR(20) NOT NULL,
    registration_number VARCHAR(30),
    exam_year YEAR NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100),
    mother_name VARCHAR(100),
    date_of_birth DATE,
    institution_name VARCHAR(200),
    board_id INT,
    exam_group ENUM('Science', 'Commerce', 'Arts') DEFAULT 'Science',
    
    -- Compulsory Subject Grades
    bangla_1st VARCHAR(5),
    bangla_2nd VARCHAR(5),
    english_1st VARCHAR(5),
    english_2nd VARCHAR(5),
    ict VARCHAR(5),
    
    -- Science Group Core Subjects
    physics_1st VARCHAR(5),
    physics_2nd VARCHAR(5),
    chemistry_1st VARCHAR(5),
    chemistry_2nd VARCHAR(5),
    
    -- Elective (Biology OR Higher Math)
    biology_1st VARCHAR(5),
    biology_2nd VARCHAR(5),
    higher_math_1st VARCHAR(5),
    higher_math_2nd VARCHAR(5),
    
    -- Optional 4th Subject
    optional_subject_name VARCHAR(50),
    optional_subject_grade VARCHAR(5),
    
    -- Results
    gpa DECIMAL(3,2),
    result_status ENUM('Passed', 'Failed', 'Withheld') DEFAULT 'Passed',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_hsc_result (roll_number, exam_year),
    FOREIGN KEY (board_id) REFERENCES education_boards(id)
);

-- INDEXES FOR FASTER SEARCHES
CREATE INDEX idx_jsc_roll_year ON jsc_results(roll_number, exam_year);
CREATE INDEX idx_jsc_student ON jsc_results(student_name);

CREATE INDEX idx_ssc_roll_year ON ssc_results(roll_number, exam_year);
CREATE INDEX idx_ssc_student ON ssc_results(student_name);

CREATE INDEX idx_hsc_roll_year ON hsc_results(roll_number, exam_year);
CREATE INDEX idx_hsc_student ON hsc_results(student_name);

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- Extended dataset
-- =====================================================

-- Initial JSC Results (2024)
INSERT INTO jsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, bangla, english, mathematics, general_science, bangladesh_global_studies, religion, ict, gpa, result_status)
VALUES 
('123456', 'REG2024001', 2024, 'আহমেদ হাসান', 'মোঃ করিম', 'ফাতেমা বেগম', 'Government Laboratory High School', 1, 'A+', 'A', 'A+', 'A', 'A-', 'A', 'A+', 4.86, 'Passed'),
('123457', 'REG2024002', 2024, 'ফাতিমা আক্তার', 'মোঃ রহিম', 'আয়েশা খাতুন', 'Viqarunnisa Noon School & College', 1, 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed');

-- Initial SSC Results (2024)
INSERT INTO ssc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group, bangla_1st, bangla_2nd, english_1st, english_2nd, mathematics, physics, chemistry, biology, higher_math, bangladesh_global_studies, religion, ict, gpa, result_status)
VALUES 
('234567', 'SREG2024001', 2024, 'রাফি উদ্দিন', 'আব্দুল করিম', 'সালমা বেগম', 'Rajuk Uttara Model College', 1, 'Science', 'A+', 'A', 'A+', 'A', 'A+', 'A+', 'A', 'A+', 'A', 'A-', 'A', 'A+', 4.82, 'Passed'),
('234568', 'SREG2024002', 2024, 'তানজিনা আক্তার', 'মোঃ জামাল', 'রুবিনা আক্তার', 'Holy Cross College', 1, 'Science', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed');

-- Initial HSC Results (2024)
INSERT INTO hsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group, bangla_1st, bangla_2nd, english_1st, english_2nd, physics_1st, physics_2nd, chemistry_1st, chemistry_2nd, biology_1st, biology_2nd, ict, gpa, result_status)
VALUES 
('345678', 'HREG2024001', 2024, 'সাকিব আল হাসান', 'মোঃ আলম', 'নাজমা বেগম', 'Notre Dame College', 1, 'Science', 'A+', 'A', 'A+', 'A', 'A+', 'A+', 'A', 'A+', 'A+', 'A', 'A+', 4.91, 'Passed'),
('345679', 'HREG2024002', 2024, 'নুসরাত জাহান', 'মোঃ হানিফ', 'শাহানা পারভীন', 'Viqarunnisa Noon School & College', 1, 'Science', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed');

-- EXTENDED JSC RESULTS - Multiple Years, Multiple Boards

-- 2024 - Dhaka Board (Additional)
INSERT INTO jsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, bangla, english, mathematics, general_science, bangladesh_global_studies, religion, ict, gpa, result_status) VALUES
('124001', 'JSC2024D001', 2024, 'সাকিব হোসেন', 'নাসির হোসেন', 'ফাতেমা বেগম', 'Rajuk Uttara Model College', 1, 'A+', 'A', 'A+', 'A', 'A+', 'A', 'A+', 4.93, 'Passed'),
('124002', 'JSC2024D002', 2024, 'নুসরাত তানজিন', 'কামাল হাসান', 'সালমা খাতুন', 'Viqarunnisa Noon School & College', 1, 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed'),
('124003', 'JSC2024D003', 2024, 'আরিফ রহমান', 'আব্দুল রহমান', 'রহিমা বেগম', 'Ideal School and College', 1, 'A', 'A-', 'A+', 'A', 'A', 'A+', 'A', 4.64, 'Passed'),
('124004', 'JSC2024D004', 2024, 'মেহেরুন নেসা', 'জহির উদ্দিন', 'আমেনা আক্তার', 'Government Laboratory High School', 1, 'A+', 'A', 'A', 'A+', 'A', 'A+', 'A+', 4.79, 'Passed'),
('124005', 'JSC2024D005', 2024, 'রাফি আহমেদ', 'আমজাদ আলী', 'নাজমা সুলতানা', 'Dhaka Residential Model College', 1, 'A-', 'B', 'A', 'A-', 'A', 'A', 'A-', 4.07, 'Passed');

-- 2024 - Chittagong Board
INSERT INTO jsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, bangla, english, mathematics, general_science, bangladesh_global_studies, religion, ict, gpa, result_status) VALUES
('224001', 'JSC2024C001', 2024, 'তানভীর হোসেন', 'মনির হোসেন', 'হাসিনা আক্তার', 'Chittagong College', 2, 'A+', 'A+', 'A', 'A+', 'A', 'A+', 'A+', 4.86, 'Passed'),
('224002', 'JSC2024C002', 2024, 'মারিয়া আক্তার', 'শফিক উদ্দিন', 'শাহনাজ বেগম', 'Faujdarhat Cadet College', 2, 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed'),
('224003', 'JSC2024C003', 2024, 'আব্দুল্লাহ আল মামুন', 'আসাদুল্লাহ', 'মর্জিনা বেগম', 'Chittagong Collegiate School', 2, 'A', 'A', 'A-', 'A', 'A', 'A', 'A', 4.50, 'Passed');

-- 2024 - Rajshahi Board
INSERT INTO jsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, bangla, english, mathematics, general_science, bangladesh_global_studies, religion, ict, gpa, result_status) VALUES
('324001', 'JSC2024R001', 2024, 'ফাহিম চৌধুরী', 'আলাউদ্দিন চৌধুরী', 'সুফিয়া খাতুন', 'Rajshahi Collegiate School', 3, 'A+', 'A', 'A+', 'A+', 'A', 'A+', 'A+', 4.93, 'Passed'),
('324002', 'JSC2024R002', 2024, 'সুমাইয়া ইসলাম', 'মোঃ ইসলাম', 'রোজিনা বেগম', 'Rajshahi Cadet College', 3, 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed');

-- 2023 - Dhaka Board (Previous Year)
INSERT INTO jsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, bangla, english, mathematics, general_science, bangladesh_global_studies, religion, ict, gpa, result_status) VALUES
('123101', 'JSC2023D001', 2023, 'আহনাফ তাহমিদ', 'তারেক হাসান', 'নাজমা বেগম', 'Notre Dame College', 1, 'A+', 'A+', 'A+', 'A+', 'A', 'A+', 'A+', 4.93, 'Passed'),
('123102', 'JSC2023D002', 2023, 'সানজিদা আক্তার', 'করিম উদ্দিন', 'জাহানারা বেগম', 'Holy Cross College', 1, 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed'),
('123103', 'JSC2023D003', 2023, 'রাহাত হোসেন', 'জামাল হোসেন', 'পারভীন আক্তার', 'Dhaka College', 1, 'A', 'A', 'A+', 'A-', 'A', 'A', 'A', 4.50, 'Passed'),
('123104', 'JSC2023D004', 2023, 'তাসনিম ফেরদৌস', 'ফেরদৌস আলম', 'শাহানা পারভীন', 'Viqarunnisa Noon School & College', 1, 'A', 'A-', 'B', 'A-', 'A', 'A', 'A-', 4.00, 'Passed'),
('123105', 'JSC2023D005', 2023, 'আরমান হোসেন', 'জাহাঙ্গীর আলম', 'মা বেগম', 'Motijheel Government Boys High School', 1, 'B', 'C', 'D', 'C', 'B', 'A-', 'C', 2.64, 'Passed'),
('123106', 'JSC2023D006', 2023, 'ফারজানা ইসলাম', 'মোঃ ইসলাম', 'হালিমা বেগম', 'Ideal School and College', 1, 'D', 'F', 'D', 'D', 'C', 'C', 'D', 0.00, 'Failed');

-- 2023 - Chittagong Board
INSERT INTO jsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, bangla, english, mathematics, general_science, bangladesh_global_studies, religion, ict, gpa, result_status) VALUES
('223101', 'JSC2023C001', 2023, 'জাহিদ হাসান', 'কাদের মিয়া', 'জোবেদা বেগম', 'Chittagong Government High School', 2, 'A+', 'A', 'A+', 'A+', 'A+', 'A', 'A', 4.79, 'Passed'),
('223102', 'JSC2023C002', 2023, 'প্রিয়া দাস', 'রবি দাস', 'মালা দাস', 'Dr. Khastagir Government Girls High School', 2, 'A+', 'A+', 'A+', 'A', 'A+', 'A+', 'A+', 4.93, 'Passed');

-- 2022 - Multiple Boards
INSERT INTO jsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, bangla, english, mathematics, general_science, bangladesh_global_studies, religion, ict, gpa, result_status) VALUES
('122001', 'JSC2022D001', 2022, 'রায়হান করিম', 'আব্দুল করিম', 'সালমা করিম', 'Rajuk Uttara Model College', 1, 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed'),
('122002', 'JSC2022D002', 2022, 'ফাতিমা জান্নাত', 'হাসান মাহমুদ', 'রুমা বেগম', 'Viqarunnisa Noon School & College', 1, 'A', 'A+', 'A', 'A+', 'A', 'A', 'A+', 4.64, 'Passed'),
('222001', 'JSC2022C001', 2022, 'সাদমান সাকিব', 'রফিক উদ্দিন', 'রাবেয়া বেগম', 'BAF Shaheen College Chittagong', 2, 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed');

-- EXTENDED SSC RESULTS - Multiple Years, Multiple Boards

-- 2024 - Dhaka Board (Additional)
INSERT INTO ssc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group, bangla_1st, bangla_2nd, english_1st, english_2nd, mathematics, physics, chemistry, biology, higher_math, bangladesh_global_studies, religion, ict, gpa, result_status) VALUES
('534001', 'SSC2024D001', 2024, 'তানজিম হোসেন', 'শহিদ হোসেন', 'শামীমা আক্তার', 'Notre Dame College', 1, 'Science', 'A+', 'A+', 'A+', 'A', 'A+', 'A+', 'A+', 'A', 'A+', 'A', 'A+', 'A+', 4.92, 'Passed'),
('534002', 'SSC2024D002', 2024, 'রাফসান জাহান', 'মিজানুর রহমান', 'নাহিদা পারভীন', 'Dhaka College', 1, 'Science', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed'),
('534003', 'SSC2024D003', 2024, 'শারমিন সুলতানা', 'সুলতান আহমেদ', 'রেহানা বেগম', 'Viqarunnisa Noon School & College', 1, 'Science', 'A+', 'A', 'A', 'A+', 'A+', 'A', 'A+', 'A+', 'A', 'A', 'A+', 'A', 4.67, 'Passed'),
('534004', 'SSC2024D004', 2024, 'মোহাম্মদ রাফি', 'আজিজুল হক', 'ছায়েদা বেগম', 'Rajuk Uttara Model College', 1, 'Science', 'A', 'A-', 'A', 'A-', 'A+', 'A', 'A', 'A-', 'A+', 'A', 'A', 'A', 4.33, 'Passed'),
('534005', 'SSC2024D005', 2024, 'নাফিসা ইসলাম', 'কবির হোসেন', 'আনোয়ারা বেগম', 'Holy Cross College', 1, 'Science', 'A-', 'B', 'A-', 'B', 'A', 'B', 'A-', 'C', NULL, 'B', 'A', 'A-', 3.50, 'Passed');

-- 2024 - Chittagong Board
INSERT INTO ssc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group, bangla_1st, bangla_2nd, english_1st, english_2nd, mathematics, physics, chemistry, biology, higher_math, bangladesh_global_studies, religion, ict, gpa, result_status) VALUES
('634001', 'SSC2024C001', 2024, 'আশরাফুল আলম', 'নুরুল আলম', 'মুশতারী বেগম', 'Chittagong College', 2, 'Science', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed'),
('634002', 'SSC2024C002', 2024, 'সবুজ মিয়া', 'জমির উদ্দিন', 'আলেয়া বেগম', 'Faujdarhat Cadet College', 2, 'Science', 'A+', 'A', 'A+', 'A', 'A+', 'A+', 'A', 'A+', 'A+', 'A', 'A+', 'A+', 4.75, 'Passed');

-- 2024 - Sylhet Board
INSERT INTO ssc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group, bangla_1st, bangla_2nd, english_1st, english_2nd, mathematics, physics, chemistry, biology, higher_math, bangladesh_global_studies, religion, ict, gpa, result_status) VALUES
('734001', 'SSC2024S001', 2024, 'সাইমুন হক', 'শামসুল হক', 'নুরুন্নাহার বেগম', 'MC College, Sylhet', 6, 'Science', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed');

-- 2023 - Dhaka Board
INSERT INTO ssc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group, bangla_1st, bangla_2nd, english_1st, english_2nd, mathematics, physics, chemistry, biology, higher_math, bangladesh_global_studies, religion, ict, gpa, result_status) VALUES
('533001', 'SSC2023D001', 2023, 'তাহসিন আহমেদ', 'রাশেদ আহমেদ', 'সাবিনা বেগম', 'Notre Dame College', 1, 'Science', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 5.00, 'Passed'),
('533002', 'SSC2023D002', 2023, 'লামিয়া আক্তার', 'সালাউদ্দিন', 'মাহমুদা আক্তার', 'Viqarunnisa Noon School & College', 1, 'Science', 'A+', 'A', 'A+', 'A', 'A+', 'A', 'A+', 'A+', 'A', 'A', 'A+', 'A', 4.58, 'Passed'),
('533003', 'SSC2023D003', 2023, 'জাকির হোসেন', 'মজিবুর রহমান', 'আসমা বেগম', 'Dhaka College', 1, 'Science', 'A', 'A-', 'A', 'A-', 'A-', 'B', 'A-', 'B', 'A-', 'A-', 'A', 'A-', 3.83, 'Passed'),
('533004', 'SSC2023D004', 2023, 'ফাহমিদা খানম', 'খান মোহাম্মদ', 'রোকেয়া খাতুন', 'Ideal School and College', 1, 'Science', 'B', 'C', 'C', 'D', 'C', 'D', 'D', 'F', NULL, 'C', 'B', 'C', 0.00, 'Failed');

-- EXTENDED HSC RESULTS - Multiple Years, Multiple Boards

-- 2024 - Dhaka Board (Additional)
INSERT INTO hsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group, bangla_1st, bangla_2nd, english_1st, english_2nd, physics_1st, physics_2nd, chemistry_1st, chemistry_2nd, biology_1st, biology_2nd, higher_math_1st, higher_math_2nd, ict, gpa, result_status) VALUES
('845001', 'HSC2024D001', 2024, 'সাদিক রহমান', 'আজমল হোসেন', 'রুবিনা আক্তার', 'Notre Dame College', 1, 'Science', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', NULL, NULL, 'A+', 5.00, 'Passed'),
('845002', 'HSC2024D002', 2024, 'তাসনুভা ইসলাম', 'কামরুল ইসলাম', 'সুমাইয়া বেগম', 'Viqarunnisa Noon School & College', 1, 'Science', 'A+', 'A+', 'A+', 'A', 'A+', 'A', 'A+', 'A+', 'A+', 'A+', NULL, NULL, 'A+', 4.91, 'Passed'),
('845003', 'HSC2024D003', 2024, 'মাহমুদুল হাসান', 'হাসান মাহমুদ', 'শিরিন আক্তার', 'Dhaka College', 1, 'Science', 'A+', 'A', 'A', 'A', 'A+', 'A', 'A', 'A+', NULL, NULL, 'A+', 'A+', 'A+', 4.73, 'Passed'),
('845004', 'HSC2024D004', 2024, 'ফারহানা আক্তার', 'মোস্তাক আহমেদ', 'নাসরীন সুলতানা', 'Holy Cross College', 1, 'Science', 'A', 'A', 'A+', 'A', 'A', 'A-', 'A', 'A', 'A', 'A', NULL, NULL, 'A', 4.36, 'Passed'),
('845005', 'HSC2024D005', 2024, 'আব্দুর রশিদ', 'রশিদুল ইসলাম', 'মোসাম্মৎ আয়েশা', 'Rajuk Uttara Model College', 1, 'Science', 'A-', 'B', 'A-', 'B', 'A', 'A-', 'A-', 'B', 'A-', 'B', NULL, NULL, 'A-', 3.82, 'Passed');

-- 2024 - Chittagong Board
INSERT INTO hsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group, bangla_1st, bangla_2nd, english_1st, english_2nd, physics_1st, physics_2nd, chemistry_1st, chemistry_2nd, biology_1st, biology_2nd, higher_math_1st, higher_math_2nd, ict, gpa, result_status) VALUES
('945001', 'HSC2024C001', 2024, 'রফিকুল ইসলাম', 'মোঃ হানিফ', 'রওশন আরা বেগম', 'Chittagong College', 2, 'Science', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', NULL, NULL, 'A+', 5.00, 'Passed'),
('945002', 'HSC2024C002', 2024, 'পলাশ মিয়া', 'করিম মিয়া', 'জমিলা বেগম', 'Faujdarhat Cadet College', 2, 'Science', 'A+', 'A', 'A+', 'A', 'A+', 'A+', 'A+', 'A', 'A', 'A+', NULL, NULL, 'A+', 4.73, 'Passed');

-- 2024 - Rajshahi Board
INSERT INTO hsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group, bangla_1st, bangla_2nd, english_1st, english_2nd, physics_1st, physics_2nd, chemistry_1st, chemistry_2nd, biology_1st, biology_2nd, higher_math_1st, higher_math_2nd, ict, gpa, result_status) VALUES
('1045001', 'HSC2024R001', 2024, 'জাহিদুল ইসলাম', 'মোখলেসুর রহমান', 'জোবেদা পারভীন', 'Rajshahi College', 3, 'Science', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', NULL, NULL, 'A+', 5.00, 'Passed');

-- 2023 - Dhaka Board
INSERT INTO hsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group, bangla_1st, bangla_2nd, english_1st, english_2nd, physics_1st, physics_2nd, chemistry_1st, chemistry_2nd, biology_1st, biology_2nd, higher_math_1st, higher_math_2nd, ict, gpa, result_status) VALUES
('843001', 'HSC2023D001', 2023, 'মনির হোসেন', 'আব্দুল মান্নান', 'হাসিনা বেগম', 'Notre Dame College', 1, 'Science', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', NULL, NULL, 'A+', 5.00, 'Passed'),
('843002', 'HSC2023D002', 2023, 'সাবিকুন নাহার', 'আবু তাহের', 'মোসাম্মত সালমা', 'Viqarunnisa Noon School & College', 1, 'Science', 'A+', 'A', 'A+', 'A+', 'A+', 'A', 'A', 'A+', 'A+', 'A', NULL, NULL, 'A+', 4.73, 'Passed'),
('843003', 'HSC2023D003', 2023, 'আসিফ ইকবাল', 'ইকবাল হোসেন', 'নাসিমা আক্তার', 'Dhaka College', 1, 'Science', 'A', 'A-', 'A', 'A-', 'A', 'A-', 'A-', 'A', NULL, NULL, 'A', 'A', 'A', 4.27, 'Passed'),
('843004', 'HSC2023D004', 2023, 'রুবাইয়াত জাহান', 'মোহাম্মদ জাহান', 'রওশন জাহান', 'Holy Cross College', 1, 'Science', 'A-', 'B', 'B', 'B', 'A-', 'C', 'B', 'C', 'B', 'C', NULL, NULL, 'B', 2.91, 'Passed'),
('843005', 'HSC2023D005', 2023, 'কামরুল হাসান', 'মোঃ হাসান', 'লাইলা বেগম', 'Rajuk Uttara Model College', 1, 'Science', 'C', 'D', 'D', 'F', 'D', 'D', 'F', 'D', 'D', 'F', NULL, NULL, 'D', 0.00, 'Failed');

-- 2022 - Multiple Boards
INSERT INTO hsc_results (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group, bangla_1st, bangla_2nd, english_1st, english_2nd, physics_1st, physics_2nd, chemistry_1st, chemistry_2nd, biology_1st, biology_2nd, higher_math_1st, higher_math_2nd, ict, gpa, result_status) VALUES
('842001', 'HSC2022D001', 2022, 'শফিকুল ইসলাম', 'মোক্তার হোসেন', 'আম্বিয়া বেগম', 'Notre Dame College', 1, 'Science', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', NULL, NULL, 'A+', 5.00, 'Passed'),
('942001', 'HSC2022C001', 2022, 'সাজিদুর রহমান', 'আব্দুর রহমান', 'খোদেজা বেগম', 'Chittagong College', 2, 'Science', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', 'A+', NULL, NULL, 'A+', 5.00, 'Passed');
