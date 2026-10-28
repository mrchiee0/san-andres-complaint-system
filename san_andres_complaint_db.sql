-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 10, 2026 at 05:00 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `san_andres_complaint_system`
--

-- --------------------------------------------------------

--
-- Table structure for table `account_documents`
--

CREATE TABLE `account_documents` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `document_type` varchar(100) NOT NULL,
  `front_path` varchar(500) NOT NULL,
  `back_path` varchar(500) NOT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `account_profiles`
-- (See below for the actual view)
--
CREATE TABLE `account_profiles` (
`id` int(11)
,`pangalan` varchar(255)
,`email` varchar(255)
,`password` mediumtext
,`role` varchar(9)
,`is_resident` varchar(12)
,`account_type` varchar(13)
);

-- --------------------------------------------------------

--
-- Table structure for table `account_sequence`
--

CREATE TABLE `account_sequence` (
  `id` tinyint(4) NOT NULL,
  `next_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

CREATE TABLE `registration_verifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` text NOT NULL,
  `profile_data` json NOT NULL,
  `is_resident` enum('Resident','Non Resident') DEFAULT NULL,
  `verification_token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `verified_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_registration_verification_username` (`username`),
  UNIQUE KEY `uq_registration_verification_email` (`email`),
  UNIQUE KEY `verification_token_hash` (`verification_token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `account_sequence`
--

INSERT INTO `account_sequence` (`id`, `next_id`) VALUES
(1, 1005);

-- --------------------------------------------------------

--
-- Table structure for table `actions`
--

CREATE TABLE `actions` (
  `id` int(11) NOT NULL,
  `complaint_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `paglalarawan` text NOT NULL,
  `petsa` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `actions`
--

INSERT INTO `actions` (`id`, `complaint_id`, `user_id`, `paglalarawan`, `petsa`) VALUES
(1, 1, 1002, 'In-update ang status sa sinusuri', '2026-09-08 03:17:56'),
(2, 1, 1002, 'In-update ang status sa naka-assign', '2026-09-10 08:24:50'),
(3, 1, 1002, 'In-update ang status sa sa-mediation', '2026-09-10 08:24:55'),
(4, 1, 1002, 'Naka-iskedyul para sa Mediation: 2026-09-12T10:26 sa Barangay Hall - Mediation Room (personal)', '2026-09-10 14:23:59');

-- --------------------------------------------------------

--
-- Table structure for table `administrators`
--

CREATE TABLE `administrators` (
  `user_id` int(11) NOT NULL,
  `pangalan` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` text NOT NULL,
  `role` enum('admin','official') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `administrators`
--

INSERT INTO `administrators` (`user_id`, `pangalan`, `email`, `password`, `role`, `created_at`) VALUES
(1002, 'Demo Admin', 'sanandressmis1cainta@gmail.com', '$2b$10$AB/PWZFch6UklB3FvzY8vetTeKRT9aq.pwCed2005/D9dd92Jl3l2', 'admin', '2026-09-07 14:58:51'),
(1003, 'Demo Official', 'official@demo.com', '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6', 'official', '2026-09-07 14:58:51');

-- --------------------------------------------------------

--
-- Table structure for table `case_lupon`
--

CREATE TABLE `case_lupon` (
  `id` int(11) NOT NULL,
  `complaint_id` int(11) NOT NULL,
  `lupon_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `complaints`
--

CREATE TABLE `complaints` (
  `id` int(11) NOT NULL,
  `blotter_number` varchar(50) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `uri_ng_reklamo` varchar(255) NOT NULL,
  `detalye` text NOT NULL,
  `status` enum('bago','sinusuri','naka-assign','iniimbestigahan','naka-iskedyul','sa-mediation','natapos','archived') NOT NULL DEFAULT 'bago',
  `assigned_to` int(11) DEFAULT NULL,
  `nireklamo_pangalan` varchar(255) DEFAULT NULL,
  `nireklamo_email` varchar(255) DEFAULT NULL,
  `nireklamo_user_id` int(11) DEFAULT NULL,
  `is_resident` enum('Resident','Non Resident') NOT NULL DEFAULT 'Resident',
  `zone` varchar(100) DEFAULT NULL,
  `street_name` varchar(255) DEFAULT NULL,
  `complainant_name` varchar(255) DEFAULT NULL,
  `complainant_email` varchar(255) DEFAULT NULL,
  `truthfulness_acknowledged_at` datetime DEFAULT NULL,
  `edit_count` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `complaints`
--

INSERT INTO `complaints` (`id`, `blotter_number`, `user_id`, `uri_ng_reklamo`, `detalye`, `status`, `assigned_to`, `nireklamo_pangalan`, `nireklamo_email`, `nireklamo_user_id`, `is_resident`, `zone`, `street_name`, `complainant_name`, `complainant_email`, `truthfulness_acknowledged_at`, `edit_count`, `created_at`, `updated_at`) VALUES
(1, 'B-2026-5103', 1001, 'Illegal Parking', 'Illegal parking sa kanilang kalsada nakaharang lagi sasakyan', 'sa-mediation', NULL, 'Joy Mercado', '', NULL, 'Resident', 'Midtown', NULL, NULL, NULL, NULL, 0, '2026-09-08 03:12:08', '2026-09-10 14:23:59');

--
-- Table structure for table `complaint_history`
--

CREATE TABLE `complaint_history` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `complaint_id` int(11) NOT NULL,
  `actor_user_id` int(11) NOT NULL,
  `action_type` varchar(30) NOT NULL,
  `snapshot` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_complaint_history_complaint` (`complaint_id`,`created_at`),
  KEY `idx_complaint_history_actor` (`actor_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `complaint_history` (`complaint_id`, `actor_user_id`, `action_type`, `snapshot`, `created_at`) VALUES
(1, 1001, 'filed', JSON_OBJECT('uri_ng_reklamo', 'Illegal Parking', 'category', 'Traffic & Parking', 'complainant_name', '', 'complainant_email', '', 'nireklamo_pangalan', 'Joy Mercado', 'nireklamo_email', '', 'detalye', 'Illegal parking sa kanilang kalsada nakaharang lagi sasakyan', 'zone', 'Midtown', 'street_name', ''), '2026-09-08 03:12:08');

-- --------------------------------------------------------

--
-- Table structure for table `complaint_types`
--

CREATE TABLE `complaint_types` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(150) NOT NULL DEFAULT 'Social & Safety Concerns',
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `complaint_types`
--

INSERT INTO `complaint_types` (`id`, `name`, `category`, `description`, `is_active`, `created_at`) VALUES
(1, 'Noise Complaints', 'Environmental & Public Nuisance', 'Loud music, late-night parties, construction noise outside legal hours, and persistent barking dogs.', 1, '2026-09-07 14:58:51'),
(2, 'Waste and Sanitation', 'Environmental & Public Nuisance', 'Missed trash collections, illegal dumping, overflowing public bins, and litter.', 1, '2026-09-07 14:58:51'),
(3, 'Anti-Social Behavior (ASB)', 'Social & Safety Concerns', 'Loitering, vandalism, graffiti, public intoxication, or neighbor disputes.', 1, '2026-09-07 14:58:51'),
(4, 'Illegal Parking', 'Traffic & Parking', 'Vehicles blocking driveways, parking on sidewalks, or occupying fire lanes.', 1, '2026-09-07 14:58:51'),
(5, 'Safety Hazards', 'Social & Safety Concerns', 'Dimly lit parks, broken playground equipment, or unsecured construction sites.', 1, '2026-09-07 14:58:51'),
(6, 'Other Concerns', 'Social & Safety Concerns', 'Other neighborhood concerns that do not fit the categories above.', 1, '2026-09-07 14:58:51'),
(7, 'Roads and Sidewalks', 'Neighborhood & Infrastructure', 'Potholes, broken pavements, blocked sidewalks, and missing street signs.', 1, '2026-09-07 14:58:51'),
(8, 'Street Lighting', 'Neighborhood & Infrastructure', 'Broken streetlights, dark alleys, or lights that keep blinking.', 1, '2026-09-07 14:58:51'),
(9, 'Utility Disruptions', 'Neighborhood & Infrastructure', 'Water leaks, power outages, poor drainage, and clogged storm sewers.', 1, '2026-09-07 14:58:51'),
(10, 'Pest Control', 'Environmental & Public Nuisance', 'Rodents, stray animals, or mosquito breeding grounds in stagnant water.', 1, '2026-09-07 14:58:51'),
(11, 'Blight and Maintenance', 'Property & Zoning Violations', 'Overgrown lawns, abandoned vehicles, unmaintained properties, and peeling paint or structural damage.', 1, '2026-09-07 14:58:51'),
(12, 'Zoning and Land Use', 'Property & Zoning Violations', 'Unauthorized businesses in residential homes or unapproved building extensions.', 1, '2026-09-07 14:58:51'),
(13, 'Short-Term Rentals', 'Property & Zoning Violations', 'Unregistered short-term rentals causing disruptions or safety concerns.', 1, '2026-09-07 14:58:51'),
(14, 'Abandoned Vehicles', 'Traffic & Parking', 'Vehicles left unmoved on public streets for weeks or months.', 1, '2026-09-07 14:58:51'),
(15, 'Traffic Safety', 'Traffic & Parking', 'Speeding in residential areas or requests for speed bumps and crosswalks.', 1, '2026-09-07 14:58:51');

-- --------------------------------------------------------

--
-- Table structure for table `complaint_zones`
--

CREATE TABLE `complaint_zones` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT '',
  `lat` decimal(10,7) NOT NULL,
  `lng` decimal(10,7) NOT NULL,
  `color` varchar(20) NOT NULL DEFAULT 'red',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `complaint_zones`
--

INSERT INTO `complaint_zones` (`id`, `name`, `description`, `lat`, `lng`, `color`, `is_active`, `created_at`) VALUES
(1, 'West Floodway', 'Flood-prone and traffic-heavy corridor in San Andres', 14.5758000, 121.1136000, 'red', 1, '2026-09-07 15:00:40'),
(2, 'Bermai', 'High-density residential and complaint cluster near the barangay core', 14.5742000, 121.1108000, 'orange', 1, '2026-09-07 15:00:40'),
(3, 'Midtown', 'Central community zone in San Andres with mixed traffic and services', 14.5706000, 121.1120000, 'yellow', 1, '2026-09-07 15:00:40'),
(4, 'Rivera', 'Residential village with routine barangay concerns', 14.5679000, 121.1069000, 'green', 1, '2026-09-07 15:00:40'),
(5, 'Parola', 'Community zone along San Andres boundary corridor', 14.5768000, 121.1145000, 'yellow', 1, '2026-09-07 15:00:40'),
(6, 'Greenland', 'Residential village community in San Andres', 14.5735000, 121.1130000, 'red', 1, '2026-09-07 15:00:40'),
(7, 'Mercedes', 'Subdivision community in San Andres', 14.5665000, 121.1045000, 'green', 1, '2026-09-07 15:00:40'),
(8, 'Pag-Ibig', 'Residential zone in San Andres', 14.5620000, 121.0980000, 'red', 1, '2026-09-07 15:00:40'),
(9, 'Greenwoods', 'San Andres residential section', 14.5580000, 121.0990000, 'yellow', 1, '2026-09-07 15:00:40'),
(10, 'Plantation', 'San Andres southern sector subdivision', 14.5520000, 121.1060000, 'orange', 1, '2026-09-07 15:00:40');

-- --------------------------------------------------------

--
-- Table structure for table `evidence`
--

CREATE TABLE `evidence` (
  `id` int(11) NOT NULL,
  `complaint_id` int(11) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_type` varchar(50) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `google_login_otps`
--

CREATE TABLE `google_login_otps` (
  `id` int(11) NOT NULL,
  `challenge_hash` char(64) NOT NULL,
  `email` varchar(255) NOT NULL,
  `otp_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `google_login_otps`
--

INSERT INTO `google_login_otps` (`id`, `challenge_hash`, `email`, `otp_hash`, `expires_at`, `attempts`, `used_at`, `created_at`) VALUES
(1, 'bd5ce05e6c63c2d33df6637ba574e604e07f999ca90a0f839b871f8b85a80f28', 'sanandressmis1cainta@gmail.com', 'b82be7d9f185906fd18c03708807e6d06f05be5a33ea32f7f817b3d91e0a6936', '2026-09-10 22:27:28', 0, '2026-09-10 22:18:10', '2026-09-10 14:17:28');

-- --------------------------------------------------------

--
-- Table structure for table `knowledge_base`
--

CREATE TABLE `knowledge_base` (
  `id` int(11) NOT NULL,
  `question` text NOT NULL,
  `answer` text NOT NULL,
  `category` varchar(100) DEFAULT 'general',
  `source` varchar(100) DEFAULT 'system',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `knowledge_base`
--

INSERT INTO `knowledge_base` (`id`, `question`, `answer`, `category`, `source`, `created_at`) VALUES
(1, 'Paano mag-sumite ng reklamo?', 'Pumunta sa Reklamo page, i-click ang I-ulat ang Hinaing, piliin ang uri ng reklamo, ilarawan ang detalye, at i-click ang Isumite.', 'general', 'system', '2026-09-07 14:58:51'),
(2, 'Ano ang mediation?', 'Ang mediation ay isang proseso kung saan nag-uusap ang magkabilang panig kasama ang isang opisyal ng barangay para maayos ang gulo nang walang demandahan.', 'general', 'system', '2026-09-07 14:58:51'),
(3, 'Paano malalaman ang status ng reklamo?', 'Makikita ang status sa iyong Dashboard o sa Reklamo list. May mga status tulad ng Bago, Pagrepaso, Mediation, at Tapos.', 'general', 'system', '2026-09-07 14:58:51'),
(4, 'Sino ang pwedeng gumamit ng system?', 'Ang system na ito ay para sa lahat ng mga residente ng Barangay San Andres.', 'general', 'system', '2026-09-07 14:58:51');

-- --------------------------------------------------------

--
-- Table structure for table `logs`
--

CREATE TABLE `logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `aksyon` varchar(255) NOT NULL,
  `detalye` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `lupon_members`
--

CREATE TABLE `lupon_members` (
  `id` int(11) NOT NULL,
  `pangalan` varchar(255) NOT NULL,
  `posisyon` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `lupon_members`
--

INSERT INTO `lupon_members` (`id`, `pangalan`, `posisyon`, `is_active`, `created_at`) VALUES
(1, 'Hon. Josefina Dela Cruz', 'Chairman', 1, '2026-09-07 14:58:51'),
(2, 'Bernardo Ramos', 'Lupon Secretary', 1, '2026-09-07 14:58:51'),
(3, 'Elena Garcia', 'Member', 1, '2026-09-07 14:58:51'),
(4, 'Roberto Tan', 'Member', 1, '2026-09-07 14:58:51'),
(5, 'Carmelita Mendoza', 'Member', 1, '2026-09-07 14:58:51');

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `complaint_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `mensahe` text NOT NULL,
  `petsa` timestamp NOT NULL DEFAULT current_timestamp(),
  `nabasa` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `messages`
--

INSERT INTO `messages` (`id`, `complaint_id`, `user_id`, `mensahe`, `petsa`, `nabasa`) VALUES
(1, 1, 1001, 'hello?', '2026-09-08 03:13:32', 1);

-- --------------------------------------------------------

--
-- Table structure for table `non_residents`
--

CREATE TABLE `non_residents` (
  `user_id` int(11) NOT NULL,
  `pangalan` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` text NOT NULL,
  `username` varchar(64) DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT 1,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `suffix` varchar(20) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `sex` varchar(30) DEFAULT NULL,
  `place_of_birth` varchar(255) DEFAULT NULL,
  `civil_status` varchar(30) DEFAULT NULL,
  `phone_number` varchar(30) DEFAULT NULL,
  `occupation` varchar(100) DEFAULT NULL,
  `religion` varchar(100) DEFAULT NULL,
  `registered_voter` varchar(5) DEFAULT NULL,
  `terms_agreed_at` timestamp NULL DEFAULT NULL,
  `address` varchar(500) DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `non_residents`
--

INSERT INTO `non_residents` (`user_id`, `pangalan`, `email`, `password`, `address`, `verified_at`, `created_at`) VALUES
(1004, 'Juanito cruz', 'jauncruz@gmail.com', '$2b$10$n6fNN6u8HZ6UuUDUl2OkweSKtqwblCCco7o70Sudg7/VQrWg/Otk2', NULL, NULL, '2026-09-07 15:05:15');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `mensahe` text NOT NULL,
  `nabasa` tinyint(1) DEFAULT 0,
  `notification_type` varchar(40) NOT NULL DEFAULT 'general',
  `target_path` varchar(500) NOT NULL DEFAULT '/complaints',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `mensahe`, `nabasa`, `notification_type`, `target_path`, `created_at`) VALUES
(1, 1002, 'New complaint submitted: Illegal Parking', 1, 'new_complaint', '/complaints/1', '2026-09-08 03:12:09'),
(2, 1003, 'New complaint submitted: Illegal Parking', 0, 'new_complaint', '/complaints/1', '2026-09-08 03:12:09'),
(3, 1001, 'Your complaint (Illegal Parking) status was updated to Under Review', 0, 'status_update', '/complaints/1', '2026-09-08 03:17:56'),
(4, 1001, 'Your complaint (Illegal Parking) status was updated to Assigned', 0, 'status_update', '/complaints/1', '2026-09-10 08:24:50'),
(5, 1001, 'Your complaint (Illegal Parking) status was updated to In Mediation', 0, 'status_update', '/complaints/1', '2026-09-10 08:24:55'),
(6, 1001, 'Your complaint is scheduled for mediation on 2026-09-12T10:26. Delivery method: in person.', 0, 'mediation_scheduled', '/complaints/1', '2026-09-10 14:23:59');

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_otps`
--

CREATE TABLE `password_reset_otps` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `otp_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `password_reset_otps`
--

INSERT INTO `password_reset_otps` (`id`, `email`, `otp_hash`, `expires_at`, `attempts`, `used_at`, `created_at`) VALUES
(1, 'sanandressmis1cainta@gmail.com', 'c3e11d7603db7976fe69700e17fad93ae64c63403195b003f206f082f857fc47', '2026-09-10 22:05:56', 0, '2026-09-10 21:56:28', '2026-09-10 13:55:56');

-- --------------------------------------------------------

--
-- Table structure for table `residents`
--

CREATE TABLE `residents` (
  `user_id` int(11) NOT NULL,
  `pangalan` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` text NOT NULL,
  `username` varchar(64) DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT 1,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `suffix` varchar(20) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `sex` varchar(30) DEFAULT NULL,
  `place_of_birth` varchar(255) DEFAULT NULL,
  `civil_status` varchar(30) DEFAULT NULL,
  `phone_number` varchar(30) DEFAULT NULL,
  `occupation` varchar(100) DEFAULT NULL,
  `religion` varchar(100) DEFAULT NULL,
  `registered_voter` varchar(5) DEFAULT NULL,
  `terms_agreed_at` timestamp NULL DEFAULT NULL,
  `address` varchar(500) DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `residents`
--

INSERT INTO `residents` (`user_id`, `pangalan`, `email`, `password`, `address`, `verified_at`, `created_at`) VALUES
(1001, 'Demo Mamamayan', 'cieloberongoy16@gmail.com', '$2b$10$9k6gV.emMhrGvVnw.mlc8.1fcscSaXCupnTvdxEmnCYUTxzUGIdJ6', NULL, NULL, '2026-09-07 14:58:51');

-- --------------------------------------------------------

--
-- Table structure for table `schedules`
--

CREATE TABLE `schedules` (
  `id` int(11) NOT NULL,
  `complaint_id` int(11) NOT NULL,
  `petsa` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `lokasyon` varchar(500) DEFAULT NULL,
  `detalye` text DEFAULT NULL,
  `status` varchar(50) DEFAULT 'naka-iskedyul',
  `outcome` varchar(100) DEFAULT NULL,
  `document_path` varchar(500) DEFAULT NULL,
  `paraan_ng_pagpapadala` varchar(100) DEFAULT 'system',
  `paraan_detalye` text DEFAULT NULL,
  `minutes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `schedules`
--

INSERT INTO `schedules` (`id`, `complaint_id`, `petsa`, `lokasyon`, `detalye`, `status`, `outcome`, `document_path`, `paraan_ng_pagpapadala`, `paraan_detalye`, `minutes`, `created_at`) VALUES
(1, 1, '2026-09-12 02:26:00', 'Barangay Hall - Mediation Room', '', 'naka-iskedyul', NULL, NULL, 'personal', 'juanito', NULL, '2026-09-10 14:23:59');

-- --------------------------------------------------------

--
-- Table structure for table `site_settings`
--

CREATE TABLE `site_settings` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--

INSERT INTO `site_settings` (`setting_key`, `setting_value`) VALUES
('about_text', 'Designed for fast and effective public service.'),
('footer_text', '© 2026 Barangay San Andres. All rights reserved.'),
('hero_subtitle', 'A modern system for the fast, safe, and transparent reporting of concerns in Barangay San Andres.'),
('hero_title', 'Community Voices, <br /> <span class="text-primary">Barangay Action.</span>'),
('logo_path', '/uploads/1789046371241.png'),
('system_name', 'San Andres');

-- --------------------------------------------------------

--
-- Table structure for table `witnesses`
--

CREATE TABLE `witnesses` (
  `id` int(11) NOT NULL,
  `complaint_id` int(11) NOT NULL,
  `pangalan` varchar(255) NOT NULL,
  `telepono` varchar(20) DEFAULT NULL,
  `detalye` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure for view `account_profiles`
--
DROP TABLE IF EXISTS `account_profiles`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `account_profiles`  AS SELECT `residents`.`user_id` AS `id`, `residents`.`pangalan` AS `pangalan`, `residents`.`email` AS `email`, `residents`.`password` AS `password`, 'mamamayan' AS `role`, 'Resident' AS `is_resident`, 'Resident' AS `account_type` FROM `residents`union all select `non_residents`.`user_id` AS `user_id`,`non_residents`.`pangalan` AS `pangalan`,`non_residents`.`email` AS `email`,`non_residents`.`password` AS `password`,'mamamayan' AS `mamamayan`,'Non Resident' AS `Non Resident`,'Non Resident' AS `Non Resident` from `non_residents` union all select `administrators`.`user_id` AS `user_id`,`administrators`.`pangalan` AS `pangalan`,`administrators`.`email` AS `email`,`administrators`.`password` AS `password`,`administrators`.`role` AS `role`,'Resident' AS `Resident`,'Administrator' AS `Administrator` from `administrators`  ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `account_sequence`
--
ALTER TABLE `account_sequence`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `actions`
--
ALTER TABLE `actions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `complaint_id` (`complaint_id`);

--
-- Indexes for table `administrators`
--
ALTER TABLE `administrators`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_administrators_email` (`email`);

--
-- Indexes for table `case_lupon`
--
ALTER TABLE `case_lupon`
  ADD PRIMARY KEY (`id`),
  ADD KEY `complaint_id` (`complaint_id`),
  ADD KEY `lupon_id` (`lupon_id`);

--
-- Indexes for table `complaints`
--
ALTER TABLE `complaints`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `blotter_number` (`blotter_number`),
  ADD KEY `idx_complaints_status` (`status`),
  ADD KEY `idx_complaints_user` (`user_id`),
  ADD KEY `idx_complaints_blotter` (`blotter_number`);

--
-- Indexes for table `complaint_types`
--
ALTER TABLE `complaint_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `complaint_zones`
--
ALTER TABLE `complaint_zones`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `evidence`
--
ALTER TABLE `evidence`
  ADD PRIMARY KEY (`id`),
  ADD KEY `complaint_id` (`complaint_id`);

--
-- Indexes for table `google_login_otps`
--
ALTER TABLE `google_login_otps`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `challenge_hash` (`challenge_hash`),
  ADD KEY `idx_google_login_email` (`email`),
  ADD KEY `idx_google_login_expiry` (`expires_at`);

--
-- Indexes for table `knowledge_base`
--
ALTER TABLE `knowledge_base`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `logs`
--
ALTER TABLE `logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `lupon_members`
--
ALTER TABLE `lupon_members`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_messages_complaint` (`complaint_id`);

--
-- Indexes for table `non_residents`
--
ALTER TABLE `non_residents`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `uq_non_residents_username` (`username`),
  ADD KEY `idx_non_residents_email` (`email`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_user` (`user_id`);

--
-- Indexes for table `password_reset_otps`
--
ALTER TABLE `password_reset_otps`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_password_reset_email` (`email`),
  ADD KEY `idx_password_reset_expiry` (`expires_at`);

--
-- Indexes for table `residents`
--
ALTER TABLE `residents`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `uq_residents_username` (`username`),
  ADD KEY `idx_residents_email` (`email`);

--
-- Indexes for table `schedules`
--
ALTER TABLE `schedules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_schedules_complaint` (`complaint_id`);

--
-- Indexes for table `site_settings`
--
ALTER TABLE `site_settings`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `witnesses`
--
ALTER TABLE `witnesses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `complaint_id` (`complaint_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `actions`
--
ALTER TABLE `actions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `case_lupon`
--
ALTER TABLE `case_lupon`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `complaints`
--
ALTER TABLE `complaints`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `complaint_types`
--
ALTER TABLE `complaint_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `complaint_zones`
--
ALTER TABLE `complaint_zones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=291;

--
-- AUTO_INCREMENT for table `evidence`
--
ALTER TABLE `evidence`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `google_login_otps`
--
ALTER TABLE `google_login_otps`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `knowledge_base`
--
ALTER TABLE `knowledge_base`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `logs`
--
ALTER TABLE `logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `lupon_members`
--
ALTER TABLE `lupon_members`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `password_reset_otps`
--
ALTER TABLE `password_reset_otps`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `schedules`
--
ALTER TABLE `schedules`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `witnesses`
--
ALTER TABLE `witnesses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `actions`
--
ALTER TABLE `actions`
  ADD CONSTRAINT `actions_ibfk_1` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`);

--
-- Constraints for table `case_lupon`
--
ALTER TABLE `case_lupon`
  ADD CONSTRAINT `case_lupon_ibfk_1` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `case_lupon_ibfk_2` FOREIGN KEY (`lupon_id`) REFERENCES `lupon_members` (`id`);

--
-- Constraints for table `evidence`
--
ALTER TABLE `evidence`
  ADD CONSTRAINT `evidence_ibfk_1` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`);

--
-- Constraints for table `schedules`
--
ALTER TABLE `schedules`
  ADD CONSTRAINT `schedules_ibfk_1` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `witnesses`
--
ALTER TABLE `witnesses`
  ADD CONSTRAINT `witnesses_ibfk_1` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
