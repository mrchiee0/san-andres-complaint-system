-- Update Script: Create site_settings table and insert defaults
-- Run this script against the `san_andres_complaint_system` database

USE `san_andres_complaint_system`;

CREATE TABLE IF NOT EXISTS `site_settings` (
  `setting_key` VARCHAR(50) PRIMARY KEY,
  `setting_value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default settings
INSERT IGNORE INTO `site_settings` (`setting_key`, `setting_value`) VALUES
('system_name', 'San Andres'),
('hero_title', 'Community Voices, Barangay Action.'),
('hero_subtitle', 'A modern system for the fast, safe, and transparent reporting of concerns in Barangay San Andres.'),
('about_text', 'Designed for fast and effective public service.'),
('footer_text', '© 2026 Barangay San Andres. All rights reserved.'),
('logo_path', '');

SELECT 'site_settings table created and default values inserted successfully!' as status;
