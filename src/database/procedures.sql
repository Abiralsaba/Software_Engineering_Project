-- ==========================================
-- STORED PROCEDURES
-- Central Government System
-- ==========================================

DELIMITER //

-- ==========================================
-- PROCEDURE 1: Get Complete User Report
-- Get user data
-- ==========================================
CREATE PROCEDURE IF NOT EXISTS sp_get_user_report(IN p_user_id INT)
BEGIN
    -- Declare variables
    DECLARE v_user_exists INT DEFAULT 0;
    
    -- Check if user exists
    SELECT COUNT(*) INTO v_user_exists FROM reg_info WHERE id = p_user_id;
    
    IF v_user_exists = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found';
    END IF;
    
    -- Result Set 1: User Basic Info
    SELECT 
        'USER_INFO' AS section,
        id, name, email, nid, mobile, gender, dob, address, photo_url, created_at
    FROM reg_info 
    WHERE id = p_user_id;
    
    -- Result Set 2: Documents Summary
    SELECT 
        'DOCUMENTS' AS section,
        doc_category,
        identity_number,
        status,
        file_path,
        created_at
    FROM govt_user_documents 
    WHERE user_id = p_user_id
    ORDER BY created_at DESC;
    
    -- Result Set 3: Land Records with Location Details
    SELECT 
        'LAND_RECORDS' AS section,
        l.id,
        l.khatian_no,
        l.dag_no,
        l.mouza,
        l.land_size,
        l.land_price,
        l.ownership_description,
        COALESCE(l.division, d.name) AS division,
        COALESCE(l.district, dist.name) AS district,
        COALESCE(l.upazila, u.name) AS upazila,
        l.recorded_at
    FROM my_land_record l
    LEFT JOIN divisions d ON l.division_id = d.id
    LEFT JOIN districts dist ON l.district_id = dist.id
    LEFT JOIN upazilas u ON l.upazila_id = u.id
    WHERE l.user_id = p_user_id
    ORDER BY l.recorded_at DESC;
    
    -- Result Set 4: Service Requests History
    SELECT 
        'SERVICES' AS section,
        id,
        service_type,
        details,
        status,
        created_at
    FROM service_requests 
    WHERE user_id = p_user_id 
    ORDER BY created_at DESC 
    LIMIT 50;
    
    -- Result Set 5: Login History
    SELECT 
        'LOGIN_HISTORY' AS section,
        login_time,
        ip_address,
        LEFT(user_agent, 100) AS user_agent_short
    FROM login_logs
    WHERE user_id = p_user_id
    ORDER BY login_time DESC
    LIMIT 20;
    
    -- Result Set 6: Community Activity
    SELECT 
        'COMMUNITY' AS section,
        (SELECT COUNT(*) FROM community_members WHERE user_id = p_user_id) AS groups_joined,
        (SELECT COUNT(*) FROM community_posts WHERE user_id = p_user_id) AS posts_created,
        (SELECT COUNT(*) FROM post_comments WHERE user_id = p_user_id) AS comments_made,
        (SELECT COUNT(*) FROM post_likes WHERE user_id = p_user_id) AS likes_given;
END //


-- ==========================================
-- PROCEDURE 2: Process Land Mutation with Transaction
-- Land mutation workflow
-- ==========================================
CREATE PROCEDURE IF NOT EXISTS sp_process_land_mutation(
    IN p_mutation_id INT,
    IN p_new_status VARCHAR(20),
    IN p_admin_notes TEXT
)
BEGIN
    DECLARE v_buyer_nid VARCHAR(50);
    DECLARE v_seller_id INT;
    DECLARE v_buyer_id INT;
    DECLARE v_khatian_no VARCHAR(100);
    DECLARE v_dag_no VARCHAR(100);
    DECLARE v_land_amount VARCHAR(100);
    DECLARE v_land_price DECIMAL(15,2);
    DECLARE v_division_id INT;
    DECLARE v_district_id INT;
    DECLARE v_upazila_id INT;
    DECLARE v_tracking_number VARCHAR(50);
    
    -- Error handler
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Get mutation details
    SELECT 
        buyer_nid, user_id, khatian_no, dag_no, land_amount, land_price,
        division_id, district_id, upazila_id, tracking_number
    INTO 
        v_buyer_nid, v_seller_id, v_khatian_no, v_dag_no, v_land_amount, v_land_price,
        v_division_id, v_district_id, v_upazila_id, v_tracking_number
    FROM land_mutations_v2 
    WHERE id = p_mutation_id
    FOR UPDATE;
    
    IF v_seller_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mutation record not found';
    END IF;
    
    -- Get buyer user_id from NID
    SELECT id INTO v_buyer_id FROM reg_info WHERE nid = v_buyer_nid LIMIT 1;
    
    -- Process based on status
    IF p_new_status = 'Approved' THEN
        IF v_buyer_id IS NOT NULL THEN
            -- Check if land record exists for seller
            IF EXISTS (SELECT 1 FROM my_land_record WHERE user_id = v_seller_id AND khatian_no = v_khatian_no AND dag_no = v_dag_no) THEN
                -- Transfer land record from seller to buyer
                UPDATE my_land_record 
                SET user_id = v_buyer_id,
                    ownership_description = CONCAT('Transferred via Mutation #', v_tracking_number, ' on ', NOW())
                WHERE user_id = v_seller_id 
                AND khatian_no = v_khatian_no
                AND dag_no = v_dag_no;
            ELSE
                -- Create new land record for buyer
                INSERT INTO my_land_record (
                    user_id, khatian_no, dag_no, land_size, land_price,
                    division_id, district_id, upazila_id, ownership_description
                ) VALUES (
                    v_buyer_id, v_khatian_no, v_dag_no, v_land_amount, v_land_price,
                    v_division_id, v_district_id, v_upazila_id,
                    CONCAT('Acquired via Mutation #', v_tracking_number)
                );
            END IF;
        END IF;
        
        -- Create notification for seller
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
            v_seller_id,
            'Land Mutation Approved',
            CONCAT('Your land mutation request (', v_tracking_number, ') has been approved.'),
            'success'
        );
        
        -- Create notification for buyer if registered
        IF v_buyer_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (
                v_buyer_id,
                'Land Transfer Received',
                CONCAT('Land (Khatian: ', v_khatian_no, ', Dag: ', v_dag_no, ') has been transferred to your name.'),
                'success'
            );
        END IF;
        
    ELSEIF p_new_status = 'Rejected' THEN
        -- Create rejection notification
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
            v_seller_id,
            'Land Mutation Rejected',
            CONCAT('Your mutation request (', v_tracking_number, ') was rejected. ', COALESCE(p_admin_notes, '')),
            'error'
        );
    END IF;
    
    -- Update mutation status
    UPDATE land_mutations_v2 
    SET status = p_new_status
    WHERE id = p_mutation_id;
    
    -- Log to service_requests
    INSERT INTO service_requests (user_id, service_type, details, status)
    VALUES (
        v_seller_id, 
        'Land Mutation', 
        CONCAT('Mutation #', v_tracking_number, ' - Status: ', p_new_status),
        'approved'
    );
    
    -- Log to audit
    INSERT INTO audit_log (table_name, record_id, action, new_values)
    VALUES (
        'land_mutations_v2',
        p_mutation_id,
        'UPDATE',
        JSON_OBJECT('status', p_new_status, 'notes', p_admin_notes)
    );
    
    COMMIT;
    
    -- Return success
    SELECT 'SUCCESS' AS result, p_mutation_id AS mutation_id, p_new_status AS new_status;
END //


-- ==========================================
-- PROCEDURE 3: Generate Monthly Statistics Report
-- Monthly stats
-- ==========================================
CREATE PROCEDURE IF NOT EXISTS sp_monthly_statistics(
    IN p_year INT,
    IN p_month INT
)
BEGIN
    -- Validate inputs
    IF p_year IS NULL THEN SET p_year = YEAR(CURDATE()); END IF;
    IF p_month IS NULL THEN SET p_month = MONTH(CURDATE()); END IF;
    
    -- Result Set 1: User Registration Stats
    SELECT 
        'USER_REGISTRATIONS' AS report_section,
        COUNT(*) AS new_registrations,
        (SELECT COUNT(*) FROM reg_info) AS total_users,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM reg_info), 2) AS percent_of_total
    FROM reg_info 
    WHERE YEAR(created_at) = p_year AND MONTH(created_at) = p_month;
    
    -- Result Set 2: Service Request Statistics by Type
    SELECT 
        'SERVICE_REQUESTS' AS report_section,
        service_type,
        COUNT(*) AS total_requests,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        ROUND(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS approval_rate
    FROM service_requests
    WHERE YEAR(created_at) = p_year AND MONTH(created_at) = p_month
    GROUP BY service_type
    ORDER BY total_requests DESC;
    
    -- Result Set 3: Land Mutations by Division
    SELECT 
        'LAND_MUTATIONS' AS report_section,
        d.name AS division,
        COUNT(*) AS total_mutations,
        SUM(CASE WHEN m.status = 'Approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN m.status = 'Pending' THEN 1 ELSE 0 END) AS pending,
        COALESCE(SUM(m.land_price), 0) AS total_value,
        COALESCE(AVG(m.land_price), 0) AS avg_value
    FROM land_mutations_v2 m
    LEFT JOIN divisions d ON m.division_id = d.id
    WHERE YEAR(m.created_at) = p_year AND MONTH(m.created_at) = p_month
    GROUP BY d.id, d.name
    ORDER BY total_mutations DESC;
    
    -- Result Set 4: Community Activity
    SELECT 
        'COMMUNITY_ACTIVITY' AS report_section,
        (SELECT COUNT(*) FROM community_groups WHERE YEAR(created_at) = p_year AND MONTH(created_at) = p_month) AS new_groups,
        (SELECT COUNT(*) FROM community_posts WHERE YEAR(created_at) = p_year AND MONTH(created_at) = p_month) AS new_posts,
        (SELECT COUNT(*) FROM post_comments WHERE YEAR(created_at) = p_year AND MONTH(created_at) = p_month) AS new_comments,
        (SELECT COUNT(*) FROM community_members WHERE YEAR(joined_at) = p_year AND MONTH(joined_at) = p_month) AS new_memberships;
    
    -- Result Set 5: Document Submissions
    SELECT 
        'DOCUMENT_SUBMISSIONS' AS report_section,
        doc_category,
        COUNT(*) AS total_submitted,
        SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected
    FROM govt_user_documents
    WHERE YEAR(created_at) = p_year AND MONTH(created_at) = p_month
    GROUP BY doc_category;
    
    -- Result Set 6: Daily Activity Trend
    SELECT 
        'DAILY_TREND' AS report_section,
        DATE(created_at) AS date,
        COUNT(*) AS total_activity
    FROM (
        SELECT created_at FROM service_requests WHERE YEAR(created_at) = p_year AND MONTH(created_at) = p_month
        UNION ALL
        SELECT created_at FROM community_posts WHERE YEAR(created_at) = p_year AND MONTH(created_at) = p_month
        UNION ALL
        SELECT login_time AS created_at FROM login_logs WHERE YEAR(login_time) = p_year AND MONTH(login_time) = p_month
    ) combined
    GROUP BY DATE(created_at)
    ORDER BY date;
END //


-- ==========================================
-- PROCEDURE 4: Search Citizens by Multiple Criteria
-- Flexible search with multiple optional parameters
-- ==========================================
CREATE PROCEDURE IF NOT EXISTS sp_search_citizens(
    IN p_name VARCHAR(255),
    IN p_nid VARCHAR(50),
    IN p_email VARCHAR(255),
    IN p_mobile VARCHAR(20),
    IN p_division_id INT,
    IN p_limit INT
)
BEGIN
    SET p_limit = COALESCE(p_limit, 50);
    
    SELECT 
        u.id,
        u.name,
        u.email,
        u.nid,
        u.mobile,
        u.gender,
        u.created_at,
        (SELECT COUNT(*) FROM service_requests WHERE user_id = u.id) AS total_requests,
        (SELECT COUNT(*) FROM my_land_record WHERE user_id = u.id) AS land_records
    FROM reg_info u
    LEFT JOIN addresses a ON u.id = a.user_id
    WHERE 
        (p_name IS NULL OR u.name LIKE CONCAT('%', p_name, '%'))
        AND (p_nid IS NULL OR u.nid = p_nid)
        AND (p_email IS NULL OR u.email LIKE CONCAT('%', p_email, '%'))
        AND (p_mobile IS NULL OR u.mobile = p_mobile)
        AND (p_division_id IS NULL OR a.division_id = p_division_id)
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT p_limit;
END //


DELIMITER ;
