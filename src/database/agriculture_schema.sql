-- =============================================
-- Agriculture Ministry - Database Schema
-- Government of Bangladesh
-- =============================================

-- Enhanced Subsidies Table
CREATE TABLE IF NOT EXISTS agri_subsidies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    farmer_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    subsidy_type ENUM('Fertilizer','Seeds','Machinery','Irrigation','Pesticide','Livestock','Fishery') NOT NULL,
    amount_requested DECIMAL(12,2) NOT NULL,
    land_size_acres DECIMAL(8,2),
    crop_type VARCHAR(100),
    land_ownership ENUM('Own','Leased','Shared','Government') DEFAULT 'Own',
    division_id INT,
    district_id INT,
    upazila_id INT,
    village VARCHAR(150),
    bank_name VARCHAR(150),
    bank_branch VARCHAR(150),
    bank_account VARCHAR(50),
    nid_number VARCHAR(20),
    status ENUM('Pending','Under Review','Approved','Rejected') DEFAULT 'Pending',
    admin_remarks TEXT,
    reviewed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (division_id) REFERENCES divisions(id),
    FOREIGN KEY (district_id) REFERENCES districts(id),
    FOREIGN KEY (upazila_id) REFERENCES upazilas(id)
);

-- Enhanced Crop Reports Table
CREATE TABLE IF NOT EXISTS agri_crop_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    farmer_name VARCHAR(150),
    crop_name VARCHAR(100) NOT NULL,
    crop_variety VARCHAR(100),
    season ENUM('Rabi','Kharif-1','Kharif-2','Aus','Aman','Boro') NOT NULL,
    yield_metric_ton DECIMAL(10,2) NOT NULL,
    land_area_acres DECIMAL(8,2),
    fertilizer_used VARCHAR(200),
    irrigation_method ENUM('Rainfed','Canal','Tubewell','Pond','Drip','Sprinkler') DEFAULT 'Rainfed',
    harvest_date DATE,
    market_price_per_ton DECIMAL(12,2),
    division_id INT,
    district_id INT,
    upazila_id INT,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (division_id) REFERENCES divisions(id),
    FOREIGN KEY (district_id) REFERENCES districts(id),
    FOREIGN KEY (upazila_id) REFERENCES upazilas(id)
);

-- Enhanced Expert Q&A Table
CREATE TABLE IF NOT EXISTS agri_expert_queries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    question TEXT NOT NULL,
    category ENUM('Pest Control','Soil Health','Irrigation','Seeds','Fertilizer','Livestock','Fishery','Marketing','Weather','Other') DEFAULT 'Other',
    crop_name VARCHAR(100),
    answer TEXT,
    status ENUM('Pending','Replied') DEFAULT 'Pending',
    answered_by VARCHAR(100),
    answered_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Farmer Marketplace Table
CREATE TABLE IF NOT EXISTS agri_farmer_market (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    farmer_name VARCHAR(150) NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    product_category ENUM('Rice','Wheat','Vegetables','Fruits','Fish','Poultry','Dairy','Spices','Jute','Tea','Other') NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit ENUM('kg','ton','maund','piece','litre','dozen') DEFAULT 'kg',
    price_per_unit DECIMAL(10,2) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    division_id INT,
    district_id INT,
    upazila_id INT,
    description TEXT,
    available_from DATE,
    available_until DATE,
    status ENUM('Pending','Approved','Sold','Expired','Rejected') DEFAULT 'Pending',
    admin_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (division_id) REFERENCES divisions(id),
    FOREIGN KEY (district_id) REFERENCES districts(id),
    FOREIGN KEY (upazila_id) REFERENCES upazilas(id)
);

-- Training Programs Table (Admin-created)
CREATE TABLE IF NOT EXISTS agri_training_programs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(250) NOT NULL,
    description TEXT,
    category ENUM('Crop Management','Pest Control','Modern Farming','Livestock','Fishery','Organic Farming','Marketing','Technology') NOT NULL,
    location VARCHAR(250),
    division_id INT,
    district_id INT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    capacity INT DEFAULT 50,
    trainer_name VARCHAR(150),
    trainer_designation VARCHAR(150),
    status ENUM('Upcoming','Ongoing','Completed','Cancelled') DEFAULT 'Upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (division_id) REFERENCES divisions(id),
    FOREIGN KEY (district_id) REFERENCES districts(id)
);

-- Training Registrations
CREATE TABLE IF NOT EXISTS agri_training_registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    program_id INT NOT NULL,
    farmer_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    status ENUM('Registered','Attended','Cancelled') DEFAULT 'Registered',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES agri_training_programs(id)
);
