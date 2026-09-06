-- ==========================================
-- FULL DATABASE SCHEMA DUMP
-- Generated at: 2026-01-22T11:05:24.940Z
-- ==========================================

SET FOREIGN_KEY_CHECKS = 0;

-- Table: addresses
CREATE TABLE IF NOT EXISTS addresses (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  address_type_id int(11) NOT NULL,
  division_id int(11) DEFAULT NULL,
  district_id int(11) DEFAULT NULL,
  upazila_id int(11) DEFAULT NULL,
  village_area varchar(255) DEFAULT NULL,
  post_office varchar(100) DEFAULT NULL,
  post_code varchar(10) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY unique_user_address_type (user_id,address_type_id),
  KEY address_type_id (address_type_id),
  KEY division_id (division_id),
  KEY district_id (district_id),
  KEY upazila_id (upazila_id),
  CONSTRAINT addresses_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE,
  CONSTRAINT addresses_ibfk_2 FOREIGN KEY (address_type_id) REFERENCES address_types (id),
  CONSTRAINT addresses_ibfk_3 FOREIGN KEY (division_id) REFERENCES divisions (id),
  CONSTRAINT addresses_ibfk_4 FOREIGN KEY (district_id) REFERENCES districts (id),
  CONSTRAINT addresses_ibfk_5 FOREIGN KEY (upazila_id) REFERENCES upazilas (id)
);

-- Table: address_types
CREATE TABLE IF NOT EXISTS address_types (
  id int(11) NOT NULL AUTO_INCREMENT,
  type_name varchar(50) NOT NULL COMMENT 'Permanent, Present, Office, etc.',
  PRIMARY KEY (id),
  UNIQUE KEY type_name (type_name)
);

-- Table: admins
CREATE TABLE IF NOT EXISTS admins (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  password varchar(255) NOT NULL,
  mobile varchar(20) DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  approved_by int(11) DEFAULT NULL,
  approved_at datetime DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  KEY idx_admin_email (email),
  KEY idx_admin_status (status)
);

-- Table: admin_actions_log
CREATE TABLE IF NOT EXISTS admin_actions_log (
  id int(11) NOT NULL AUTO_INCREMENT,
  admin_id int(11) NOT NULL,
  action_type varchar(50) NOT NULL,
  target_table varchar(50) NOT NULL,
  target_id int(11) NOT NULL,
  old_status varchar(50) DEFAULT NULL,
  new_status varchar(50) DEFAULT NULL,
  notes text DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY admin_id (admin_id),
  KEY idx_admin_action_date (created_at),
  CONSTRAINT admin_actions_log_ibfk_1 FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
);

-- Table: admin_login_logs
CREATE TABLE IF NOT EXISTS admin_login_logs (
  id int(11) NOT NULL AUTO_INCREMENT,
  admin_id int(11) NOT NULL,
  login_time timestamp NOT NULL DEFAULT current_timestamp(),
  ip_address varchar(45) DEFAULT NULL,
  status enum('success','failed') DEFAULT 'success',
  failure_reason varchar(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY admin_id (admin_id),
  CONSTRAINT admin_login_logs_ibfk_1 FOREIGN KEY (admin_id) REFERENCES admins (id)
);

-- Table: agri_crop_reports
CREATE TABLE IF NOT EXISTS agri_crop_reports (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  crop_name varchar(100) DEFAULT NULL,
  yield_metric_ton decimal(10,2) DEFAULT NULL,
  season varchar(50) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY fk_agri_crop_reports_user (user_id),
  CONSTRAINT fk_agri_crop_reports_user FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: agri_subsidies
CREATE TABLE IF NOT EXISTS agri_subsidies (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  subsidy_type varchar(100) DEFAULT NULL,
  amount_requested decimal(10,2) DEFAULT NULL,
  land_size_acres decimal(10,2) DEFAULT NULL,
  status varchar(20) DEFAULT 'Pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY fk_agri_subsidies_user (user_id),
  CONSTRAINT fk_agri_subsidies_user FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: audit_log
CREATE TABLE IF NOT EXISTS audit_log (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  table_name varchar(100) NOT NULL,
  record_id int(11) NOT NULL,
  action enum('INSERT','UPDATE','DELETE') NOT NULL,
  old_values longtext DEFAULT NULL CHECK (json_valid(old_values)),
  new_values longtext DEFAULT NULL CHECK (json_valid(new_values)),
  changed_fields text DEFAULT NULL COMMENT 'Comma-separated list of changed columns',
  user_id int(11) DEFAULT NULL,
  session_id varchar(100) DEFAULT NULL,
  ip_address varchar(45) DEFAULT NULL,
  user_agent text DEFAULT NULL,
  action_timestamp timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_table_record (table_name,record_id),
  KEY idx_user_actions (user_id,action_timestamp),
  KEY idx_timestamp (action_timestamp)
);

-- Table: cart_items
CREATE TABLE IF NOT EXISTS cart_items (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_nid varchar(50) NOT NULL,
  item_id int(11) NOT NULL,
  quantity int(11) DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_nid (user_nid),
  KEY item_id (item_id),
  CONSTRAINT cart_items_ibfk_1 FOREIGN KEY (user_nid) REFERENCES reg_info (nid) ON DELETE CASCADE,
  CONSTRAINT cart_items_ibfk_2 FOREIGN KEY (item_id) REFERENCES shop_items (id) ON DELETE CASCADE
);

-- Table: community_groups
CREATE TABLE IF NOT EXISTS community_groups (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(255) NOT NULL,
  description text DEFAULT NULL,
  cover_image varchar(255) DEFAULT NULL,
  created_by int(11) NOT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY created_by (created_by),
  CONSTRAINT community_groups_ibfk_1 FOREIGN KEY (created_by) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: community_members
CREATE TABLE IF NOT EXISTS community_members (
  id int(11) NOT NULL AUTO_INCREMENT,
  group_id int(11) NOT NULL,
  user_id int(11) NOT NULL,
  role enum('member','admin') DEFAULT 'member',
  joined_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY unique_membership (group_id,user_id),
  KEY user_id (user_id),
  CONSTRAINT community_members_ibfk_1 FOREIGN KEY (group_id) REFERENCES community_groups (id) ON DELETE CASCADE,
  CONSTRAINT community_members_ibfk_2 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: community_posts
CREATE TABLE IF NOT EXISTS community_posts (
  id int(11) NOT NULL AUTO_INCREMENT,
  group_id int(11) NOT NULL,
  user_id int(11) NOT NULL,
  content text NOT NULL,
  image_url varchar(255) DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  like_count int(11) DEFAULT 0,
  comment_count int(11) DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  updated_at timestamp NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY user_id (user_id),
  KEY idx_community_posts_group (group_id,status),
  CONSTRAINT community_posts_ibfk_1 FOREIGN KEY (group_id) REFERENCES community_groups (id) ON DELETE CASCADE,
  CONSTRAINT community_posts_ibfk_2 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: completed_tasks
CREATE TABLE IF NOT EXISTS completed_tasks (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  service_type varchar(100) NOT NULL,
  original_request_id int(11) NOT NULL,
  unique_number varchar(50) DEFAULT NULL,
  status enum('Approved','Rejected') NOT NULL,
  admin_comment text DEFAULT NULL,
  completed_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT completed_tasks_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: districts
CREATE TABLE IF NOT EXISTS districts (
  id int(11) NOT NULL AUTO_INCREMENT,
  division_id int(11) NOT NULL,
  name varchar(100) NOT NULL,
  PRIMARY KEY (id),
  KEY division_id (division_id),
  CONSTRAINT districts_ibfk_1 FOREIGN KEY (division_id) REFERENCES divisions (id) ON DELETE CASCADE
);

-- Table: divisions
CREATE TABLE IF NOT EXISTS divisions (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
);

-- Table: document_statuses
CREATE TABLE IF NOT EXISTS document_statuses (
  id int(11) NOT NULL AUTO_INCREMENT,
  status_name varchar(50) NOT NULL,
  description varchar(255) DEFAULT NULL,
  color_code varchar(7) DEFAULT '#6B7280' COMMENT 'Hex color for UI display',
  PRIMARY KEY (id),
  UNIQUE KEY status_name (status_name)
);

-- Table: edit_req
CREATE TABLE IF NOT EXISTS edit_req (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  edited_by varchar(255) DEFAULT NULL,
  edited_fields text DEFAULT NULL,
  old_values text DEFAULT NULL,
  new_values text DEFAULT NULL,
  edited_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT edit_req_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: edu_admissions
CREATE TABLE IF NOT EXISTS edu_admissions (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unit_name varchar(100) DEFAULT NULL,
  status varchar(20) DEFAULT 'Pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY fk_edu_user (user_id),
  CONSTRAINT fk_edu_user FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: govt_user_documents
CREATE TABLE IF NOT EXISTS govt_user_documents (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  doc_category varchar(50) NOT NULL,
  identity_number varchar(50) DEFAULT NULL,
  file_path varchar(255) NOT NULL,
  status enum('Pending','Approved','Rejected') DEFAULT 'Pending',
  admin_comment text DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  expiry_date date DEFAULT NULL,
  issue_date date DEFAULT NULL,
  verified_by int(11) DEFAULT NULL,
  verified_at timestamp NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT govt_user_documents_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: health_vaccinations
CREATE TABLE IF NOT EXISTS health_vaccinations (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  vaccine_name varchar(100) DEFAULT NULL,
  status varchar(20) DEFAULT 'Registered',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY fk_health_user (user_id),
  CONSTRAINT fk_health_user FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: landtax
CREATE TABLE IF NOT EXISTS landtax (
  id int(11) NOT NULL AUTO_INCREMENT,
  transaction_id varchar(255) NOT NULL,
  applicant_name varchar(255) NOT NULL,
  father_name varchar(255) DEFAULT NULL,
  mother_name varchar(255) DEFAULT NULL,
  nid varchar(50) NOT NULL,
  mobile varchar(20) NOT NULL,
  division varchar(100) DEFAULT NULL,
  district varchar(100) DEFAULT NULL,
  upazila varchar(100) DEFAULT NULL,
  khatian_no varchar(50) NOT NULL,
  dag_no varchar(50) NOT NULL,
  land_type enum('Residential','Commercial','Agricultural') NOT NULL,
  land_size decimal(10,4) NOT NULL,
  tax_amount decimal(10,2) NOT NULL,
  payment_status enum('Pending','Success','Failed','Cancelled') DEFAULT 'Pending',
  payment_date datetime DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  division_id int(11) DEFAULT NULL,
  district_id int(11) DEFAULT NULL,
  upazila_id int(11) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY transaction_id (transaction_id),
  KEY fk_landtax_division (division_id),
  KEY fk_landtax_district (district_id),
  KEY fk_landtax_upazila (upazila_id),
  CONSTRAINT fk_landtax_district FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE SET NULL,
  CONSTRAINT fk_landtax_division FOREIGN KEY (division_id) REFERENCES divisions (id) ON DELETE SET NULL,
  CONSTRAINT fk_landtax_upazila FOREIGN KEY (upazila_id) REFERENCES upazilas (id) ON DELETE SET NULL
);

-- Table: land_mutations_v2
CREATE TABLE IF NOT EXISTS land_mutations_v2 (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  division_id int(11) DEFAULT NULL,
  district_id int(11) DEFAULT NULL,
  upazila_id int(11) DEFAULT NULL,
  applicant_name varchar(255) DEFAULT NULL,
  applicant_father varchar(255) DEFAULT NULL,
  applicant_mother varchar(255) DEFAULT NULL,
  applicant_nid varchar(50) DEFAULT NULL,
  khatian_no varchar(100) DEFAULT NULL,
  dag_no varchar(100) DEFAULT NULL,
  land_amount varchar(100) DEFAULT NULL,
  land_price decimal(15,2) DEFAULT NULL,
  deed_no varchar(100) DEFAULT NULL,
  ownership_type enum('Own','Other') DEFAULT NULL,
  buyer_name varchar(255) DEFAULT NULL,
  buyer_father_name varchar(255) DEFAULT NULL,
  buyer_mother_name varchar(255) DEFAULT NULL,
  buyer_nid varchar(50) DEFAULT NULL,
  tracking_number varchar(50) DEFAULT NULL,
  status enum('Pending','Approved','Rejected') DEFAULT 'Pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY tracking_number (tracking_number),
  KEY user_id (user_id),
  KEY idx_land_mutations_status (status,created_at),
  CONSTRAINT land_mutations_v2_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id)
);

-- Table: login_logs
CREATE TABLE IF NOT EXISTS login_logs (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  ip_address varchar(45) DEFAULT NULL,
  user_agent text DEFAULT NULL,
  login_time timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT login_logs_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: my_land_record
CREATE TABLE IF NOT EXISTS my_land_record (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  owner_name varchar(255) DEFAULT NULL,
  nid varchar(50) DEFAULT NULL,
  khatian_no varchar(50) NOT NULL,
  dag_no varchar(50) NOT NULL,
  mouza varchar(100) DEFAULT NULL,
  land_size decimal(10,4) DEFAULT NULL,
  ownership_description text DEFAULT NULL,
  status enum('Approved','Pending','Rejected') DEFAULT 'Pending',
  recorded_at timestamp NOT NULL DEFAULT current_timestamp(),
  division varchar(100) DEFAULT NULL,
  division_id int(11) DEFAULT NULL,
  district varchar(100) DEFAULT NULL,
  district_id int(11) DEFAULT NULL,
  upazila varchar(100) DEFAULT NULL,
  upazila_id int(11) DEFAULT NULL,
  father_name varchar(255) DEFAULT NULL,
  mother_name varchar(255) DEFAULT NULL,
  deed_no varchar(100) DEFAULT NULL,
  land_price decimal(15,2) DEFAULT NULL,
  jl_no varchar(50) DEFAULT NULL,
  hold_no varchar(50) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY user_id (user_id),
  KEY fk_my_land_division (division_id),
  KEY fk_my_land_district (district_id),
  KEY fk_my_land_upazila (upazila_id),
  CONSTRAINT fk_my_land_district FOREIGN KEY (district_id) REFERENCES districts (id),
  CONSTRAINT fk_my_land_division FOREIGN KEY (division_id) REFERENCES divisions (id),
  CONSTRAINT fk_my_land_upazila FOREIGN KEY (upazila_id) REFERENCES upazilas (id),
  CONSTRAINT my_land_record_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: nid_cards
CREATE TABLE IF NOT EXISTS nid_cards (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  citizen_id bigint(20) DEFAULT NULL,
  nid_number varchar(20) NOT NULL,
  issue_date date DEFAULT NULL,
  expiry_date date DEFAULT NULL,
  smart_card_status tinyint(1) DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY nid_number (nid_number),
  UNIQUE KEY citizen_id (citizen_id),
  CONSTRAINT nid_cards_ibfk_1 FOREIGN KEY (citizen_id) REFERENCES citizens (id)
);

-- Table: nid_corrections
CREATE TABLE IF NOT EXISTS nid_corrections (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  nid_number varchar(50) DEFAULT NULL,
  request_type varchar(50) DEFAULT NULL,
  field_name varchar(50) DEFAULT NULL,
  corrected_value varchar(255) DEFAULT NULL,
  reason varchar(255) DEFAULT NULL,
  status varchar(20) DEFAULT 'Pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY fk_nid_corrections_user (user_id),
  CONSTRAINT fk_nid_corrections_user FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: notifications
CREATE TABLE IF NOT EXISTS notifications (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  type varchar(50) DEFAULT NULL,
  message text NOT NULL,
  is_read tinyint(1) DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT notifications_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: Ordered_item
CREATE TABLE IF NOT EXISTS Ordered_item (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  user_nid varchar(50) DEFAULT NULL,
  total_amount decimal(10,2) NOT NULL,
  payment_method enum('COD','ONLINE') NOT NULL,
  payment_status enum('PENDING','PAID','FAILED') DEFAULT 'PENDING',
  delivery_address text NOT NULL,
  contact_number varchar(20) NOT NULL,
  product_details json DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT ordered_item_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: order_items
CREATE TABLE IF NOT EXISTS order_items (
  id int(11) NOT NULL AUTO_INCREMENT,
  order_id int(11) NOT NULL,
  item_id int(11) NOT NULL,
  quantity int(11) NOT NULL,
  price_at_time decimal(10,2) NOT NULL,
  PRIMARY KEY (id),
  KEY order_id (order_id),
  KEY item_id (item_id),
  CONSTRAINT order_items_ibfk_1 FOREIGN KEY (order_id) REFERENCES Ordered_item (id) ON DELETE CASCADE,
  CONSTRAINT order_items_ibfk_2 FOREIGN KEY (item_id) REFERENCES shop_items (id) ON DELETE CASCADE
);

-- Table: passport_books
CREATE TABLE IF NOT EXISTS passport_books (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  application_id bigint(20) DEFAULT NULL,
  passport_number varchar(15) NOT NULL,
  issue_date date DEFAULT NULL,
  expiry_date date DEFAULT NULL,
  issuing_authority varchar(100) DEFAULT 'DIP, Dhaka',
  PRIMARY KEY (id),
  UNIQUE KEY passport_number (passport_number),
  KEY application_id (application_id),
  CONSTRAINT passport_books_ibfk_1 FOREIGN KEY (application_id) REFERENCES passport_applications (id)
);

-- Table: payments
CREATE TABLE IF NOT EXISTS payments (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  payment_method_id int(11) NOT NULL,
  service_type varchar(50) NOT NULL COMMENT 'land_tax, passport_fee, nid_fee, etc.',
  reference_table varchar(50) NOT NULL COMMENT 'Table name of related service',
  reference_id int(11) NOT NULL COMMENT 'ID in the reference table',
  amount decimal(15,2) NOT NULL,
  processing_fee decimal(10,2) DEFAULT 0.00,
  total_amount decimal(15,2) GENERATED ALWAYS AS (amount + processing_fee) STORED,
  transaction_id varchar(100) DEFAULT NULL,
  status_id int(11) NOT NULL DEFAULT 1,
  payment_date timestamp NOT NULL DEFAULT current_timestamp(),
  verified_at timestamp NULL DEFAULT NULL,
  notes text DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY transaction_id (transaction_id),
  KEY payment_method_id (payment_method_id),
  KEY status_id (status_id),
  KEY idx_user_payments (user_id),
  KEY idx_service_reference (service_type,reference_id),
  CONSTRAINT payments_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE,
  CONSTRAINT payments_ibfk_2 FOREIGN KEY (payment_method_id) REFERENCES payment_methods (id),
  CONSTRAINT payments_ibfk_3 FOREIGN KEY (status_id) REFERENCES document_statuses (id)
);

-- Table: payment_methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id int(11) NOT NULL AUTO_INCREMENT,
  method_name varchar(50) NOT NULL,
  is_active tinyint(1) DEFAULT 1,
  processing_fee_percent decimal(5,2) DEFAULT 0.00,
  PRIMARY KEY (id),
  UNIQUE KEY method_name (method_name)
);

-- Table: post_comments
CREATE TABLE IF NOT EXISTS post_comments (
  id int(11) NOT NULL AUTO_INCREMENT,
  post_id int(11) NOT NULL,
  user_id int(11) NOT NULL,
  content text NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY post_id (post_id),
  KEY user_id (user_id),
  CONSTRAINT post_comments_ibfk_1 FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
  CONSTRAINT post_comments_ibfk_2 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: post_likes
CREATE TABLE IF NOT EXISTS post_likes (
  id int(11) NOT NULL AUTO_INCREMENT,
  post_id int(11) NOT NULL,
  user_id int(11) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY unique_like (post_id,user_id),
  KEY user_id (user_id),
  CONSTRAINT post_likes_ibfk_1 FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
  CONSTRAINT post_likes_ibfk_2 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: reg_info
CREATE TABLE IF NOT EXISTS reg_info (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(100) DEFAULT NULL,
  address text DEFAULT NULL,
  nid varchar(20) DEFAULT NULL,
  mobile varchar(15) DEFAULT NULL,
  email varchar(100) DEFAULT NULL,
  password varchar(255) DEFAULT NULL,
  dob date DEFAULT NULL,
  gender varchar(10) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  reset_otp varchar(10) DEFAULT NULL,
  reset_otp_expires timestamp NULL DEFAULT NULL,
  photo_url varchar(255) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY nid (nid),
  UNIQUE KEY email (email),
  KEY idx_reg_info_nid (nid),
  KEY idx_reg_info_email (email)
);

-- Table: req_birth_cert_correction
CREATE TABLE IF NOT EXISTS req_birth_cert_correction (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_birth_cert_correction_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_business_company_reg
CREATE TABLE IF NOT EXISTS req_business_company_reg (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_business_company_reg_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_business_import_export
CREATE TABLE IF NOT EXISTS req_business_import_export (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_business_import_export_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_business_tin_certificate
CREATE TABLE IF NOT EXISTS req_business_tin_certificate (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_business_tin_certificate_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_business_trade_lic
CREATE TABLE IF NOT EXISTS req_business_trade_lic (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_business_trade_lic_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_business_vat_reg
CREATE TABLE IF NOT EXISTS req_business_vat_reg (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_business_vat_reg_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_character_certificate
CREATE TABLE IF NOT EXISTS req_character_certificate (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_character_certificate_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_death_cert_correction
CREATE TABLE IF NOT EXISTS req_death_cert_correction (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_death_cert_correction_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_education_hsc
CREATE TABLE IF NOT EXISTS req_education_hsc (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_education_hsc_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_education_jsc
CREATE TABLE IF NOT EXISTS req_education_jsc (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_education_jsc_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_education_sss
CREATE TABLE IF NOT EXISTS req_education_sss (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_education_sss_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_education_transcript
CREATE TABLE IF NOT EXISTS req_education_transcript (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_education_transcript_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_education_university_verification
CREATE TABLE IF NOT EXISTS req_education_university_verification (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_education_university_verification_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_immigration_emigration_clearance
CREATE TABLE IF NOT EXISTS req_immigration_emigration_clearance (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_immigration_emigration_clearance_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_immigration_passport_correction
CREATE TABLE IF NOT EXISTS req_immigration_passport_correction (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_immigration_passport_correction_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_immigration_visa
CREATE TABLE IF NOT EXISTS req_immigration_visa (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_immigration_visa_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_income_certificate
CREATE TABLE IF NOT EXISTS req_income_certificate (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_income_certificate_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_legal_case
CREATE TABLE IF NOT EXISTS req_legal_case (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_legal_case_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_legal_complain
CREATE TABLE IF NOT EXISTS req_legal_complain (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_legal_complain_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_legal_gd
CREATE TABLE IF NOT EXISTS req_legal_gd (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_legal_gd_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_nid_correction
CREATE TABLE IF NOT EXISTS req_nid_correction (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_nid_correction_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_transport_driving_lic_correction
CREATE TABLE IF NOT EXISTS req_transport_driving_lic_correction (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_transport_driving_lic_correction_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_transport_driving_lic_renew
CREATE TABLE IF NOT EXISTS req_transport_driving_lic_renew (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_transport_driving_lic_renew_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_transport_ownership_transfer
CREATE TABLE IF NOT EXISTS req_transport_ownership_transfer (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_transport_ownership_transfer_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: req_transport_vehicle_reg_correction
CREATE TABLE IF NOT EXISTS req_transport_vehicle_reg_correction (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  unique_number varchar(255) NOT NULL,
  description text DEFAULT NULL,
  evidence_link text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT req_transport_vehicle_reg_correction_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: service_requests
CREATE TABLE IF NOT EXISTS service_requests (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  service_type varchar(100) NOT NULL,
  details text DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  evidence_link text DEFAULT NULL,
  notification_read tinyint(1) DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_service_requests_user (user_id,status),
  CONSTRAINT service_requests_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: shop_items
CREATE TABLE IF NOT EXISTS shop_items (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(255) NOT NULL,
  description text DEFAULT NULL,
  price decimal(10,2) NOT NULL,
  image_url varchar(255) DEFAULT NULL,
  stock_quantity int(11) DEFAULT 100,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id)
);

-- Table: tax_returns
CREATE TABLE IF NOT EXISTS tax_returns (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  tax_year int(11) DEFAULT NULL,
  income_amount decimal(15,2) DEFAULT NULL,
  tax_paid decimal(15,2) DEFAULT NULL,
  submission_date timestamp NOT NULL DEFAULT current_timestamp(),
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY fk_tax_returns_user (user_id),
  CONSTRAINT fk_tax_returns_user FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: todos
CREATE TABLE IF NOT EXISTS todos (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  title varchar(255) NOT NULL,
  description text DEFAULT NULL,
  status enum('todo','progress','done') DEFAULT 'todo',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT todos_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: upazilas
CREATE TABLE IF NOT EXISTS upazilas (
  id int(11) NOT NULL AUTO_INCREMENT,
  district_id int(11) NOT NULL,
  name varchar(100) NOT NULL,
  PRIMARY KEY (id),
  KEY district_id (district_id),
  CONSTRAINT upazilas_ibfk_1 FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE CASCADE
);

-- Table: user_documents
CREATE TABLE IF NOT EXISTS user_documents (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  doc_type varchar(50) NOT NULL,
  doc_name varchar(100) NOT NULL,
  file_path varchar(255) NOT NULL,
  status enum('Pending','Approved','Rejected') DEFAULT 'Pending',
  admin_comment text DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  KEY user_id (user_id),
  CONSTRAINT user_documents_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: user_info
CREATE TABLE IF NOT EXISTS user_info (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  nid varchar(50) NOT NULL,
  mobile varchar(20) NOT NULL,
  dob date NOT NULL,
  address text DEFAULT NULL,
  gender varchar(20) DEFAULT NULL,
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  profile_image varchar(255) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY user_id (user_id),
  CONSTRAINT user_info_ibfk_1 FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- Table: water_issues
CREATE TABLE IF NOT EXISTS water_issues (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  description text DEFAULT NULL,
  status varchar(20) DEFAULT 'Reported',
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  KEY fk_water_user (user_id),
  CONSTRAINT fk_water_user FOREIGN KEY (user_id) REFERENCES reg_info (id) ON DELETE CASCADE
);

-- ==========================================
-- DATABASE VIEWS
-- Central Government System
-- ==========================================

-- ==========================================
-- VIEW 1: Citizen Profile
-- Joins multiple tables to show complete user information
-- ==========================================
CREATE OR REPLACE VIEW v_citizen_profile AS
SELECT 
    u.id AS user_id,
    u.name AS full_name,
    u.nid,
    u.email,
    u.mobile,
    u.gender,
    u.dob,
    TIMESTAMPDIFF(YEAR, u.dob, CURDATE()) AS age,
    u.address,
    u.photo_url,
    u.created_at AS registration_date,
    
    -- NID Document Info
    nid_doc.identity_number AS nid_number,
    nid_doc.status AS nid_status,
    nid_doc.file_path AS nid_file,
    
    -- Passport Document Info
    pass_doc.identity_number AS passport_number,
    pass_doc.status AS passport_status,
    
    -- Tax Document Info
    tax_doc.identity_number AS tin_number,
    tax_doc.status AS tax_status,
    
    -- Land Records Summary
    (SELECT COUNT(*) FROM my_land_record WHERE user_id = u.id) AS total_land_records,
    (SELECT COALESCE(SUM(land_size), 0) FROM my_land_record WHERE user_id = u.id) AS total_land_area_decimal,
    
    -- Service Requests Summary
    (SELECT COUNT(*) FROM service_requests WHERE user_id = u.id) AS total_requests,
    (SELECT COUNT(*) FROM service_requests WHERE user_id = u.id AND status = 'pending') AS pending_requests,
    (SELECT COUNT(*) FROM service_requests WHERE user_id = u.id AND status = 'approved') AS approved_requests,
    
    -- Activity Summary
    (SELECT COUNT(*) FROM login_logs WHERE user_id = u.id) AS total_logins,
    (SELECT MAX(login_time) FROM login_logs WHERE user_id = u.id) AS last_login

FROM reg_info u
LEFT JOIN govt_user_documents nid_doc ON u.id = nid_doc.user_id AND nid_doc.doc_category = 'NID'
LEFT JOIN govt_user_documents pass_doc ON u.id = pass_doc.user_id AND pass_doc.doc_category = 'Passport'
LEFT JOIN govt_user_documents tax_doc ON u.id = tax_doc.user_id AND tax_doc.doc_category = 'Tax';


-- ==========================================
-- VIEW 2: Land Ownership Report by Location
-- Aggregates land inventory data by geographic hierarchy
-- ==========================================
CREATE OR REPLACE VIEW v_land_by_location AS
SELECT 
    d.id AS division_id,
    d.name AS division,
    dist.id AS district_id,
    dist.name AS district,
    up.id AS upazila_id,
    up.name AS upazila,
    
    -- Parcel Statistics
    COUNT(l.id) AS total_parcels,
    SUM(CASE WHEN l.status = 'Approved' THEN 1 ELSE 0 END) AS approved_parcels,
    SUM(CASE WHEN l.status = 'Pending' THEN 1 ELSE 0 END) AS pending_parcels,
    SUM(CASE WHEN l.status = 'Rejected' THEN 1 ELSE 0 END) AS rejected_parcels,
    
    -- Value Statistics
    COALESCE(SUM(l.land_size), 0) AS total_land_area,
    COALESCE(SUM(l.land_price), 0) AS total_valuation,
    COALESCE(AVG(l.land_price), 0) AS avg_parcel_value,
    
    -- Time-based stats
    MIN(l.recorded_at) AS first_record_date,
    MAX(l.recorded_at) AS last_record_date

FROM divisions d
LEFT JOIN districts dist ON d.id = dist.division_id
LEFT JOIN upazilas up ON dist.id = up.district_id
LEFT JOIN my_land_record l ON up.id = l.upazila_id
GROUP BY d.id, d.name, dist.id, dist.name, up.id, up.name
HAVING total_parcels > 0
ORDER BY d.name, dist.name, up.name;


-- ==========================================
-- VIEW 3: Community Group Analytics
-- Community group analytics
-- ==========================================
CREATE OR REPLACE VIEW v_community_analytics AS
SELECT 
    g.id AS group_id,
    g.name AS group_name,
    g.description,
    g.status AS group_status,
    g.cover_image,
    g.created_at,
    
    -- Creator Info
    creator.id AS creator_id,
    creator.name AS created_by_name,
    creator.email AS creator_email,
    
    -- Membership Stats (Aggr)
    COALESCE(mem.member_count, 0) AS member_count,
    COALESCE(mem.admin_count, 0) AS admin_count,
    
    -- Post Statistics (Aggr)
    COALESCE(posts.total_posts, 0) AS total_posts,
    COALESCE(posts.approved_posts, 0) AS approved_posts,
    COALESCE(posts.pending_posts, 0) AS pending_posts,
    
    -- Engagement Metrics
    COALESCE(posts.total_likes, 0) AS total_likes,
    COALESCE(posts.total_comments, 0) AS total_comments,
    COALESCE(posts.avg_likes_per_post, 0) AS avg_likes_per_post,
    COALESCE(posts.avg_comments_per_post, 0) AS avg_comments_per_post,
    
    -- Activity Timeline
    DATEDIFF(CURDATE(), g.created_at) AS days_since_creation,
    posts.last_post_date,
    
    -- Group Classification
    CASE 
        WHEN COALESCE(mem.member_count, 0) > 100 THEN 'Very Large'
        WHEN COALESCE(mem.member_count, 0) > 50 THEN 'Large'
        WHEN COALESCE(mem.member_count, 0) > 20 THEN 'Medium'
        WHEN COALESCE(mem.member_count, 0) > 5 THEN 'Small'
        ELSE 'New'
    END AS group_size_category,
    
    -- Engagement Score
    (COALESCE(mem.member_count, 0) * 2 + COALESCE(posts.total_likes, 0) + COALESCE(posts.total_comments, 0) * 2) AS engagement_score

FROM community_groups g
LEFT JOIN reg_info creator ON g.created_by = creator.id
-- Aggregate Members
LEFT JOIN (
    SELECT 
        group_id, 
        COUNT(DISTINCT user_id) AS member_count,
        COUNT(DISTINCT CASE WHEN role = 'admin' THEN user_id END) AS admin_count
    FROM community_members
    GROUP BY group_id
) mem ON g.id = mem.group_id
-- Aggregate Posts
LEFT JOIN (
    SELECT 
        group_id,
        COUNT(id) AS total_posts,
        COUNT(CASE WHEN status = 'approved' THEN id END) AS approved_posts,
        COUNT(CASE WHEN status = 'pending' THEN id END) AS pending_posts,
        SUM(like_count) AS total_likes,
        SUM(comment_count) AS total_comments,
        AVG(like_count) AS avg_likes_per_post,
        AVG(comment_count) AS avg_comments_per_post,
        MAX(created_at) AS last_post_date
    FROM community_posts
    GROUP BY group_id
) posts ON g.id = posts.group_id;


-- ==========================================
-- VIEW 4: Service Request Dashboard
-- Daily aggregated service request statistics
-- ==========================================
CREATE OR REPLACE VIEW v_service_dashboard AS
SELECT 
    DATE(created_at) AS request_date,
    YEAR(created_at) AS year,
    MONTH(created_at) AS month,
    DAYNAME(created_at) AS day_name,
    service_type,
    
    -- Counts
    COUNT(*) AS total_requests,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
    
    -- Percentages
    ROUND(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS approval_rate,
    ROUND(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS rejection_rate,
    
    -- Unique Users
    COUNT(DISTINCT user_id) AS unique_users

FROM service_requests
GROUP BY DATE(created_at), YEAR(created_at), MONTH(created_at), DAYNAME(created_at), service_type
ORDER BY request_date DESC, service_type;


-- ==========================================
-- VIEW 5: User Activity Summary
-- User engagement metrics
-- ==========================================
CREATE OR REPLACE VIEW v_user_activity AS
SELECT 
    u.id AS user_id,
    u.name,
    u.email,
    u.created_at AS registration_date,
    DATEDIFF(CURDATE(), u.created_at) AS days_since_registration,
    
    -- Login Activity
    COALESCE(login_stats.total_logins, 0) AS total_logins,
    login_stats.last_login,
    login_stats.first_login,
    
    -- Service Requests
    COALESCE(service_stats.total_requests, 0) AS total_service_requests,
    COALESCE(service_stats.pending_requests, 0) AS pending_requests,
    COALESCE(service_stats.approved_requests, 0) AS approved_requests,
    
    -- Task/Todo Activity
    COALESCE(todo_stats.total_todos, 0) AS total_todos,
    COALESCE(todo_stats.completed_todos, 0) AS completed_todos,
    
    -- Community Activity
    COALESCE(community_stats.groups_joined, 0) AS groups_joined,
    COALESCE(community_stats.posts_created, 0) AS posts_created,
    COALESCE(community_stats.comments_made, 0) AS comments_made,
    COALESCE(community_stats.likes_given, 0) AS likes_given,
    
    -- Document Count
    COALESCE(doc_stats.document_count, 0) AS documents_uploaded,
    
    -- Overall Activity Score
    (
        COALESCE(login_stats.total_logins, 0) * 1 +
        COALESCE(service_stats.total_requests, 0) * 3 +
        COALESCE(community_stats.posts_created, 0) * 5 +
        COALESCE(community_stats.comments_made, 0) * 2 +
        COALESCE(community_stats.groups_joined, 0) * 3
    ) AS activity_score,
    
    -- User Classification
    CASE 
        WHEN (
            COALESCE(login_stats.total_logins, 0) * 1 +
            COALESCE(community_stats.posts_created, 0) * 5 +
            COALESCE(community_stats.comments_made, 0) * 2
        ) >= 100 THEN 'Power User'
        WHEN (
            COALESCE(login_stats.total_logins, 0) * 1 +
            COALESCE(community_stats.posts_created, 0) * 5
        ) >= 50 THEN 'Active'
        WHEN COALESCE(login_stats.total_logins, 0) >= 10 THEN 'Regular'
        ELSE 'New'
    END AS user_tier

FROM reg_info u

LEFT JOIN (
    SELECT user_id, 
           COUNT(*) AS total_logins,
           MAX(login_time) AS last_login,
           MIN(login_time) AS first_login
    FROM login_logs GROUP BY user_id
) login_stats ON u.id = login_stats.user_id

LEFT JOIN (
    SELECT user_id,
           COUNT(*) AS total_requests,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_requests,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_requests
    FROM service_requests GROUP BY user_id
) service_stats ON u.id = service_stats.user_id

LEFT JOIN (
    SELECT user_id,
           COUNT(*) AS total_todos,
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed_todos
    FROM todos GROUP BY user_id
) todo_stats ON u.id = todo_stats.user_id

LEFT JOIN (
    SELECT 
        cm.user_id,
        COUNT(DISTINCT cm.group_id) AS groups_joined,
        COUNT(DISTINCT cp.id) AS posts_created,
        COUNT(DISTINCT pc.id) AS comments_made,
        COUNT(DISTINCT pl.id) AS likes_given
    FROM community_members cm
    LEFT JOIN community_posts cp ON cm.user_id = cp.user_id
    LEFT JOIN post_comments pc ON cm.user_id = pc.user_id
    LEFT JOIN post_likes pl ON cm.user_id = pl.user_id
    GROUP BY cm.user_id
) community_stats ON u.id = community_stats.user_id

LEFT JOIN (
    SELECT user_id, COUNT(*) AS document_count
    FROM user_documents GROUP BY user_id
) doc_stats ON u.id = doc_stats.user_id;


-- ==========================================
-- VIEW 6: User Land Summary
-- Shows aggregated land holdings for each user (one row per user)
-- ==========================================
CREATE OR REPLACE VIEW v_user_land_details AS
SELECT 
    -- User Information
    u.id AS user_id,
    u.name AS owner_name,
    u.nid AS owner_nid,
    u.email AS owner_email,
    u.mobile AS owner_mobile,
    
    -- Aggregated Land Statistics
    COUNT(l.id) AS total_land_parcels,
    COALESCE(SUM(l.land_size), 0) AS total_land_area,
    COALESCE(SUM(l.land_price), 0) AS total_land_value,
    
    -- Land Status Breakdown
    SUM(CASE WHEN l.status = 'Approved' THEN 1 ELSE 0 END) AS approved_parcels,
    SUM(CASE WHEN l.status = 'Pending' THEN 1 ELSE 0 END) AS pending_parcels,
    
    -- Location Summary (comma-separated list of unique divisions)
    GROUP_CONCAT(DISTINCT COALESCE(d.name, l.division) SEPARATOR ', ') AS divisions_owned,
    GROUP_CONCAT(DISTINCT COALESCE(dist.name, l.district) SEPARATOR ', ') AS districts_owned,
    
    -- Khatian/Dag Summary
    GROUP_CONCAT(DISTINCT l.khatian_no SEPARATOR ', ') AS khatian_numbers,
    GROUP_CONCAT(DISTINCT l.dag_no SEPARATOR ', ') AS dag_numbers,
    
    -- Timeline
    MIN(l.recorded_at) AS first_record_date,
    MAX(l.recorded_at) AS last_record_date
    
FROM reg_info u
LEFT JOIN my_land_record l ON u.id = l.user_id
LEFT JOIN divisions d ON l.division_id = d.id
LEFT JOIN districts dist ON l.district_id = dist.id
LEFT JOIN upazilas up ON l.upazila_id = up.id
GROUP BY u.id, u.name, u.nid, u.email, u.mobile
HAVING COUNT(l.id) > 0
ORDER BY total_land_area DESC;

SET FOREIGN_KEY_CHECKS = 1;
