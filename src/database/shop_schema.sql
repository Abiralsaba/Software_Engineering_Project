-- Shop Items Table
CREATE TABLE IF NOT EXISTS shop_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(255),
    stock_quantity INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cart Items Table (renamed as requested)
CREATE TABLE IF NOT EXISTS addto_cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_nid VARCHAR(50) NOT NULL,
    item_id INT NOT NULL,
    quantity INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_nid) REFERENCES reg_info(nid) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
);

-- Orders Table (renamed as requested)
CREATE TABLE IF NOT EXISTS ordered_item (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_nid VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method ENUM('COD', 'ONLINE') NOT NULL,
    payment_status ENUM('PENDING', 'PAID', 'FAILED') DEFAULT 'PENDING',
    delivery_address TEXT NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_nid) REFERENCES reg_info(nid) ON DELETE CASCADE
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL,
    price_at_time DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES ordered_item(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
);

-- Insert initial shop items
INSERT INTO shop_items (name, description, price, image_url) VALUES 
('Constitution of Bangladesh', 'Official bilingual edition', 250.00, '<i class="fas fa-book"></i>'),
('Souvenir T-Shirt', '"I Love my Country"', 500.00, '<i class="fas fa-tshirt"></i>'),
('Eco Mug', 'Bamboo fiber mug', 300.00, '<i class="fas fa-mug-hot"></i>'),
('National Flag', 'Standard Size (Cotton)', 150.00, '<i class="fas fa-flag"></i>');
