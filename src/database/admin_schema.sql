-- ==========================================
-- ADMIN AUTHENTICATION SCHEMA
-- Central Government System - Admin Dashboard
-- ==========================================

-- Admin users table with approval workflow
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    mobile VARCHAR(20),
    nid VARCHAR(50),
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_by INT NULL,
    approved_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_admin_email (email),
    INDEX idx_admin_status (status)
);

-- Sample insert for testing (password should be hashed in production)
-- INSERT INTO admins (name, email, password, mobile, status) VALUES 
-- ('Super Admin', 'admin@govt.bd', '$2a$10$hashedpassword', '01700000000', 'approved');

-- ADMIN AUDIT LOG (Optional - track admin actions)
CREATE TABLE IF NOT EXISTS admin_actions_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_table VARCHAR(50) NOT NULL,
    target_id INT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    INDEX idx_admin_action_date (created_at)
);
