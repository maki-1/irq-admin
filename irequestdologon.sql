-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 07, 2026 at 03:04 AM
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
-- Database: `irequestdologon`
--

-- --------------------------------------------------------

--
-- Table structure for table `audit_trail`
--

CREATE TABLE `audit_trail` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `username` varchar(100) DEFAULT NULL,
  `role` varchar(50) NOT NULL,
  `action` varchar(255) NOT NULL,
  `details` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `audit_trail`
--

INSERT INTO `audit_trail` (`id`, `user_id`, `username`, `role`, `action`, `details`, `created_at`) VALUES
(35, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 140, New Value: Signed', '2026-03-03 04:52:50'),
(36, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 140, New Value: Sealed', '2026-03-03 04:52:53'),
(38, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 141, New Value: Sealed', '2026-03-03 04:52:59'),
(39, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 273, New Value: Signed', '2026-03-10 04:22:20'),
(40, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 273, New Value: Sealed', '2026-03-10 04:22:24'),
(41, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 272, New Value: Signed', '2026-03-11 09:15:00'),
(42, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 272, New Value: Sealed', '2026-03-11 09:15:03'),
(43, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 143, New Value: Signed', '2026-03-11 09:15:06'),
(44, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 143, New Value: Sealed', '2026-03-11 09:15:09'),
(45, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 283, New Value: Signed', '2026-03-11 09:15:11'),
(46, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 284, New Value: Signed', '2026-03-11 09:15:20'),
(47, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 283, New Value: Sealed', '2026-03-11 09:15:24'),
(48, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 284, New Value: Sealed', '2026-03-11 09:15:26'),
(49, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 285, New Value: ', '2026-03-11 09:19:00'),
(50, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 285, New Value: Signed', '2026-03-11 09:19:06'),
(51, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 285, New Value: Sealed', '2026-03-11 09:19:09'),
(52, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 286, New Value: Signed', '2026-03-11 11:22:17'),
(53, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 286, New Value: Sealed', '2026-03-11 11:22:19'),
(54, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 289, New Value: Signed', '2026-03-12 03:04:11'),
(55, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 289, New Value: Sealed', '2026-03-12 03:04:13'),
(56, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 290, New Value: Signed', '2026-03-12 06:07:13'),
(57, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 290, New Value: Sealed', '2026-03-12 06:07:16'),
(58, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 324, New Value: ', '2026-03-16 09:18:42'),
(59, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 324, New Value: Signed', '2026-03-16 10:03:39'),
(60, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 324, New Value: Sealed', '2026-03-16 10:03:42'),
(61, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 320, New Value: Signed', '2026-03-16 10:04:18'),
(62, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 320, New Value: Sealed', '2026-03-16 10:04:21'),
(63, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 323, New Value: ', '2026-03-16 10:04:23'),
(64, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 325, New Value: Signed', '2026-03-17 05:42:05'),
(65, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 325, New Value: Sealed', '2026-03-17 05:42:10'),
(66, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 327, New Value: ', '2026-03-19 05:03:06'),
(67, 56, 'Barangay Captain', 'Barangay Captain', 'Signed Document', 'Request ID: 380, New Value: Signed', '2026-03-30 07:46:58'),
(68, 56, 'Barangay Captain', 'Barangay Captain', 'Sealed Document', 'Request ID: 380, New Value: Sealed', '2026-03-30 07:47:04');

-- --------------------------------------------------------

--
-- Table structure for table `brgy_documents`
--

CREATE TABLE `brgy_documents` (
  `id` int(11) NOT NULL,
  `full_name` varchar(100) DEFAULT NULL,
  `age` int(11) DEFAULT NULL,
  `marital_status` varchar(20) DEFAULT NULL,
  `purok` varchar(50) DEFAULT NULL,
  `document_type` varchar(50) DEFAULT NULL,
  `day` varchar(2) DEFAULT NULL,
  `month` varchar(20) DEFAULT NULL,
  `year` varchar(4) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `payment_status` varchar(20) DEFAULT '',
  `document_fee` int(11) NOT NULL DEFAULT 0,
  `receipt_file` varchar(255) DEFAULT NULL,
  `signature_status` varchar(50) DEFAULT '',
  `seal_status` varchar(50) DEFAULT '',
  `resident_type` varchar(20) NOT NULL DEFAULT 'Regular',
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `or_number` varchar(20) DEFAULT NULL,
  `resident_id` int(11) DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `ip_member` varchar(10) NOT NULL,
  `ethnic_group` varchar(100) DEFAULT NULL,
  `registered_voter` varchar(10) NOT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `custom_id` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `brgy_documents`
--

INSERT INTO `brgy_documents` (`id`, `full_name`, `age`, `marital_status`, `purok`, `document_type`, `day`, `month`, `year`, `status`, `payment_status`, `document_fee`, `receipt_file`, `signature_status`, `seal_status`, `resident_type`, `updated_at`, `or_number`, `resident_id`, `gender`, `date_of_birth`, `ip_member`, `ethnic_group`, `registered_voter`, `contact_number`, `email`, `custom_id`) VALUES
(289, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '12', 'MARCH', '2026', 'Printing', 'Paid', 130, 'receipt_289_1773284682.jpg', 'Signed', 'Sealed', 'Regular', '2026-03-30 15:41:34', NULL, 88, 'Male', '1995-12-10', '', NULL, '', '09267979552', 'jyanson@aclcbukidnon.com', NULL),
(290, 'Karl Christian Trabuco', 23, 'Single', '10', 'Certificate of Residency', '12', 'MARCH', '2026', 'Printing', 'Paid', 130, 'receipt_290_1773295599.jpg', 'Signed', 'Sealed', 'Regular', '2026-03-25 10:00:40', NULL, 98, 'Male', '2003-01-02', '', NULL, '', '09267979552', 'karlchristiantrabuco2003@gmail.com', NULL),
(309, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '14', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-17 15:02:14', NULL, 99, 'Male', '1995-12-10', '', NULL, '', '09267979552', 'jyanson@aclcbukidnon.com', NULL),
(321, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '16', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-16 13:59:30', NULL, 99, 'Male', '1995-12-10', '', NULL, '', '09267979552', 'jyanson@aclcbukidnon.com', NULL),
(325, 'Eric Pacatang', 21, 'Single', '9', 'Barangay Clearance', '17', 'MARCH', '2026', 'Printing', 'Pending Verification', 130, 'receipt_325_1773723826.jpg', 'Signed', 'Sealed', 'Regular', '2026-03-20 20:00:10', NULL, 99, 'Male', '2004-05-03', '', NULL, '', '09354518953', 'ericpacatang.323@gmail.com', NULL),
(326, 'Rosalie Lusing', 21, 'Single', '4', 'Certificate of Indigency', '17', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-20 20:00:36', NULL, 101, 'Female', '2004-08-11', '', NULL, '', '09107223489', 'lusingrosalie@gmail.com', NULL),
(327, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '18', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-18 11:49:32', NULL, 99, 'Male', '1995-12-10', '', NULL, '', '09267979552', 'jyanson@aclcbukidnon.com', 'DL-0001'),
(328, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '18', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-23 16:47:19', NULL, 99, 'Male', '1995-12-10', '', NULL, '', '09267979552', 'jyanson@aclcbukidnon.com', 'DL-0002'),
(342, 'Karl Christian Trabuco', 23, 'Single', '4', 'Barangay Clearance', '19', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-04-05 08:09:19', NULL, 88, 'Male', '2003-01-02', '', NULL, '', '09267979552', 'karlchristiantrabuco2003@gmail.com', 'DL-0004'),
(351, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '21', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-04-05 08:09:48', NULL, 105, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0005'),
(352, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '22', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-23 16:18:58', NULL, 107, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0006'),
(353, 'Jezreel Yanson', 30, 'Single', '10', 'Certificate of Residency', '22', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-04-05 13:44:37', NULL, 107, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0007'),
(354, 'Jezreel Yanson', 30, 'Single', '10', 'Certificate of Residency', '22', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-22 13:56:07', NULL, 107, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0008'),
(358, 'Jezreel Yanson', 30, 'Single', '10', 'Certificate of Indigency', '22', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-22 14:47:33', NULL, 107, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0009'),
(359, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '23', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-23 08:12:46', NULL, 107, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0010'),
(360, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '23', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-23 08:13:07', NULL, 107, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0011'),
(361, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '23', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-23 08:13:55', NULL, 107, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0012'),
(362, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '23', 'MARCH', '2026', 'paid', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-23 08:15:10', NULL, 107, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0013'),
(367, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '23', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-04-05 08:46:10', NULL, 108, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0014'),
(368, 'Jezreel Yanson', 30, 'Single', '10', 'Certificate of Residency', '23', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-04-05 08:10:32', NULL, 108, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0015'),
(369, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '24', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-24 18:13:55', NULL, 108, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0017'),
(370, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '24', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-04-05 08:10:25', NULL, 108, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0019'),
(371, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '24', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-25 01:57:40', NULL, 108, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0021'),
(372, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '24', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-04-05 08:46:19', NULL, 108, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0022'),
(373, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '29', 'MARCH', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-30 15:42:03', NULL, 109, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0023'),
(374, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '29', 'MARCH', '2026', 'paid', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-29 16:55:40', NULL, 109, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0025'),
(375, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '29', 'MARCH', '2026', 'paid', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-29 16:56:22', NULL, 109, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0027'),
(376, 'Jezreel Yanson', 30, 'Single', '10', 'Barangay Clearance', '29', 'MARCH', '2026', 'Printing', 'Pending Verification', 130, 'receipt_376_1774774634.jpg', '', '', 'Regular', '2026-04-05 08:10:41', NULL, 109, 'Male', '1995-12-10', 'No', '', 'Yes', '09267979552', 'jezreelgemysalazaryanson@gmail.com', 'DL-0028'),
(377, 'Mechelle Madjos', 32, 'Single', '9', 'Certificate of Residency', '30', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-30 15:21:42', NULL, 110, 'Female', '1993-10-13', 'No', '', 'Yes', '09708999432', 'ilovehuzonmymind@gmail.com', 'DL-0029'),
(378, 'Mechelle Madjos', 32, 'Single', '9', 'Certificate of Residency', '30', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-30 15:22:41', NULL, 110, 'Female', '1993-10-13', 'No', '', 'Yes', '09708999432', 'ilovehuzonmymind@gmail.com', 'DL-0030'),
(379, 'Mechelle Madjos', 32, 'Single', '9', 'Certificate of Indigency', '30', 'MARCH', '2026', 'Printing', 'Exempt', 130, NULL, '', '', 'PWD', '2026-03-30 15:37:25', NULL, 110, 'Female', '1993-10-13', 'No', '', 'Yes', '09708999432', 'ilovehuzonmymind@gmail.com', 'DL-0031'),
(380, 'Mechelle Madjos', 32, 'Single', '9', 'Certificate of Indigency', '30', 'MARCH', '2026', 'Completed', 'Paid', 130, 'receipt_380_1774856115.jpg', 'Signed', 'Sealed', 'Regular', '2026-03-30 15:47:04', NULL, 110, 'Female', '1993-10-13', 'No', '', 'Yes', '09708999432', 'ilovehuzonmymind@gmail.com', 'DL-0032'),
(381, 'Mechelle Madjos', 32, 'Single', '9', 'Certificate of Indigency', '30', 'MARCH', '2026', 'paid', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-30 15:50:39', NULL, 110, 'Female', '1993-10-13', 'No', '', 'Yes', '09708999432', 'ilovehuzonmymind@gmail.com', 'DL-0034'),
(382, 'Mechelle Madjos', 32, 'Single', '9', 'Certificate of Indigency', '30', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-30 15:51:04', NULL, 110, 'Female', '1993-10-13', 'No', '', 'Yes', '09708999432', 'ilovehuzonmymind@gmail.com', 'DL-0035'),
(383, 'Carla Comonlay', 21, 'Single', '3', 'Certificate of Residency', '30', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'IP', '2026-03-30 16:35:55', NULL, 104, 'Female', '2004-07-13', 'Yes', 'Higaonon', 'Yes', '09465653386', 'comonlaycc@gmail.com', 'DL-0036'),
(384, 'Dexter Castor', 31, 'Single', '2', 'Barangay Clearance', '30', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-30 16:41:16', NULL, 103, 'Male', '1994-04-01', 'No', '', 'Yes', '09267979552', 'dextercastor28@gmail.com', 'DL-0037'),
(385, 'Kate Ellah Eliseo', 24, 'Separated', '12', 'Certificate of Indigency', '30', 'MARCH', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-03-30 16:51:36', NULL, 102, 'Female', '2001-05-07', 'No', '', 'Yes', '09267979552', 'kateellaheliseo@gmail.com', 'DL-0038'),
(386, 'Kate Ellah Eliseo', 24, 'Separated', '12', 'Barangay Clearance', '4', 'APRIL', '2026', 'Printing', 'Paid', 130, 'receipt_386_1775293027.jpg', '', '', 'Regular', '2026-04-05 11:29:37', NULL, 102, 'Female', '2001-05-07', 'No', '', 'Yes', '09267979552', 'kateellaheliseo@gmail.com', 'DL-0039'),
(387, 'Mechelle Madjos', 32, 'Single', '9', 'Certificate of Indigency', '4', 'APRIL', '2026', 'Printing', 'Pending', 130, NULL, '', '', 'Regular', '2026-04-05 11:24:39', NULL, 110, 'Female', '1993-10-13', 'No', '', 'Yes', '09708999432', 'ilovehuzonmymind@gmail.com', 'DL-0040'),
(388, 'Mechelle Madjos', 32, 'Single', '9', 'Certificate of Residency', '4', 'APRIL', '2026', 'Printing', 'Pending Verification', 130, 'receipt_388_1775299448.jpg', '', '', 'Regular', '2026-04-05 13:20:33', NULL, 110, 'Female', '1993-10-13', 'No', '', 'Yes', '09708999432', 'ilovehuzonmymind@gmail.com', 'DL-0041'),
(389, 'Traces Lequin', 36, 'Married', '7', 'Barangay Clearance', '5', 'APRIL', '2026', 'paid', 'Pending', 130, NULL, '', '', 'Regular', '2026-04-05 12:55:50', NULL, 112, 'Male', '1989-09-18', 'No', '', 'Yes', '09267979552', 'tllequin@cityofvalencia.gov.ph', 'DL-0043'),
(390, 'kjkhkhkh', 30, 'Single', '10', 'Barangay Clearance', '6', 'APRIL', '2026', 'Pending', 'Pending', 130, NULL, '', '', 'Regular', '2026-04-06 19:28:04', NULL, 113, 'Male', '1995-12-10', 'No', '', 'Yes', '97878868789', 'j@gmail.com', 'DL-0045');

-- --------------------------------------------------------

--
-- Table structure for table `email_verifications`
--

CREATE TABLE `email_verifications` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `code` varchar(6) NOT NULL,
  `expiry_time` datetime NOT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `email_verifications`
--

INSERT INTO `email_verifications` (`id`, `email`, `code`, `expiry_time`, `created_at`) VALUES
(5, 'ceballosmarkjune@gmail.com', '460776', '2026-01-29 10:23:32', '2026-01-29 10:08:32'),
(24, 'christineclaireyanson@gmail.com', '126255', '2026-02-06 13:35:11', '2026-02-06 13:20:11'),
(26, 's.anfonenikojay@cmu.edu.ph', '156558', '2026-02-06 13:47:20', '2026-02-06 13:32:20'),
(40, 'fheviealivio@gmail.com', '517090', '2026-02-14 22:37:54', '2026-02-14 22:22:54'),
(63, 'godsentgracesalazar@gmail.com', '889348', '2026-02-25 15:25:04', '2026-02-25 15:10:04'),
(66, 'jessienette.paragat@gmail.com', '453830', '2026-02-27 15:00:04', '2026-02-27 14:45:04'),
(83, 'ilovehuzonmymind@gmail.com', '794056', '2026-04-04 19:18:17', '2026-04-04 19:03:17'),
(84, 'tllequin@cityofvalencia.gov.ph', '607924', '2026-04-05 12:19:21', '2026-04-05 12:04:21');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `message` text NOT NULL,
  `status` varchar(20) DEFAULT 'Unread',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `message`, `status`, `created_at`) VALUES
(33, 110, '✅ Done processing your requested document. Request ID No. DL-0030. \r\nIt is now ready for pick-up at the Barangay Office of Dologon.', 'Read', '2026-03-30 07:30:29'),
(34, 112, '✅ Done processing your requested document. Request ID No. DL-0042. \r\nIt is now ready for pick-up at the Barangay Office of Dologon.', 'Read', '2026-04-05 05:46:04');

-- --------------------------------------------------------

--
-- Table structure for table `paymongo_payments`
--

CREATE TABLE `paymongo_payments` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `document_id` int(11) NOT NULL,
  `document_type` varchar(255) NOT NULL,
  `amount` int(11) NOT NULL,
  `paymongo_session_id` varchar(255) NOT NULL,
  `paymongo_payment_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` varchar(20) NOT NULL DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `paymongo_payments`
--

INSERT INTO `paymongo_payments` (`id`, `user_id`, `document_id`, `document_type`, `amount`, `paymongo_session_id`, `paymongo_payment_id`, `created_at`, `status`) VALUES
(56, 1, 271, 'Barangay Clearance', 13000, 'cs_a88251832b23f2ffe382b632', 'cs_a88251832b23f2ffe382b632', '2026-03-09 03:43:38', 'paid'),
(58, 1, 276, 'Certificate of Residency', 13000, 'cs_01b9785c918fb12a031ed32a', NULL, '2026-03-10 04:26:03', 'pending'),
(59, 1, 278, 'Certificate of Residency', 13000, 'cs_c4c2a95b01204e045ea25a2f', NULL, '2026-03-10 07:44:08', 'pending'),
(60, 1, 279, 'Certificate of Indigency', 13000, 'cs_3ac9302f6d28ccbcab51a7a4', NULL, '2026-03-10 13:45:56', 'pending'),
(61, 1, 299, 'Barangay Clearance', 13000, 'cs_0110767bde820966d6c4c828', NULL, '2026-03-13 04:23:00', 'pending'),
(62, 1, 315, 'Barangay Clearance', 13000, 'cs_3714a9917d57646545d86fe9', NULL, '2026-03-16 05:32:32', 'pending'),
(63, 1, 319, 'Barangay Clearance', 13000, 'cs_cec4d62c5c216083ce6d62b7', NULL, '2026-03-16 05:59:02', 'pending'),
(64, 1, 347, 'Barangay Clearance', 13000, 'cs_d4db5b4c8c6909ac4c33c01c', NULL, '2026-03-20 02:13:50', 'pending'),
(65, 1, 362, 'Barangay Clearance', 13000, 'cs_9626103f2550a5ba8fcf9ff6', NULL, '2026-03-23 00:14:19', 'pending'),
(66, 1, 363, 'Barangay Clearance', 13000, 'cs_33c8e671772f1e312d1d077a', NULL, '2026-03-23 00:21:09', 'pending'),
(67, 1, 364, 'Barangay Clearance', 13000, 'cs_aa1385bbc74423bbb3c90bfe', NULL, '2026-03-23 00:24:31', 'pending'),
(68, 1, 365, 'Barangay Clearance', 13000, 'cs_a075baa1f123313bbe5b2cec', NULL, '2026-03-23 00:28:47', 'pending'),
(69, 1, 366, 'Barangay Clearance', 13000, 'cs_84e75aa56cb90d11770c732a', NULL, '2026-03-23 00:30:58', 'pending'),
(70, 1, 369, 'Barangay Clearance', 13000, 'cs_01ae451d309509a4af1cd4ea', NULL, '2026-03-24 10:13:56', 'pending'),
(71, 1, 370, 'Barangay Clearance', 13000, 'cs_98c48544b622af90afd19f7d', NULL, '2026-03-24 10:14:51', 'pending'),
(72, 1, 371, 'Barangay Clearance', 13000, 'cs_b0328074ff1c355869197ba8', NULL, '2026-03-24 17:57:41', 'pending'),
(73, 1, 374, 'Barangay Clearance', 13000, 'cs_a976b70872f086e50ca34fff', NULL, '2026-03-29 08:55:19', 'pending'),
(74, 1, 375, 'Barangay Clearance', 13000, 'cs_795ddace81a7c5992d40b7b0', NULL, '2026-03-29 08:56:06', 'pending'),
(75, 1, 381, 'Certificate of Indigency', 13000, 'cs_e1b4ad99808c45925f527b4c', NULL, '2026-03-30 07:49:13', 'pending'),
(76, 1, 389, 'Barangay Clearance', 13000, 'cs_d27cf73904af63f95fea06fa', NULL, '2026-04-05 04:55:19', 'pending'),
(77, 1, 390, 'Barangay Clearance', 13000, 'cs_e337fe87189682df5f439dfc', NULL, '2026-04-06 11:28:05', 'pending');

-- --------------------------------------------------------

--
-- Table structure for table `resident_photos`
--

CREATE TABLE `resident_photos` (
  `id` int(11) NOT NULL,
  `resident_id` int(11) NOT NULL,
  `photo_file` varchar(255) NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `resident_photos`
--

INSERT INTO `resident_photos` (`id`, `resident_id`, `photo_file`, `uploaded_at`) VALUES
(7, 289, 'resident_88_1773284607.jpg', '2026-03-12 03:03:27'),
(8, 290, 'resident_98_1773295561.jpg', '2026-03-12 06:06:01'),
(16, 309, 'resident_99_1773483625.jpeg', '2026-03-14 10:20:25'),
(20, 321, 'resident_99_1773640770.jpg', '2026-03-16 05:59:30'),
(21, 325, 'resident_99_1773723771.jpg', '2026-03-17 05:02:52'),
(22, 326, 'resident_101_1773737163.jpeg', '2026-03-17 08:46:03'),
(23, 378, 'resident_110_1774855361.jpg', '2026-03-30 07:22:41'),
(24, 383, 'resident_104_1774859755.jpg', '2026-03-30 08:35:55'),
(25, 384, 'resident_103_1774860076.jpg', '2026-03-30 08:41:16'),
(26, 385, 'resident_102_1774860696.jpg', '2026-03-30 08:51:36');

-- --------------------------------------------------------

--
-- Table structure for table `stripe_payments`
--

CREATE TABLE `stripe_payments` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `document_type` varchar(100) NOT NULL,
  `amount` int(11) NOT NULL,
  `stripe_session_id` varchar(255) NOT NULL,
  `payment_status` varchar(50) DEFAULT 'PENDING',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stripe_payments`
--

INSERT INTO `stripe_payments` (`id`, `user_id`, `document_type`, `amount`, `stripe_session_id`, `payment_status`, `created_at`) VALUES
(1, 1, '0', 4000, 'cs_test_a1mv3oSe3DITF0bHEviW3lhkoJeyIvu26fihkFD5KygTV5xJFxjrbWCKhb', 'PENDING', '2026-02-03 02:55:37'),
(44, 1, '0', 13000, 'cs_test_a1DEX0T9XSPfz4fSimxQEvFg5NQ7W2u2fNBV8b2MReJ24wF2ba9gZmoNj8', 'PENDING', '2026-03-08 07:20:15'),
(45, 1, '0', 13000, 'cs_test_a1CF2wtKVD4b85HWGaH2Ad35gkypCcR1n4zrawjyx9lelnYdKbxsioRvQ1', 'PENDING', '2026-03-13 04:22:30'),
(46, 1, '0', 13000, 'cs_test_a1DSm7ILyw7KM1q6o3bkeDSy4t7aivsmcaUk0K0eFMQKerWrQxIk5iZQBu', 'PENDING', '2026-03-16 05:33:31'),
(47, 1, '0', 13000, 'cs_test_a1g4KJjsKbaP6f9KdjPyKFaoliklXYUoTBcwd3DV1R3hXokRYNhTtSaWOK', 'PENDING', '2026-03-16 05:59:16'),
(48, 1, '0', 13000, 'cs_test_a1Mzma7xehoDDO5t8hn6XdFoNaUg7jzpd7kqATqUdTR12aujH6vCcptzrN', 'PENDING', '2026-03-20 02:14:37'),
(49, 1, '0', 13000, 'cs_test_a1yA8WsnPot9BLV8BfuVeMzvHsMLdxUyDkzOSYTprrkTwNfCDMT7aPlDqC', 'PENDING', '2026-03-23 00:14:00'),
(50, 1, '0', 13000, 'cs_test_a1AKrAikQ7MmSbk155I6ou6qTHDG2TahKdRH3n8QXnqon55U0OIqC43ngk', 'PENDING', '2026-03-24 17:58:00'),
(51, 1, '0', 13000, 'cs_test_a14weFhRKcgp6bjfchxfsvGJB9FD5r7wnWmZzkIapiNkBOAVte7SHmjZXy', 'PENDING', '2026-03-29 08:54:53'),
(52, 1, '0', 13000, 'cs_test_a1JrgmynOrxlzYPYqUuWxPzlsAoY3qGI0iItnMaMd3a4pPnAGKfnTI3DAY', 'PENDING', '2026-03-30 07:51:29');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `purok` varchar(50) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `resident_status` enum('Pending','Verified','Rejected') DEFAULT 'Pending',
  `oauth_provider` varchar(50) DEFAULT NULL,
  `oauth_id` bigint(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `full_name`, `purok`, `email`, `password`, `created_at`, `resident_status`, `oauth_provider`, `oauth_id`) VALUES
(36, 'Fritz Santiago', '', 'santiagoquinto164@gmail.com', 'dologon123', '2026-02-10 01:10:35', 'Rejected', NULL, NULL),
(49, 'Fhevie Alivio', 'Purok 8', 'fheviealivio@gmail.com', 'dologon123', '2026-02-14 14:22:54', 'Rejected', NULL, NULL),
(56, 'apple pedrosa', 'Purok 12', 'rhealenepedrosa22@gmail.com', 'dologon123', '2026-02-16 05:57:01', 'Verified', NULL, NULL),
(57, 'Christine Yanson', 'Purok 10', 'dayonyanson@gmail.com', 'dologon123', '2026-02-16 11:31:50', 'Verified', NULL, NULL),
(60, 'Kim Joshua', 'Purok 6', 'kimjoshualabarquez@gmail.com', 'dologon123', '2026-02-18 07:00:24', 'Verified', NULL, NULL),
(88, 'Godsent Grace', 'Purok 11', 'godsentgracesalazar@gmail.com', 'dologon123', '2026-02-25 07:10:04', 'Rejected', NULL, NULL),
(91, 'Jessie Nette Paragat', 'Purok 3', 'jessienette.paragat@gmail.com', 'dologon123', '2026-02-27 06:45:04', 'Verified', NULL, NULL),
(92, 'Angeline Morales', 'Purok 10', 'angelinemorales648@gmail.com', 'dologon123', '2026-02-27 07:09:01', 'Rejected', NULL, NULL),
(93, 'Karl Christian Trabuco', 'Purok 6', 'karlchristiantrabuco382@gmail.com', 'dologon123', '2026-02-27 07:16:51', 'Verified', NULL, NULL),
(94, 'Alexander Locsin Ortiz', 'Purok 1', 'alexanderlocsinortiz@gmail.com', 'dologon123', '2026-02-27 07:20:31', 'Verified', NULL, NULL),
(98, 'Karl Christian Trabuco', 'Purok 7', 'karlchristiantrabuco2003@gmail.com', 'dologon123', '2026-03-10 04:37:13', 'Verified', NULL, NULL),
(101, 'Rosalie Lusing', 'Purok 4', 'lusingrosalie@gmail.com', 'dologon123', '2026-03-17 08:30:29', 'Verified', NULL, NULL),
(102, 'Kate Ellah Eliseo', 'Purok 7', 'kateellaheliseo@gmail.com', 'dologon123', '2026-03-17 08:32:59', 'Verified', NULL, NULL),
(103, 'Dexter Castor', 'Purok 9', 'dextercastor28@gmail.com', 'dologon123', '2026-03-17 08:35:00', 'Verified', NULL, NULL),
(104, 'Comonlay', 'Purok 2', 'comonlaycc@gmail.com', 'dologon123', '2026-03-17 08:38:10', 'Verified', NULL, NULL),
(112, 'Traces Lequin', 'Purok 7', 'tllequin@cityofvalencia.gov.ph', 'dologon123', '2026-04-05 04:04:21', 'Verified', NULL, NULL),
(113, 'Jezreel Yanson', 'Purok 10', 'jyanson@aclcbukidnon.com', 'dologon123', '2026-04-06 00:02:10', 'Verified', NULL, NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `audit_trail`
--
ALTER TABLE `audit_trail`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `brgy_documents`
--
ALTER TABLE `brgy_documents`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `custom_id` (`custom_id`);

--
-- Indexes for table `email_verifications`
--
ALTER TABLE `email_verifications`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `paymongo_payments`
--
ALTER TABLE `paymongo_payments`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `resident_photos`
--
ALTER TABLE `resident_photos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `resident_id` (`resident_id`);

--
-- Indexes for table `stripe_payments`
--
ALTER TABLE `stripe_payments`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `audit_trail`
--
ALTER TABLE `audit_trail`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=69;

--
-- AUTO_INCREMENT for table `brgy_documents`
--
ALTER TABLE `brgy_documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=391;

--
-- AUTO_INCREMENT for table `email_verifications`
--
ALTER TABLE `email_verifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=86;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `paymongo_payments`
--
ALTER TABLE `paymongo_payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=78;

--
-- AUTO_INCREMENT for table `resident_photos`
--
ALTER TABLE `resident_photos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `stripe_payments`
--
ALTER TABLE `stripe_payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=114;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `resident_photos`
--
ALTER TABLE `resident_photos`
  ADD CONSTRAINT `resident_photos_ibfk_1` FOREIGN KEY (`resident_id`) REFERENCES `brgy_documents` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
