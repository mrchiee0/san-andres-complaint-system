-- Update all separate account tables' passwords to 'Testing123' (BCrypt hashed)
-- For MySQL (san_andres_complaint_system DB)
-- Run: mysql -u root -p san_andres_complaint_system < update_users_password.sql

UPDATE `administrators` SET `password` = '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6' WHERE `email` IN ('admin@demo.com', 'official@demo.com');
UPDATE `residents` SET `password` = '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6' WHERE `email` = 'citizen@demo.com';

-- Verify
SELECT `email`, `role` FROM `administrators` WHERE `password` = '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6'
UNION ALL
SELECT `email`, 'mamamayan' FROM `residents` WHERE `password` = '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6';

-- For SQLite (barangay.db) equivalent:
-- Legacy SQLite command intentionally omitted; this project now uses MySQL account tables.

SELECT 'Password updated to Testing123 (hashed)' AS status;
