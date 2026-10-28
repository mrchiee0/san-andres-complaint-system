-- Seed script for 10 users and 10 complaints
-- Run: mysql -u root -p san_andres_complaint_system < seed_sample_data.sql

USE `san_andres_complaint_system`;

-- 1) Insert sample accounts into their separate tables (password: Testing123)
INSERT INTO `administrators` (`user_id`, `pangalan`, `email`, `password`, `role`) VALUES
(1, 'Admin User', 'admin1@sanandres.test', '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6', 'admin'),
(2, 'Barangay Official', 'official1@sanandres.test', '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6', 'official')
ON DUPLICATE KEY UPDATE `pangalan` = VALUES(`pangalan`), `password` = VALUES(`password`), `role` = VALUES(`role`);

INSERT INTO `residents` (`user_id`, `pangalan`, `email`, `password`) VALUES
(3, 'Maria Santos', 'maria.santos@sanandres.test', '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6'),
(4, 'Jose Dela Cruz', 'jose.delacruz@sanandres.test', '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6'),
(5, 'Rosa Marquez', 'rosa.marquez@sanandres.test', '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6'),
(6, 'Carlos Mendoza', 'carlos.mendoza@sanandres.test', '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6'),
(7, 'Liza Reyes', 'liza.reyes@sanandres.test', '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6'),
(8, 'Ana Lim', 'ana.lim@sanandres.test', '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6'),
(9, 'Boyet Villanueva', 'boyet.villanueva@sanandres.test', '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6')
ON DUPLICATE KEY UPDATE `pangalan` = VALUES(`pangalan`), `password` = VALUES(`password`);

INSERT INTO `non_residents` (`user_id`, `pangalan`, `email`, `password`) VALUES
(10, 'Ruben Tolentino', 'ruben.tolentino@sanandres.test', '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6')
ON DUPLICATE KEY UPDATE `pangalan` = VALUES(`pangalan`), `password` = VALUES(`password`);

INSERT INTO `account_sequence` (`id`, `next_id`) VALUES (1, 11)
ON DUPLICATE KEY UPDATE `next_id` = GREATEST(`next_id`, 11);

-- 2) Insert sample complaints using live IDs from account_profiles
-- This avoids hard-coded foreign key IDs that can fail when the database already has data.
INSERT INTO `complaints`
(`blotter_number`, `user_id`, `uri_ng_reklamo`, `detalye`, `status`, `assigned_to`, `nireklamo_pangalan`, `nireklamo_email`, `nireklamo_user_id`, `is_resident`, `created_at`, `updated_at`)
SELECT 'SB-2026-001', (SELECT `id` FROM `account_profiles` WHERE `email` = 'maria.santos@sanandres.test'), 'Waste and Sanitation', 'Nilalaman ng mga basura sa kalsada sa tapat ng barangay hall. Nagpapalala ang amoy at nagiging breeding ground ng langaw.', 'bago', (SELECT `id` FROM `account_profiles` WHERE `email` = 'official1@sanandres.test'), 'Juan Dela Cruz', 'juan.delacruz@example.com', (SELECT `id` FROM `account_profiles` WHERE `email` = 'jose.delacruz@sanandres.test'), 'Resident', NOW(), NOW()
UNION ALL
SELECT 'SB-2026-002', (SELECT `id` FROM `account_profiles` WHERE `email` = 'jose.delacruz@sanandres.test'), 'Noise Complaints', 'Patuloy na pagpatugtog ng karaoke sa gabi na umaabot hanggang madaling araw. Apektado ang mga bata at senior citizen.', 'sinusuri', (SELECT `id` FROM `account_profiles` WHERE `email` = 'official1@sanandres.test'), 'Maria Santos', 'maria.santos@example.com', (SELECT `id` FROM `account_profiles` WHERE `email` = 'maria.santos@sanandres.test'), 'Resident', NOW(), NOW()
UNION ALL
SELECT 'SB-2026-003', (SELECT `id` FROM `account_profiles` WHERE `email` = 'rosa.marquez@sanandres.test'), 'Utility Disruptions', 'Hindi gumagana ang public faucet sa Sitio San Roque. Kulang ang tubig at nagdudulot ng abala sa mga residente.', 'naka-assign', (SELECT `id` FROM `account_profiles` WHERE `email` = 'official1@sanandres.test'), 'Rosa Marquez', 'rosa.marquez@example.com', (SELECT `id` FROM `account_profiles` WHERE `email` = 'rosa.marquez@sanandres.test'), 'Resident', NOW(), NOW()
UNION ALL
SELECT 'SB-2026-004', (SELECT `id` FROM `account_profiles` WHERE `email` = 'carlos.mendoza@sanandres.test'), 'Anti-Social Behavior (ASB)', 'May nag-aaway na mga mag-anak sa may kanto. Naghihinala ang residente na may nakakasakit na armadong tao.', 'iniimbestigahan', (SELECT `id` FROM `account_profiles` WHERE `email` = 'official1@sanandres.test'), 'Carlos Mendoza', 'carlos.mendoza@example.com', (SELECT `id` FROM `account_profiles` WHERE `email` = 'carlos.mendoza@sanandres.test'), 'Resident', NOW(), NOW()
UNION ALL
SELECT 'SB-2026-005', (SELECT `id` FROM `account_profiles` WHERE `email` = 'liza.reyes@sanandres.test'), 'Illegal Parking', 'Maraming sasakyan ang nagsisiksikan sa lugar malapit sa elementary school, nakakasagabal sa pedestrian lane.', 'naka-iskedyul', (SELECT `id` FROM `account_profiles` WHERE `email` = 'official1@sanandres.test'), 'Liza Reyes', 'liza.reyes@example.com', (SELECT `id` FROM `account_profiles` WHERE `email` = 'liza.reyes@sanandres.test'), 'Resident', NOW(), NOW()
UNION ALL
SELECT 'SB-2026-006', (SELECT `id` FROM `account_profiles` WHERE `email` = 'ruben.tolentino@sanandres.test'), 'Waste and Sanitation', 'May nakitang tambak ng sako ng basura sa may drainage canal. May posibilidad na ma-block ang tubig pag-ulan.', 'sa-mediation', (SELECT `id` FROM `account_profiles` WHERE `email` = 'official1@sanandres.test'), 'Ruben Tolentino', 'ruben.tolentino@example.com', (SELECT `id` FROM `account_profiles` WHERE `email` = 'ruben.tolentino@sanandres.test'), 'Non Resident', NOW(), NOW()
UNION ALL
SELECT 'SB-2026-007', (SELECT `id` FROM `account_profiles` WHERE `email` = 'ana.lim@sanandres.test'), 'Street Lighting', 'Sira ang street light sa may kalye ng barangay. Madilim ang lugar at takot ang mga residente sa gabi.', 'natapos', (SELECT `id` FROM `account_profiles` WHERE `email` = 'official1@sanandres.test'), 'Ana Lim', 'ana.lim@example.com', (SELECT `id` FROM `account_profiles` WHERE `email` = 'ana.lim@sanandres.test'), 'Resident', NOW(), NOW()
UNION ALL
SELECT 'SB-2026-008', (SELECT `id` FROM `account_profiles` WHERE `email` = 'boyet.villanueva@sanandres.test'), 'Anti-Social Behavior (ASB)', 'May dalawang grupo ng kabataan ang nag-aaway sa basketball court. Nagsagawa na ng warning pero patuloy pa rin.', 'bago', (SELECT `id` FROM `account_profiles` WHERE `email` = 'official1@sanandres.test'), 'Boyet Villanueva', 'boyet.villanueva@example.com', (SELECT `id` FROM `account_profiles` WHERE `email` = 'boyet.villanueva@sanandres.test'), 'Resident', NOW(), NOW()
UNION ALL
SELECT 'SB-2026-009', (SELECT `id` FROM `account_profiles` WHERE `email` = 'maria.santos@sanandres.test'), 'Utility Disruptions', 'Humihingi ng tulong upang linisin ang drainage at magsagawa ng regular na monitoring ng flood-prone area.', 'sinusuri', (SELECT `id` FROM `account_profiles` WHERE `email` = 'official1@sanandres.test'), 'Maria Santos', 'maria.santos@example.com', (SELECT `id` FROM `account_profiles` WHERE `email` = 'maria.santos@sanandres.test'), 'Resident', NOW(), NOW()
UNION ALL
SELECT 'SB-2026-010', (SELECT `id` FROM `account_profiles` WHERE `email` = 'jose.delacruz@sanandres.test'), 'Noise Complaints', 'Patuloy ang paggawa sa construction site hanggang gabi na labis ang ingay. Hindi nakakatulog ang mga kapitbahay.', 'naka-assign', (SELECT `id` FROM `account_profiles` WHERE `email` = 'official1@sanandres.test'), 'Jose Dela Cruz', 'jose.delacruz@example.com', (SELECT `id` FROM `account_profiles` WHERE `email` = 'jose.delacruz@sanandres.test'), 'Resident', NOW(), NOW();

UPDATE `complaints`
SET `uri_ng_reklamo` = CASE `uri_ng_reklamo`
	WHEN 'Basura / Kalinisan' THEN 'Waste and Sanitation'
	WHEN 'Ingay / Disturbo' THEN 'Noise Complaints'
	WHEN 'Sirang Pasilidad' THEN 'Safety Hazards'
	WHEN 'Away / Gulo' THEN 'Anti-Social Behavior (ASB)'
	WHEN 'Ilegal na Paradahan' THEN 'Illegal Parking'
	WHEN 'Iba pa' THEN 'Other Concerns'
	ELSE `uri_ng_reklamo`
END
WHERE `uri_ng_reklamo` IN ('Basura / Kalinisan', 'Ingay / Disturbo', 'Sirang Pasilidad', 'Away / Gulo', 'Ilegal na Paradahan', 'Iba pa');

SELECT 'Accounts count' AS label, COUNT(*) AS total FROM `account_profiles`;
