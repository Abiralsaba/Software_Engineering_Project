-- =====================================================
-- সরকারি বিজ্ঞপ্তি (Government Notices) Table Schema
-- গণপ্রজাতন্ত্রী বাংলাদেশ সরকার
-- =====================================================

DROP TABLE IF EXISTS govt_notices;

CREATE TABLE IF NOT EXISTS govt_notices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL COMMENT 'Notice title in English',
    title_bn VARCHAR(500) DEFAULT NULL COMMENT 'Notice title in Bangla',
    department VARCHAR(200) NOT NULL COMMENT 'Issuing ministry/department',
    category ENUM('General', 'Urgent', 'Circular', 'Tender', 'Recruitment') DEFAULT 'General',
    priority ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',
    content TEXT NOT NULL COMMENT 'Full notice content',
    reference_no VARCHAR(100) DEFAULT NULL COMMENT 'Government reference/memo number',
    publish_date DATE NOT NULL,
    expiry_date DATE DEFAULT NULL,
    attachment_url VARCHAR(500) DEFAULT NULL,
    status ENUM('Published', 'Draft', 'Expired') DEFAULT 'Published',
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status (status),
    INDEX idx_category (category),
    INDEX idx_department (department),
    INDEX idx_priority (priority),
    INDEX idx_publish_date (publish_date),
    INDEX idx_created_by (created_by),

    CONSTRAINT fk_notice_admin FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Sample Data — Realistic Bangladesh Government Notices
-- created_by = 1 (Admin: Abir)
-- =====================================================

INSERT INTO govt_notices (title, title_bn, department, category, priority, content, reference_no, publish_date, expiry_date, status, created_by) VALUES

-- 1. Urgent
('National Budget 2026-2027 Implementation Guidelines', 
 'জাতীয় বাজেট ২০২৬-২০২৭ বাস্তবায়ন নির্দেশিকা', 
 'Ministry of Finance', 'Urgent', 'High',
 'All ministries and divisions are directed to submit their revised budget estimates for the fiscal year 2026-2027 by 28th February 2026. The budget circular emphasizes fiscal discipline, prioritization of development projects, and efficient resource allocation. Detailed guidelines for budget preparation, including expenditure ceilings and revenue projections, are attached herewith. Non-compliance may result in budgetary allocation adjustments.',
 'MOF/BUD/2026/001', '2026-01-15', '2026-03-01', 'Published', 1),

-- 2. Recruitment
('41st BCS Preliminary Examination Schedule', 
 '৪১তম বিসিএস প্রিলিমিনারি পরীক্ষার সময়সূচি', 
 'Bangladesh Public Service Commission', 'Recruitment', 'High',
 'Bangladesh Public Service Commission announces the schedule for the 41st BCS Preliminary Examination. The examination will be held on 15th March 2026 at designated centers across all divisions. Admit cards can be downloaded from bpsc.gov.bd from 1st March 2026. Candidates are advised to review the updated syllabus and bring valid photo identification. Any attempt at unfair means will result in immediate disqualification.',
 'BPSC/BCS-41/2026/PRE', '2026-01-20', '2026-03-15', 'Published', 1),

-- 3. Tender
('Construction of Padma Bridge Northern Approach Road Extension',
 'পদ্মা সেতু উত্তর প্রান্তের সংযোগ সড়ক সম্প্রসারণ নির্মাণ',
 'Ministry of Land', 'Tender', 'Medium',
 'Sealed tenders are invited from eligible contractors for the construction of the northern approach road extension of Padma Bridge (Package-3B). Estimated cost: BDT 850 crore. Pre-qualification documents can be collected from the Roads and Highways Department, Setu Bhaban, Dhaka from 1st February 2026. Last date for submission: 28th February 2026 by 3:00 PM. Technical evaluation will follow as per PPR 2008.',
 'RHD/PADMA/TND/2026/003B', '2026-01-18', '2026-02-28', 'Published', 1),

-- 4. Circular
('Digital Bangladesh: Mandatory e-Filing for All Government Offices',
 'ডিজিটাল বাংলাদেশ: সকল সরকারি অফিসে ই-ফাইলিং বাধ্যতামূলক',
 'ICT Division', 'Circular', 'High',
 'In accordance with the Digital Bangladesh Vision and the ICT Act 2006 (amended 2013), all government offices including divisions, districts, and upazila levels are hereby directed to implement the National e-Filing System (NeFS) by 30th June 2026. Training sessions will be conducted at divisional headquarters starting February 2026. All official correspondence must transition to digital format. The a2i Programme will provide technical support.',
 'ICTD/DIG/CIR/2026/012', '2026-02-01', '2026-06-30', 'Published', 1),

-- 5. General
('Public Holiday Notice: Shaheed Dibos & International Mother Language Day',
 'সরকারি ছুটির বিজ্ঞপ্তি: শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস',
 'Cabinet Division', 'General', 'Medium',
 'The Government of the People''s Republic of Bangladesh declares 21st February 2026 (Saturday) as a public holiday on the occasion of Shaheed Dibos and International Mother Language Day. All government offices, educational institutions, and financial institutions shall remain closed. The national flag shall be hoisted at half-mast. Floral tributes shall be laid at the Central Shaheed Minar at midnight.',
 'CD/HOL/2026/021', '2026-02-05', NULL, 'Published', 1),

-- 6. Recruitment
('Recruitment of Primary School Assistant Teachers - 2026',
 'প্রাথমিক বিদ্যালয় সহকারী শিক্ষক নিয়োগ - ২০২৬',
 'Ministry of Education', 'Recruitment', 'High',
 'Directorate of Primary Education (DPE) announces recruitment for 15,000 Assistant Teacher positions across all divisions. Minimum qualification: Bachelor''s degree with B.Ed/C-in-Ed. Age limit: 18-30 years (relaxable for freedom fighters'' children). Online application deadline: 15th March 2026. Written examination tentatively scheduled for April 2026. Apply at dpe.gov.bd. Application fee: BDT 200 via mobile banking.',
 'DPE/RECRUIT/2026/AT', '2026-01-25', '2026-03-15', 'Published', 1),

-- 7. Urgent
('Flood Warning: North-Eastern Region Alert Level Raised',
 'বন্যা সতর্কতা: উত্তর-পূর্বাঞ্চলে সতর্কতা স্তর বৃদ্ধি',
 'Ministry of Disaster Management', 'Urgent', 'High',
 'The Flood Forecasting and Warning Centre (FFWC) has raised the alert level for Sylhet, Sunamganj, and Netrokona districts to DANGER level. Water levels in the Surma and Kushiyara rivers are rising rapidly. All District Commissioners and Upazila Nirbahi Officers in affected areas are directed to activate emergency response teams. Relief materials to be pre-positioned. Evacuation centers to be prepared. Citizens are advised to move to higher ground.',
 'DDM/FLOOD/2026/ALERT-07', '2026-02-08', '2026-02-20', 'Published', 1),

-- 8. Tender
('Supply of Medical Equipment for Upazila Health Complexes',
 'উপজেলা স্বাস্থ্য কমপ্লেক্সে চিকিৎসা সরঞ্জাম সরবরাহ',
 'Ministry of Health', 'Tender', 'Medium',
 'The Directorate General of Health Services (DGHS) invites tenders for supply, installation, and commissioning of medical equipment for 150 Upazila Health Complexes across Bangladesh. Equipment includes: digital X-ray machines, ultrasound machines, ECG machines, and laboratory equipment. Tender documents available from DGHS Procurement Cell, Mohakhali, Dhaka. Tender submission deadline: 20th March 2026.',
 'DGHS/PROC/TND/2026/MED-08', '2026-02-01', '2026-03-20', 'Published', 1),

-- 9. Circular
('Revised Pay Scale Implementation for Government Employees',
 'সরকারি কর্মচারীদের সংশোধিত বেতন স্কেল বাস্তবায়ন',
 'Ministry of Public Administration', 'Circular', 'High',
 'In pursuance of the Government decision, the revised National Pay Scale 2026 shall come into effect from 1st July 2026. All ministries, divisions, departments, and autonomous bodies are directed to prepare revised pay fixation statements for their employees. Arrears calculation from January 2026 to June 2026 shall be processed in three installments. The Finance Division will issue detailed instructions regarding budgetary provisions.',
 'MOPA/PAY/CIR/2026/001', '2026-02-10', NULL, 'Published', 1),

-- 10. General
('Annual Confidential Report (ACR) Submission Deadline',
 'বার্ষিক গোপনীয় প্রতিবেদন (এসিআর) জমাদানের সময়সীমা',
 'Ministry of Public Administration', 'General', 'Low',
 'All controlling officers are reminded that the Annual Confidential Reports (ACR) for the year 2025 must be completed and submitted to the Ministry of Public Administration by 31st March 2026. Officers who fail to submit ACRs within the stipulated time will face administrative action. Guidelines for online ACR submission through the PMIS portal are available at mopa.gov.bd.',
 'MOPA/ACR/2026/GEN', '2026-01-10', '2026-03-31', 'Published', 1);
