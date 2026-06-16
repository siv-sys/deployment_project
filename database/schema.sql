-- ============================================================================
-- SQL Script: Create Database, User, Table, and Mock Data for Siv Dashboard
-- Target Server IP: 192.168.108.234
-- Database Name: siv_db
-- ============================================================================

-- 1. Create the Database if it doesn't exist
CREATE DATABASE IF NOT EXISTS `siv_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `siv_db`;

-- 2. Create the Database User (for remote connection from Backend: 172.16.16.69)
-- NOTE: Replace 'secure_password_here' with a strong password.
CREATE USER IF NOT EXISTS 'siv_user'@'%' IDENTIFIED BY 'siv_password_2026';
GRANT ALL PRIVILEGES ON `siv_db`.* TO 'siv_user'@'%';
FLUSH PRIVILEGES;

-- 3. Create the Products Table
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `sku` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT,
    `category` VARCHAR(50) NOT NULL,
    `quantity` INT NOT NULL DEFAULT 0,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Insert Premium Sample Inventory Data
INSERT INTO `products` (`sku`, `name`, `description`, `category`, `quantity`, `price`)
VALUES
    ('SKU-SIV-001', 'Quantum X1 Smartphone', 'Premium display, high refresh rate, triple camera setup, 256GB storage.', 'Electronics', 15, 899.99),
    ('SKU-SIV-002', 'Neptune ANC Headphones', 'Active noise cancelling headphones with custom 40mm drivers and 40h battery life.', 'Audio', 42, 249.99),
    ('SKU-SIV-003', 'Aero Ergonomic Desk', 'Minimalist oak sit-stand electric desk with dual motor and memory preset controllers.', 'Furniture', 8, 599.00),
    ('SKU-SIV-004', 'Lumix Solar Keyboard', 'Eco-friendly mechanical keyboard powered entirely by light, RGB backlit.', 'Peripherals', 28, 129.50),
    ('SKU-SIV-005', 'Echo Wireless Charger', 'Sleek premium leather wireless pad charging up to 3 devices simultaneously.', 'Peripherals', 0, 79.99),
    ('SKU-SIV-006', 'Helix Multi-Tool Watch', 'Titanium smart timepiece with integrated multi-tools, compass, and solar GPS.', 'Wearables', 3, 450.00),
    ('SKU-SIV-007', 'Titan Water Flask', 'Double-walled vacuum insulated flask with integrated UV sterilization cap.', 'Lifestyle', 120, 49.95),
    ('SKU-SIV-008', 'Orion Ultra Router', 'Wi-Fi 7 mesh node router providing speeds up to 10Gbps across 5000 sq ft.', 'Electronics', 14, 349.00)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
