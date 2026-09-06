

-- =====================================================
-- 1. USER REGISTRATION & ACCOUNT MANAGEMENT
-- =====================================================


-- 1. USER REGISTRATION & ACCOUNT MANAGEMENT

DROP PROCEDURE IF EXISTS sp_generate_nid_number //
CREATE PROCEDURE sp_generate_nid_number(
    IN p_dob DATE,
    IN p_district_id INT,
    OUT p_nid_number VARCHAR(20)
)
BEGIN
    DECLARE v_year VARCHAR(4);
    DECLARE v_district VARCHAR(3);
    DECLARE v_seq INT;

    SET v_year = YEAR(p_dob);
    SET v_district = LPAD(p_district_id, 3, '0');

    SELECT IFNULL(MAX(CAST(SUBSTRING(nid_number, 8) AS UNSIGNED)), 0) + 1
    INTO v_seq
    FROM nid_profiles
    WHERE nid_number LIKE CONCAT(v_year, v_district, '%');

    SET p_nid_number = CONCAT(v_year, v_district, LPAD(v_seq, 10, '0'));
END //

-- Deactivate inactive user accounts (no login in 365 days)
DROP PROCEDURE IF EXISTS sp_flag_inactive_users //
CREATE PROCEDURE sp_flag_inactive_users()
BEGIN
    SELECT r.id, r.name, r.nid, r.email, r.mobile,
           MAX(l.login_time) AS last_login,
           DATEDIFF(NOW(), MAX(l.login_time)) AS days_inactive
    FROM reg_info r
    LEFT JOIN login_logs l ON r.id = l.user_id
    GROUP BY r.id
    HAVING last_login IS NULL OR days_inactive > 365
    ORDER BY days_inactive DESC;
END //

-- =====================================================
-- 2. NID SERVICES
-- =====================================================

-- Process NID application: validate and assign NID number
DROP PROCEDURE IF EXISTS sp_process_nid_application //
CREATE PROCEDURE sp_process_nid_application(
    IN p_application_id INT,
    IN p_admin_id INT,
    IN p_action ENUM('approve', 'reject'),
    IN p_remarks TEXT
)
BEGIN
    DECLARE v_user_id INT;
    DECLARE v_nid VARCHAR(20);
    DECLARE v_dob DATE;
    DECLARE v_district INT;

    IF p_action = 'approve' THEN
        SELECT user_id, date_of_birth, present_district_id
        INTO v_user_id, v_dob, v_district
        FROM nid_applications WHERE id = p_application_id;

        CALL sp_generate_nid_number(v_dob, IFNULL(v_district, 1), v_nid);

        UPDATE nid_applications
        SET status = 'Approved', assigned_nid = v_nid, verified_by = p_admin_id,
            verified_at = NOW(), admin_remarks = p_remarks
        WHERE id = p_application_id;

        INSERT INTO nid_activity_log (nid_number, user_id, activity_type, details, ip_address)
        VALUES (v_nid, v_user_id, 'Application Approved',
                CONCAT('Application #', p_application_id, ' approved by admin #', p_admin_id), '127.0.0.1');
    ELSE
        UPDATE nid_applications
        SET status = 'Rejected', admin_remarks = p_remarks, verified_by = p_admin_id, verified_at = NOW()
        WHERE id = p_application_id;
    END IF;
END //

-- Get full citizen profile from NID number
DROP PROCEDURE IF EXISTS sp_get_citizen_profile //
CREATE PROCEDURE sp_get_citizen_profile(
    IN p_nid VARCHAR(20)
)
BEGIN
    SELECT
        r.id, r.name, r.nid, r.email, r.mobile, r.dob, r.gender, r.photo_url,
        np.name_bn, np.name_en, np.father_name_bn, np.mother_name_bn,
        np.blood_group, np.card_type, np.profile_status,
        d1.name AS present_division, dt1.name AS present_district, u1.name AS present_upazila,
        d2.name AS permanent_division, dt2.name AS permanent_district, u2.name AS permanent_upazila
    FROM reg_info r
    LEFT JOIN nid_profiles np ON r.id = np.user_id
    LEFT JOIN divisions d1 ON np.present_division_id = d1.id
    LEFT JOIN districts dt1 ON np.present_district_id = dt1.id
    LEFT JOIN upazilas u1 ON np.present_upazila_id = u1.id
    LEFT JOIN divisions d2 ON np.permanent_division_id = d2.id
    LEFT JOIN districts dt2 ON np.permanent_district_id = dt2.id
    LEFT JOIN upazilas u2 ON np.permanent_upazila_id = u2.id
    WHERE r.nid = p_nid;
END //

-- =====================================================
-- 3. LAND TAX CALCULATION
-- =====================================================

-- Calculate land tax based on land type and size
DROP PROCEDURE IF EXISTS sp_calculate_land_tax //
CREATE PROCEDURE sp_calculate_land_tax(
    IN p_land_type VARCHAR(50),
    IN p_land_size_decimal DECIMAL(10,2),
    OUT p_tax_amount DECIMAL(15,2)
)
BEGIN
    DECLARE v_rate DECIMAL(10,2);

    SET v_rate = CASE p_land_type
        WHEN 'Agricultural' THEN 2.50
        WHEN 'Residential' THEN 15.00
        WHEN 'Commercial' THEN 50.00
        WHEN 'Industrial' THEN 75.00
        WHEN 'Pond/Water Body' THEN 5.00
        ELSE 10.00
    END;

    SET p_tax_amount = p_land_size_decimal * v_rate;

    -- Minimum tax 50 BDT
    IF p_tax_amount < 50 THEN
        SET p_tax_amount = 50;
    END IF;
END //

-- Process land mutation request
DROP PROCEDURE IF EXISTS sp_process_land_mutation //
CREATE PROCEDURE sp_process_land_mutation(
    IN p_mutation_id INT,
    IN p_action ENUM('Approved', 'Rejected'),
    IN p_admin_id INT
)
BEGIN
    DECLARE v_user_id INT;
    DECLARE v_tracking VARCHAR(50);

    SELECT user_id, tracking_number INTO v_user_id, v_tracking
    FROM land_mutations_v2 WHERE id = p_mutation_id;

    UPDATE land_mutations_v2 SET status = p_action WHERE id = p_mutation_id;

    INSERT INTO notifications (user_id, message, type)
    VALUES (v_user_id,
        CONCAT('Land Mutation ', p_action, ': Your mutation request (', v_tracking, ') has been ', LOWER(p_action), '.'),
        IF(p_action = 'Approved', 'success', 'error')
    );

    INSERT INTO admin_actions_log (admin_id, action_type, target_table, target_id, new_status, notes)
    VALUES (p_admin_id, 'status_update', 'land_mutations_v2', p_mutation_id, p_action,
            CONCAT('Mutation ', v_tracking, ' ', LOWER(p_action)));
END //

-- =====================================================
-- 4. HEALTH SERVICES
-- =====================================================

-- Book a medical appointment with conflict check
DROP PROCEDURE IF EXISTS sp_book_appointment //
CREATE PROCEDURE sp_book_appointment(
    IN p_user_id INT,
    IN p_hospital_id INT,
    IN p_department VARCHAR(100),
    IN p_doctor_name VARCHAR(200),
    IN p_appointment_date DATE,
    IN p_time_slot VARCHAR(20),
    OUT p_result VARCHAR(255)
)
BEGIN
    DECLARE v_existing INT DEFAULT 0;

    -- Check for double-booking
    SELECT COUNT(*) INTO v_existing
    FROM health_appointments
    WHERE user_id = p_user_id
      AND appointment_date = p_appointment_date
      AND status NOT IN ('Cancelled', 'Completed');

    IF v_existing > 0 THEN
        SET p_result = 'ERROR: You already have an appointment on this date.';
    ELSE
        INSERT INTO health_appointments
            (user_id, hospital_id, department, doctor_name, appointment_date, status)
        VALUES (p_user_id, p_hospital_id, p_department, p_doctor_name, p_appointment_date, 'Scheduled');

        INSERT INTO notifications (user_id, message, type)
        VALUES (p_user_id,
            CONCAT('Appointment Confirmed: ', p_department, ' on ', p_appointment_date),
            'success');

        SET p_result = CONCAT('SUCCESS: Appointment booked for ', p_appointment_date);
    END IF;
END //

-- Get a user's vaccination summary
DROP PROCEDURE IF EXISTS sp_vaccination_summary //
CREATE PROCEDURE sp_vaccination_summary(
    IN p_user_id INT
)
BEGIN
    SELECT
        hv.vaccine_name,
        hv.vaccine_type,
        hv.dose_number,
        hv.vaccination_date,
        hv.vaccination_center,
        hv.certificate_number,
        hc.card_number AS health_card
    FROM health_vaccinations hv
    LEFT JOIN health_cards hc ON hv.health_card_id = hc.id
    WHERE hv.user_id = p_user_id
    ORDER BY hv.vaccination_date DESC;
END //

-- =====================================================
-- 5. TAX / NBR SERVICES
-- =====================================================

-- Calculate income tax based on Bangladesh tax slabs (2025-2026)
DROP PROCEDURE IF EXISTS sp_calculate_income_tax //
CREATE PROCEDURE sp_calculate_income_tax(
    IN p_annual_income DECIMAL(15,2),
    IN p_gender ENUM('Male', 'Female', 'Other'),
    OUT p_tax_amount DECIMAL(15,2),
    OUT p_tax_bracket VARCHAR(50)
)
BEGIN
    DECLARE v_taxable DECIMAL(15,2);
    DECLARE v_exemption DECIMAL(15,2);

    -- Tax-free threshold (Bangladesh FY 2025-26)
    SET v_exemption = CASE
        WHEN p_gender = 'Female' THEN 400000
        WHEN p_gender = 'Other' THEN 475000
        ELSE 350000
    END;

    SET v_taxable = GREATEST(p_annual_income - v_exemption, 0);

    -- Progressive tax slabs
    SET p_tax_amount = 0;
    IF v_taxable > 0 THEN
        -- First 1,00,000: 5%
        SET p_tax_amount = p_tax_amount + LEAST(v_taxable, 100000) * 0.05;
        SET v_taxable = GREATEST(v_taxable - 100000, 0);
    END IF;
    IF v_taxable > 0 THEN
        -- Next 4,00,000: 10%
        SET p_tax_amount = p_tax_amount + LEAST(v_taxable, 400000) * 0.10;
        SET v_taxable = GREATEST(v_taxable - 400000, 0);
    END IF;
    IF v_taxable > 0 THEN
        -- Next 5,00,000: 15%
        SET p_tax_amount = p_tax_amount + LEAST(v_taxable, 500000) * 0.15;
        SET v_taxable = GREATEST(v_taxable - 500000, 0);
    END IF;
    IF v_taxable > 0 THEN
        -- Next 5,00,000: 20%
        SET p_tax_amount = p_tax_amount + LEAST(v_taxable, 500000) * 0.20;
        SET v_taxable = GREATEST(v_taxable - 500000, 0);
    END IF;
    IF v_taxable > 0 THEN
        -- Remaining: 25%
        SET p_tax_amount = p_tax_amount + v_taxable * 0.25;
    END IF;

    -- Minimum tax 5000 BDT if any income above exemption
    IF p_tax_amount > 0 AND p_tax_amount < 5000 THEN
        SET p_tax_amount = 5000;
    END IF;

    SET p_tax_bracket = CASE
        WHEN p_annual_income <= v_exemption THEN 'Tax Free'
        WHEN p_annual_income <= v_exemption + 100000 THEN '5% Slab'
        WHEN p_annual_income <= v_exemption + 500000 THEN '10% Slab'
        WHEN p_annual_income <= v_exemption + 1000000 THEN '15% Slab'
        WHEN p_annual_income <= v_exemption + 1500000 THEN '20% Slab'
        ELSE '25% Slab'
    END;
END //

-- =====================================================
-- 6. ADMIN ANALYTICS & DASHBOARD
-- =====================================================

-- Get complete system statistics for admin dashboard
DROP PROCEDURE IF EXISTS sp_admin_dashboard_stats //
CREATE PROCEDURE sp_admin_dashboard_stats()
BEGIN
    -- Result Set 1: User & Registration Stats
    SELECT
        (SELECT COUNT(*) FROM reg_info) AS total_users,
        (SELECT COUNT(*) FROM reg_info WHERE created_at >= CURDATE() - INTERVAL 30 DAY) AS new_users_30d,
        (SELECT COUNT(*) FROM reg_info WHERE created_at >= CURDATE() - INTERVAL 7 DAY) AS new_users_7d,
        (SELECT COUNT(*) FROM admins WHERE status = 'approved') AS total_admins,
        (SELECT COUNT(*) FROM login_logs WHERE login_time >= CURDATE()) AS logins_today;

    -- Result Set 2: Service Request Summary
    SELECT
        (SELECT COUNT(*) FROM service_requests WHERE status = 'pending') AS pending_requests,
        (SELECT COUNT(*) FROM service_requests WHERE status = 'approved') AS approved_requests,
        (SELECT COUNT(*) FROM service_requests WHERE status = 'rejected') AS rejected_requests,
        (SELECT COUNT(*) FROM passport_applications WHERE status IN ('Submitted', 'Documents_Verified')) AS pending_passports,
        (SELECT COUNT(*) FROM nid_applications WHERE status IN ('Submitted', 'Under_Review')) AS pending_nid;

    -- Result Set 3: Financial Overview
    SELECT
        (SELECT IFNULL(SUM(tax_amount), 0) FROM landtax WHERE payment_status = 'Paid') AS land_tax_collected,
        (SELECT IFNULL(SUM(amount), 0) FROM nbr_tax_payments WHERE status = 'Completed') AS income_tax_collected,
        (SELECT IFNULL(SUM(total_amount), 0) FROM Ordered_item WHERE payment_status = 'PAID') AS shop_revenue,
        (SELECT IFNULL(SUM(amount), 0) FROM water_bill_payments WHERE status = 'Paid') AS water_revenue;
END //

-- Get monthly registration trend for charts
DROP PROCEDURE IF EXISTS sp_monthly_registration_trend //
CREATE PROCEDURE sp_monthly_registration_trend(
    IN p_months INT
)
BEGIN
    SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(*) AS registrations
    FROM reg_info
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL p_months MONTH)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
    ORDER BY month;
END //

-- Get service-wise pending request counts for admin
DROP PROCEDURE IF EXISTS sp_pending_requests_by_service //
CREATE PROCEDURE sp_pending_requests_by_service()
BEGIN
    SELECT 'NID Correction' AS service, COUNT(*) AS pending FROM req_nid_correction WHERE status = 'pending'
    UNION ALL
    SELECT 'Birth Cert Correction', COUNT(*) FROM req_birth_cert_correction WHERE status = 'pending'
    UNION ALL
    SELECT 'Death Cert Correction', COUNT(*) FROM req_death_cert_correction WHERE status = 'pending'
    UNION ALL
    SELECT 'Character Certificate', COUNT(*) FROM req_character_certificate WHERE status = 'pending'
    UNION ALL
    SELECT 'Income Certificate', COUNT(*) FROM req_income_certificate WHERE status = 'pending'
    UNION ALL
    SELECT 'Trade License', COUNT(*) FROM req_business_trade_lic WHERE status = 'pending'
    UNION ALL
    SELECT 'TIN Certificate', COUNT(*) FROM req_business_tin_certificate WHERE status = 'pending'
    UNION ALL
    SELECT 'Company Registration', COUNT(*) FROM req_business_company_reg WHERE status = 'pending'
    UNION ALL
    SELECT 'Import/Export License', COUNT(*) FROM req_business_import_export WHERE status = 'pending'
    UNION ALL
    SELECT 'VAT Registration', COUNT(*) FROM req_business_vat_reg WHERE status = 'pending'
    UNION ALL
    SELECT 'Visa Application', COUNT(*) FROM req_immigration_visa WHERE status = 'pending'
    UNION ALL
    SELECT 'Passport Correction', COUNT(*) FROM req_immigration_passport_correction WHERE status = 'pending'
    UNION ALL
    SELECT 'Emigration Clearance', COUNT(*) FROM req_immigration_emigration_clearance WHERE status = 'pending'
    UNION ALL
    SELECT 'Driving License Correction', COUNT(*) FROM req_transport_driving_lic_correction WHERE status = 'pending'
    UNION ALL
    SELECT 'Driving License Renew', COUNT(*) FROM req_transport_driving_lic_renew WHERE status = 'pending'
    UNION ALL
    SELECT 'Vehicle Ownership Transfer', COUNT(*) FROM req_transport_ownership_transfer WHERE status = 'pending'
    UNION ALL
    SELECT 'Legal Case', COUNT(*) FROM req_legal_case WHERE status = 'pending'
    UNION ALL
    SELECT 'Legal Complaint', COUNT(*) FROM req_legal_complain WHERE status = 'pending'
    UNION ALL
    SELECT 'General Diary (GD)', COUNT(*) FROM req_legal_gd WHERE status = 'pending'
    ORDER BY pending DESC;
END //

-- =====================================================
-- 7. EDUCATION SERVICES
-- =====================================================

-- Check student eligibility for university admission
DROP PROCEDURE IF EXISTS sp_check_admission_eligibility //
CREATE PROCEDURE sp_check_admission_eligibility(
    IN p_hsc_roll VARCHAR(20),
    IN p_hsc_year YEAR,
    IN p_admission_post_id INT,
    OUT p_eligible BOOLEAN,
    OUT p_reason VARCHAR(255)
)
BEGIN
    DECLARE v_gpa DECIMAL(3,2);
    DECLARE v_group VARCHAR(20);
    DECLARE v_min_gpa DECIMAL(3,2);
    DECLARE v_required_group VARCHAR(20);

    SELECT gpa, exam_group INTO v_gpa, v_group
    FROM hsc_results
    WHERE roll_number = p_hsc_roll AND exam_year = p_hsc_year
    LIMIT 1;

    IF v_gpa IS NULL THEN
        SET p_eligible = FALSE;
        SET p_reason = 'HSC result not found for the given roll and year.';
    ELSE
        SELECT min_gpa, required_group INTO v_min_gpa, v_required_group
        FROM admission_posts WHERE id = p_admission_post_id;

        IF v_gpa < v_min_gpa THEN
            SET p_eligible = FALSE;
            SET p_reason = CONCAT('GPA ', v_gpa, ' is below the minimum requirement of ', v_min_gpa);
        ELSEIF v_required_group != 'Any' AND v_group != v_required_group THEN
            SET p_eligible = FALSE;
            SET p_reason = CONCAT('Group mismatch: requires ', v_required_group, ', you have ', v_group);
        ELSE
            SET p_eligible = TRUE;
            SET p_reason = 'Eligible for admission.';
        END IF;
    END IF;
END //

-- =====================================================
-- 8. WATER SERVICES
-- =====================================================

-- Generate monthly water bill for a connection
DROP PROCEDURE IF EXISTS sp_generate_water_bill //
CREATE PROCEDURE sp_generate_water_bill(
    IN p_connection_id INT,
    IN p_billing_month VARCHAR(7),
    IN p_current_reading DECIMAL(10,2),
    OUT p_bill_amount DECIMAL(10,2)
)
BEGIN
    DECLARE v_prev_reading DECIMAL(10,2) DEFAULT 0;
    DECLARE v_units DECIMAL(10,2);
    DECLARE v_rate DECIMAL(10,2);
    DECLARE v_user_id INT;
    DECLARE v_conn_type VARCHAR(50);

    SELECT user_id, connection_type INTO v_user_id, v_conn_type
    FROM water_connections WHERE id = p_connection_id;

    SELECT IFNULL(MAX(meter_reading_current), 0) INTO v_prev_reading
    FROM water_bill_payments WHERE connection_id = p_connection_id;

    SET v_units = p_current_reading - v_prev_reading;

    -- Rate per unit based on connection type
    SET v_rate = CASE v_conn_type
        WHEN 'Residential' THEN 8.50
        WHEN 'Commercial' THEN 25.00
        WHEN 'Industrial' THEN 40.00
        WHEN 'Government' THEN 12.00
        ELSE 15.00
    END;

    SET p_bill_amount = v_units * v_rate;
    IF p_bill_amount < 100 THEN SET p_bill_amount = 100; END IF;

    INSERT INTO water_bill_payments
        (user_id, connection_id, billing_month, meter_reading_prev, meter_reading_current,
         units_consumed, amount, status)
    VALUES (v_user_id, p_connection_id, p_billing_month, v_prev_reading, p_current_reading,
            v_units, p_bill_amount, 'Unpaid');

    INSERT INTO notifications (user_id, message, type)
    VALUES (v_user_id,
        CONCAT('Water Bill Generated: BDT ', FORMAT(p_bill_amount, 2), ' for ', p_billing_month),
        'info');
END //

-- =====================================================
-- 9. GENERIC SERVICE REQUEST PROCESSOR
-- =====================================================

-- Approve or reject any service request with audit logging
DROP PROCEDURE IF EXISTS sp_process_service_request //
CREATE PROCEDURE sp_process_service_request(
    IN p_table_name VARCHAR(100),
    IN p_request_id INT,
    IN p_action ENUM('approved', 'rejected'),
    IN p_admin_id INT,
    IN p_remarks TEXT
)
BEGIN
    SET @sql = CONCAT('UPDATE `', p_table_name, '` SET status = ''', p_action, ''' WHERE id = ', p_request_id);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    -- Log admin action
    INSERT INTO admin_actions_log (admin_id, action_type, target_table, target_id, new_status, notes)
    VALUES (p_admin_id, 'status_update', p_table_name, p_request_id, p_action, p_remarks);

    -- Log to audit trail
    INSERT INTO audit_log (table_name, record_id, action, new_values, user_id)
    VALUES (p_table_name, p_request_id, 'UPDATE',
            CONCAT('{"status":"', p_action, '","remarks":"', IFNULL(p_remarks, ''), '"}'),
            p_admin_id);
END //

-- =====================================================
-- 10. STIPEND ELIGIBILITY CHECK
-- =====================================================

DROP PROCEDURE IF EXISTS sp_check_stipend_eligibility //
CREATE PROCEDURE sp_check_stipend_eligibility(
    IN p_user_id INT,
    IN p_stipend_id INT,
    IN p_gpa DECIMAL(3,2),
    IN p_monthly_income DECIMAL(15,2),
    OUT p_eligible BOOLEAN,
    OUT p_reason VARCHAR(255)
)
BEGIN
    DECLARE v_min_gpa FLOAT;
    DECLARE v_max_income DECIMAL(15,2);
    DECLARE v_is_active BOOLEAN;
    DECLARE v_deadline DATE;
    DECLARE v_already_applied INT DEFAULT 0;

    SELECT min_gpa, max_income, is_active, deadline
    INTO v_min_gpa, v_max_income, v_is_active, v_deadline
    FROM available_stipends WHERE id = p_stipend_id;

    SELECT COUNT(*) INTO v_already_applied
    FROM stipends_applications WHERE user_id = p_user_id AND stipend_id = p_stipend_id;

    IF v_is_active = FALSE THEN
        SET p_eligible = FALSE;
        SET p_reason = 'This stipend program is currently inactive.';
    ELSEIF v_deadline < CURDATE() THEN
        SET p_eligible = FALSE;
        SET p_reason = CONCAT('Deadline passed: ', v_deadline);
    ELSEIF v_already_applied > 0 THEN
        SET p_eligible = FALSE;
        SET p_reason = 'You have already applied for this stipend.';
    ELSEIF v_min_gpa IS NOT NULL AND p_gpa < v_min_gpa THEN
        SET p_eligible = FALSE;
        SET p_reason = CONCAT('Minimum GPA required: ', v_min_gpa, '. Your GPA: ', p_gpa);
    ELSEIF v_max_income IS NOT NULL AND p_monthly_income > v_max_income THEN
        SET p_eligible = FALSE;
        SET p_reason = 'Income exceeds the maximum eligibility limit.';
    ELSE
        SET p_eligible = TRUE;
        SET p_reason = 'You are eligible to apply for this stipend!';
    END IF;
END //

-- =====================================================
-- 11. AUTO-EXPIRE OLD RECORDS
-- =====================================================

-- Clean up expired notices, overdue appointments, etc.
DROP PROCEDURE IF EXISTS sp_cleanup_expired_records //
CREATE PROCEDURE sp_cleanup_expired_records()
BEGIN
    DECLARE v_notices INT DEFAULT 0;
    DECLARE v_appointments INT DEFAULT 0;

    -- Expire old government notices
    UPDATE govt_notices
    SET status = 'Expired'
    WHERE expiry_date < CURDATE() AND status = 'Published';
    SET v_notices = ROW_COUNT();

    -- Mark overdue appointments as 'Missed'
    UPDATE health_appointments
    SET status = 'Missed'
    WHERE appointment_date < CURDATE() AND status = 'Scheduled';
    SET v_appointments = ROW_COUNT();

    SELECT
        v_notices AS expired_notices,
        v_appointments AS missed_appointments,
        NOW() AS cleanup_timestamp;
END //

DELIMITER ;
