CREATE TABLE IF NOT EXISTS admin_login_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    status ENUM('success', 'failed') DEFAULT 'success',
    failure_reason VARCHAR(255),
    FOREIGN KEY (admin_id) REFERENCES admins(id)
);
