-- Stipend Categories Table
CREATE TABLE IF NOT EXISTS stipends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    type ENUM('Merit', 'Need', 'Disability', 'Research', 'General') NOT NULL,
    min_gpa FLOAT DEFAULT 0,
    max_income DECIMAL(15, 2) DEFAULT NULL,
    deadline DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stipend Applications Table
CREATE TABLE IF NOT EXISTS stipend_applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    stipend_id INT NOT NULL,
    application_no VARCHAR(50) UNIQUE NOT NULL,
    student_details JSON,  -- Snapshot of student profile
    financial_info JSON,   -- Income, Land, Assets
    guardian_info JSON,    -- Parents' occupation, NID
    bank_details JSON,     -- Mobile Banking/Bank Account
    status ENUM('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected') DEFAULT 'Draft',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (stipend_id) REFERENCES stipends(id)
);

-- Seed Initial Data
INSERT INTO stipends (title, description, amount, type, min_gpa, max_income, deadline) VALUES
('Prime Minister''s Education Trust', 'Financial assistance for meritorious students from low-income families.', 5000.00, 'Need', 4.5, 300000.00, '2026-12-31'),
('Excellence in Science Scholarship', 'Award for students securing GPA 5.0 in Science group.', 10000.00, 'Merit', 5.0, NULL, '2026-06-30'),
('Research Grant for Undergraduates', 'Support for innovative research projects.', 25000.00, 'Research', 3.5, NULL, '2026-09-15');
