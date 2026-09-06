-- ==========================================
-- MARKET INFO SCHEMA
-- Central Government System - Market Prices & Complaints
-- ==========================================

-- Official market prices for daily necessities
CREATE TABLE IF NOT EXISTS market_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    item_name_bn VARCHAR(255),
    category ENUM('Rice', 'Vegetables', 'Fish', 'Meat', 'Oil', 'Spices', 'Dairy', 'Fruits', 'Grains', 'Other') DEFAULT 'Other',
    unit VARCHAR(50) NOT NULL DEFAULT 'kg',
    price DECIMAL(10,2) NOT NULL,
    updated_by INT,
    effective_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_market_category (category),
    INDEX idx_market_date (effective_date)
);

-- Citizen complaints against shops charging extra
CREATE TABLE IF NOT EXISTS price_complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    shop_name VARCHAR(255) NOT NULL,
    shop_phone VARCHAR(20),
    shop_location VARCHAR(500) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    official_price DECIMAL(10,2),
    charged_price DECIMAL(10,2) NOT NULL,
    description TEXT,
    status ENUM('pending', 'investigating', 'resolved', 'dismissed') DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_complaint_status (status),
    INDEX idx_complaint_user (user_id),
    INDEX idx_complaint_date (created_at)
);

-- Sample market prices for testing
INSERT IGNORE INTO market_prices (item_name, item_name_bn, category, unit, price) VALUES
('Miniket Rice', 'মিনিকেট চাল', 'Rice', 'kg', 65.00),
('Nazirshail Rice', 'নাজিরশাইল চাল', 'Rice', 'kg', 72.00),
('Potato', 'আলু', 'Vegetables', 'kg', 30.00),
('Onion', 'পেঁয়াজ', 'Vegetables', 'kg', 50.00),
('Tomato', 'টমেটো', 'Vegetables', 'kg', 40.00),
('Green Chili', 'কাঁচা মরিচ', 'Vegetables', 'kg', 80.00),
('Garlic', 'রসুন', 'Spices', 'kg', 200.00),
('Ginger', 'আদা', 'Spices', 'kg', 180.00),
('Turmeric Powder', 'হলুদ গুঁড়া', 'Spices', 'kg', 280.00),
('Soybean Oil', 'সয়াবিন তেল', 'Oil', 'litre', 165.00),
('Mustard Oil', 'সরিষার তেল', 'Oil', 'litre', 220.00),
('Hilsa Fish', 'ইলিশ মাছ', 'Fish', 'kg', 800.00),
('Rohu Fish', 'রুই মাছ', 'Fish', 'kg', 280.00),
('Tilapia Fish', 'তেলাপিয়া মাছ', 'Fish', 'kg', 180.00),
('Beef', 'গরুর মাংস', 'Meat', 'kg', 700.00),
('Chicken (Broiler)', 'ব্রয়লার মুরগি', 'Meat', 'kg', 180.00),
('Chicken (Desi)', 'দেশি মুরগি', 'Meat', 'kg', 550.00),
('Egg', 'ডিম', 'Dairy', 'piece', 12.00),
('Milk', 'দুধ', 'Dairy', 'litre', 80.00),
('Lentil (Masur)', 'মসুর ডাল', 'Grains', 'kg', 110.00),
('Sugar', 'চিনি', 'Grains', 'kg', 120.00),
('Salt', 'লবণ', 'Grains', 'kg', 35.00),
('Banana', 'কলা', 'Fruits', 'dozen', 60.00),
('Apple', 'আপেল', 'Fruits', 'kg', 250.00);
