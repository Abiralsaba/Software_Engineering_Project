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
    u.nid AS nid_number,
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
-- Join Latest NID
LEFT JOIN (
    SELECT * FROM govt_user_documents 
    WHERE id IN (
        SELECT MAX(id) FROM govt_user_documents WHERE doc_category = 'NID' GROUP BY user_id
    )
) nid_doc ON u.id = nid_doc.user_id
-- Join Latest Passport
LEFT JOIN (
    SELECT * FROM govt_user_documents 
    WHERE id IN (
        SELECT MAX(id) FROM govt_user_documents WHERE doc_category = 'Passport' GROUP BY user_id
    )
) pass_doc ON u.id = pass_doc.user_id
-- Join Latest Tax
LEFT JOIN (
    SELECT * FROM govt_user_documents 
    WHERE id IN (
        SELECT MAX(id) FROM govt_user_documents WHERE doc_category = 'Tax' GROUP BY user_id
    )
) tax_doc ON u.id = tax_doc.user_id;


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








-- ==========================================
-- VIEW 9: Shop Product Inventory Report
-- Product performance with REAL sales data (from JSON)
-- ==========================================
CREATE OR REPLACE VIEW v_shop_product_inventory AS
SELECT 
    s.id AS product_id,
    s.name AS product_name,
    s.description,
    s.price,
    s.stock_quantity,
    s.image_url,
    s.created_at AS listed_date,
    
    -- Real Sales Statistics (Calculated from JSON)
    COALESCE(sales.total_orders, 0) AS total_orders,
    COALESCE(sales.total_quantity_sold, 0) AS total_quantity_sold,
    COALESCE(sales.total_revenue, 0) AS total_revenue,
    COALESCE(ROUND(sales.avg_order_quantity, 2), 0) AS avg_order_quantity,
    
    -- Cart Statistics
    COALESCE(cart.in_carts, 0) AS currently_in_carts,
    COALESCE(cart.potential_revenue, 0) AS potential_cart_revenue,
    
    -- Inventory Status
    CASE 
        WHEN s.stock_quantity <= 0 THEN 'Out of Stock'
        WHEN s.stock_quantity <= 5 THEN 'Critical'
        WHEN s.stock_quantity <= 20 THEN 'Low'
        WHEN s.stock_quantity <= 50 THEN 'Moderate'
        ELSE 'Well Stocked'
    END AS inventory_status,
    
    -- Product Performance Score
    (COALESCE(sales.total_orders, 0) * 10 + COALESCE(sales.total_quantity_sold, 0) * 5) AS popularity_score,
    
    -- Days since listing
    DATEDIFF(CURDATE(), s.created_at) AS days_listed

FROM shop_items s
LEFT JOIN (
    SELECT 
        CAST(JSON_UNQUOTE(JSON_EXTRACT(o.product_details, CONCAT('$[', n.n, '].product_id'))) AS UNSIGNED) AS item_id,
        COUNT(DISTINCT o.id) AS total_orders,
        SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(o.product_details, CONCAT('$[', n.n, '].quantity'))) AS UNSIGNED)) AS total_quantity_sold,
        SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(o.product_details, CONCAT('$[', n.n, '].unit_price'))) AS DECIMAL(10,2)) * 
            CAST(JSON_UNQUOTE(JSON_EXTRACT(o.product_details, CONCAT('$[', n.n, '].quantity'))) AS UNSIGNED)) AS total_revenue,
        AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(o.product_details, CONCAT('$[', n.n, '].quantity'))) AS UNSIGNED)) AS avg_order_quantity
    FROM Ordered_item o
    JOIN (
        SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
    ) n ON n.n < JSON_LENGTH(o.product_details)
    GROUP BY item_id
) sales ON s.id = sales.item_id
LEFT JOIN (
    SELECT 
        item_id,
        COUNT(*) AS in_carts,
        SUM(quantity * (SELECT price FROM shop_items WHERE id = addto_cart.item_id)) AS potential_revenue
    FROM addto_cart
    GROUP BY item_id
) cart ON s.id = cart.item_id
ORDER BY popularity_score DESC, s.name;


-- ==========================================
-- VIEW 10: User Purchase History Summary
-- Aggregated shopping behavior per user
-- ==========================================
CREATE OR REPLACE VIEW v_user_purchase_history AS
SELECT 
    u.id AS user_id,
    u.name AS customer_name,
    u.nid AS customer_nid,
    u.email,
    u.mobile,
    
    -- Order Statistics
    COALESCE(orders.total_orders, 0) AS total_orders,
    
    -- Revenue Metrics
    COALESCE(orders.total_spent, 0) AS total_spent,
    COALESCE(ROUND(orders.avg_order_value, 2), 0) AS avg_order_value,
    COALESCE(orders.max_order, 0) AS highest_order,
    COALESCE(orders.min_order, 0) AS lowest_order,
    
    -- Items Purchased (restored using virtual items)
    COALESCE(items.total_items_purchased, 0) AS total_items_purchased,
    COALESCE(items.unique_products, 0) AS unique_products_bought,
    
    -- Cart Status
    COALESCE(cart.items_in_cart, 0) AS current_cart_items,
    COALESCE(cart.cart_value, 0) AS current_cart_value,
    
    -- Timeline
    orders.first_order_date,
    orders.last_order_date,
    DATEDIFF(CURDATE(), orders.last_order_date) AS days_since_last_order,
    
    -- Customer Classification
    CASE 
        WHEN COALESCE(orders.total_spent, 0) >= 10000 THEN 'VIP'
        WHEN COALESCE(orders.total_spent, 0) >= 5000 THEN 'Premium'
        WHEN COALESCE(orders.total_spent, 0) >= 1000 THEN 'Regular'
        WHEN COALESCE(orders.total_orders, 0) >= 1 THEN 'New'
        ELSE 'Prospect'
    END AS customer_tier

FROM reg_info u
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) AS total_orders,
        SUM(total_amount) AS total_spent,
        AVG(total_amount) AS avg_order_value,
        MAX(total_amount) AS max_order,
        MIN(total_amount) AS min_order,
        MIN(created_at) AS first_order_date,
        MAX(created_at) AS last_order_date
    FROM Ordered_item
    GROUP BY user_id
) orders ON u.id = orders.user_id
LEFT JOIN (
    SELECT 
        o.user_id,
        SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(o.product_details, CONCAT('$[', n.n, '].quantity'))) AS UNSIGNED)) AS total_items_purchased,
        COUNT(DISTINCT CAST(JSON_UNQUOTE(JSON_EXTRACT(o.product_details, CONCAT('$[', n.n, '].product_id'))) AS UNSIGNED)) AS unique_products
    FROM Ordered_item o
    JOIN (
        SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
    ) n ON n.n < JSON_LENGTH(o.product_details)
    GROUP BY o.user_id
) items ON u.id = items.user_id
LEFT JOIN (
    SELECT 
        user_nid,
        COUNT(*) AS items_in_cart,
        SUM(c.quantity * s.price) AS cart_value
    FROM addto_cart c
    JOIN shop_items s ON c.item_id = s.id
    GROUP BY user_nid
) cart ON u.nid = cart.user_nid
ORDER BY COALESCE(orders.total_spent, 0) DESC;


-- ==========================================
-- EDUCATION ANALYTICS VIEWS
-- Exam analysis (JSC, SSC, HSC)
-- Bangladesh Education Board System
-- ==========================================


-- ==========================================
-- VIEW 11: Yearly Exam Performance Overview
-- Aggregated yearly statistics for all exam types
-- ==========================================
CREATE OR REPLACE VIEW v_education_yearly_analysis AS
SELECT 
    exam_year,
    exam_type,
    
    -- Total Statistics
    total_students,
    passed_students,
    failed_students,
    
    -- Pass Rate
    ROUND((passed_students * 100.0 / total_students), 2) AS pass_rate,
    ROUND((failed_students * 100.0 / total_students), 2) AS fail_rate,
    
    -- GPA Statistics
    avg_gpa,
    max_gpa,
    min_gpa,
    
    -- GPA Distribution
    gpa_5_count,
    ROUND((gpa_5_count * 100.0 / NULLIF(passed_students, 0)), 2) AS gpa_5_percentage,
    gpa_4_plus_count,
    gpa_3_plus_count,
    gpa_below_3_count,
    
    -- Year-over-Year Comparison Metrics
    CASE 
        WHEN exam_year > (SELECT MIN(exam_year) FROM jsc_results) THEN 'Available'
        ELSE 'First Year'
    END AS yoy_comparison_status

FROM (
    -- JSC Results
    SELECT 
        exam_year,
        'JSC' AS exam_type,
        COUNT(*) AS total_students,
        SUM(CASE WHEN result_status = 'Passed' THEN 1 ELSE 0 END) AS passed_students,
        SUM(CASE WHEN result_status = 'Failed' THEN 1 ELSE 0 END) AS failed_students,
        ROUND(AVG(gpa), 2) AS avg_gpa,
        MAX(gpa) AS max_gpa,
        MIN(CASE WHEN gpa > 0 THEN gpa END) AS min_gpa,
        SUM(CASE WHEN gpa = 5.00 THEN 1 ELSE 0 END) AS gpa_5_count,
        SUM(CASE WHEN gpa >= 4.00 AND gpa < 5.00 THEN 1 ELSE 0 END) AS gpa_4_plus_count,
        SUM(CASE WHEN gpa >= 3.00 AND gpa < 4.00 THEN 1 ELSE 0 END) AS gpa_3_plus_count,
        SUM(CASE WHEN gpa > 0 AND gpa < 3.00 THEN 1 ELSE 0 END) AS gpa_below_3_count
    FROM jsc_results
    GROUP BY exam_year
    
    UNION ALL
    
    -- SSC Results
    SELECT 
        exam_year,
        'SSC' AS exam_type,
        COUNT(*) AS total_students,
        SUM(CASE WHEN result_status = 'Passed' THEN 1 ELSE 0 END) AS passed_students,
        SUM(CASE WHEN result_status = 'Failed' THEN 1 ELSE 0 END) AS failed_students,
        ROUND(AVG(gpa), 2) AS avg_gpa,
        MAX(gpa) AS max_gpa,
        MIN(CASE WHEN gpa > 0 THEN gpa END) AS min_gpa,
        SUM(CASE WHEN gpa = 5.00 THEN 1 ELSE 0 END) AS gpa_5_count,
        SUM(CASE WHEN gpa >= 4.00 AND gpa < 5.00 THEN 1 ELSE 0 END) AS gpa_4_plus_count,
        SUM(CASE WHEN gpa >= 3.00 AND gpa < 4.00 THEN 1 ELSE 0 END) AS gpa_3_plus_count,
        SUM(CASE WHEN gpa > 0 AND gpa < 3.00 THEN 1 ELSE 0 END) AS gpa_below_3_count
    FROM ssc_results
    GROUP BY exam_year
    
    UNION ALL
    
    -- HSC Results
    SELECT 
        exam_year,
        'HSC' AS exam_type,
        COUNT(*) AS total_students,
        SUM(CASE WHEN result_status = 'Passed' THEN 1 ELSE 0 END) AS passed_students,
        SUM(CASE WHEN result_status = 'Failed' THEN 1 ELSE 0 END) AS failed_students,
        ROUND(AVG(gpa), 2) AS avg_gpa,
        MAX(gpa) AS max_gpa,
        MIN(CASE WHEN gpa > 0 THEN gpa END) AS min_gpa,
        SUM(CASE WHEN gpa = 5.00 THEN 1 ELSE 0 END) AS gpa_5_count,
        SUM(CASE WHEN gpa >= 4.00 AND gpa < 5.00 THEN 1 ELSE 0 END) AS gpa_4_plus_count,
        SUM(CASE WHEN gpa >= 3.00 AND gpa < 4.00 THEN 1 ELSE 0 END) AS gpa_3_plus_count,
        SUM(CASE WHEN gpa > 0 AND gpa < 3.00 THEN 1 ELSE 0 END) AS gpa_below_3_count
    FROM hsc_results
    GROUP BY exam_year
) combined
ORDER BY exam_year DESC, exam_type;


-- ==========================================
-- VIEW 12: Board-wise Performance Analysis by Year
-- Detailed board performance for each exam type and year
-- ==========================================
CREATE OR REPLACE VIEW v_education_board_analysis AS
SELECT 
    exam_year,
    exam_type,
    board_id,
    board_name,
    board_code,
    
    -- Student Statistics
    total_students,
    passed_students,
    failed_students,
    ROUND((passed_students * 100.0 / NULLIF(total_students, 0)), 2) AS pass_rate,
    
    -- GPA Statistics
    avg_gpa,
    max_gpa,
    min_passing_gpa,
    
    -- Golden GPA (5.00) Achievers
    golden_gpa_count,
    ROUND((golden_gpa_count * 100.0 / NULLIF(passed_students, 0)), 2) AS golden_gpa_rate,
    
    -- Performance Category
    CASE 
        WHEN ROUND((passed_students * 100.0 / NULLIF(total_students, 0)), 2) >= 95 THEN 'Excellent'
        WHEN ROUND((passed_students * 100.0 / NULLIF(total_students, 0)), 2) >= 85 THEN 'Very Good'
        WHEN ROUND((passed_students * 100.0 / NULLIF(total_students, 0)), 2) >= 75 THEN 'Good'
        WHEN ROUND((passed_students * 100.0 / NULLIF(total_students, 0)), 2) >= 60 THEN 'Average'
        ELSE 'Below Average'
    END AS performance_category,
    
    -- Board Ranking for the Year (within exam type)
    board_rank

FROM (
    -- JSC Board Analysis
    SELECT 
        j.exam_year,
        'JSC' AS exam_type,
        b.id AS board_id,
        b.name AS board_name,
        b.code AS board_code,
        COUNT(*) AS total_students,
        SUM(CASE WHEN j.result_status = 'Passed' THEN 1 ELSE 0 END) AS passed_students,
        SUM(CASE WHEN j.result_status = 'Failed' THEN 1 ELSE 0 END) AS failed_students,
        ROUND(AVG(j.gpa), 2) AS avg_gpa,
        MAX(j.gpa) AS max_gpa,
        MIN(CASE WHEN j.gpa > 0 THEN j.gpa END) AS min_passing_gpa,
        SUM(CASE WHEN j.gpa = 5.00 THEN 1 ELSE 0 END) AS golden_gpa_count,
        RANK() OVER (PARTITION BY j.exam_year ORDER BY AVG(j.gpa) DESC) AS board_rank
    FROM jsc_results j
    JOIN education_boards b ON j.board_id = b.id
    GROUP BY j.exam_year, b.id, b.name, b.code
    
    UNION ALL
    
    -- SSC Board Analysis
    SELECT 
        s.exam_year,
        'SSC' AS exam_type,
        b.id AS board_id,
        b.name AS board_name,
        b.code AS board_code,
        COUNT(*) AS total_students,
        SUM(CASE WHEN s.result_status = 'Passed' THEN 1 ELSE 0 END) AS passed_students,
        SUM(CASE WHEN s.result_status = 'Failed' THEN 1 ELSE 0 END) AS failed_students,
        ROUND(AVG(s.gpa), 2) AS avg_gpa,
        MAX(s.gpa) AS max_gpa,
        MIN(CASE WHEN s.gpa > 0 THEN s.gpa END) AS min_passing_gpa,
        SUM(CASE WHEN s.gpa = 5.00 THEN 1 ELSE 0 END) AS golden_gpa_count,
        RANK() OVER (PARTITION BY s.exam_year ORDER BY AVG(s.gpa) DESC) AS board_rank
    FROM ssc_results s
    JOIN education_boards b ON s.board_id = b.id
    GROUP BY s.exam_year, b.id, b.name, b.code
    
    UNION ALL
    
    -- HSC Board Analysis
    SELECT 
        h.exam_year,
        'HSC' AS exam_type,
        b.id AS board_id,
        b.name AS board_name,
        b.code AS board_code,
        COUNT(*) AS total_students,
        SUM(CASE WHEN h.result_status = 'Passed' THEN 1 ELSE 0 END) AS passed_students,
        SUM(CASE WHEN h.result_status = 'Failed' THEN 1 ELSE 0 END) AS failed_students,
        ROUND(AVG(h.gpa), 2) AS avg_gpa,
        MAX(h.gpa) AS max_gpa,
        MIN(CASE WHEN h.gpa > 0 THEN h.gpa END) AS min_passing_gpa,
        SUM(CASE WHEN h.gpa = 5.00 THEN 1 ELSE 0 END) AS golden_gpa_count,
        RANK() OVER (PARTITION BY h.exam_year ORDER BY AVG(h.gpa) DESC) AS board_rank
    FROM hsc_results h
    JOIN education_boards b ON h.board_id = b.id
    GROUP BY h.exam_year, b.id, b.name, b.code
) combined
ORDER BY exam_year DESC, exam_type, board_rank;


-- ==========================================
-- VIEW 13: Institution-wise Performance Analysis
-- Detailed analysis of each institution's performance
-- ==========================================
CREATE OR REPLACE VIEW v_education_institution_analysis AS
SELECT 
    institution_name,
    board_name,
    exam_type,
    exam_year,
    
    -- Student Count
    total_students,
    passed_students,
    failed_students,
    
    -- Pass Rate
    ROUND((passed_students * 100.0 / NULLIF(total_students, 0)), 2) AS pass_rate,
    
    -- GPA Statistics
    avg_gpa,
    max_gpa,
    min_passing_gpa,
    
    -- Golden GPA
    golden_gpa_count,
    ROUND((golden_gpa_count * 100.0 / NULLIF(passed_students, 0)), 2) AS golden_gpa_rate,
    
    -- GPA Range Distribution
    high_achievers,  -- GPA >= 4.5
    mid_achievers,   -- GPA 3.5-4.49
    average_achievers, -- GPA 2.5-3.49
    
    -- Institution Tier
    CASE 
        WHEN avg_gpa >= 4.75 AND ROUND((passed_students * 100.0 / NULLIF(total_students, 0)), 2) >= 95 THEN 'Tier 1 - Elite'
        WHEN avg_gpa >= 4.25 AND ROUND((passed_students * 100.0 / NULLIF(total_students, 0)), 2) >= 85 THEN 'Tier 2 - Premium'
        WHEN avg_gpa >= 3.75 AND ROUND((passed_students * 100.0 / NULLIF(total_students, 0)), 2) >= 75 THEN 'Tier 3 - Good'
        WHEN avg_gpa >= 3.00 THEN 'Tier 4 - Average'
        ELSE 'Tier 5 - Needs Improvement'
    END AS institution_tier,
    
    -- Institution Rank within Board for the Year
    institution_rank

FROM (
    -- JSC Institution Analysis
    SELECT 
        j.institution_name,
        b.name AS board_name,
        'JSC' AS exam_type,
        j.exam_year,
        COUNT(*) AS total_students,
        SUM(CASE WHEN j.result_status = 'Passed' THEN 1 ELSE 0 END) AS passed_students,
        SUM(CASE WHEN j.result_status = 'Failed' THEN 1 ELSE 0 END) AS failed_students,
        ROUND(AVG(j.gpa), 2) AS avg_gpa,
        MAX(j.gpa) AS max_gpa,
        MIN(CASE WHEN j.gpa > 0 THEN j.gpa END) AS min_passing_gpa,
        SUM(CASE WHEN j.gpa = 5.00 THEN 1 ELSE 0 END) AS golden_gpa_count,
        SUM(CASE WHEN j.gpa >= 4.50 THEN 1 ELSE 0 END) AS high_achievers,
        SUM(CASE WHEN j.gpa >= 3.50 AND j.gpa < 4.50 THEN 1 ELSE 0 END) AS mid_achievers,
        SUM(CASE WHEN j.gpa >= 2.50 AND j.gpa < 3.50 THEN 1 ELSE 0 END) AS average_achievers,
        RANK() OVER (PARTITION BY j.exam_year, j.board_id ORDER BY AVG(j.gpa) DESC) AS institution_rank
    FROM jsc_results j
    JOIN education_boards b ON j.board_id = b.id
    WHERE j.institution_name IS NOT NULL AND j.institution_name != ''
    GROUP BY j.institution_name, b.name, j.exam_year, j.board_id
    
    UNION ALL
    
    -- SSC Institution Analysis
    SELECT 
        s.institution_name,
        b.name AS board_name,
        'SSC' AS exam_type,
        s.exam_year,
        COUNT(*) AS total_students,
        SUM(CASE WHEN s.result_status = 'Passed' THEN 1 ELSE 0 END) AS passed_students,
        SUM(CASE WHEN s.result_status = 'Failed' THEN 1 ELSE 0 END) AS failed_students,
        ROUND(AVG(s.gpa), 2) AS avg_gpa,
        MAX(s.gpa) AS max_gpa,
        MIN(CASE WHEN s.gpa > 0 THEN s.gpa END) AS min_passing_gpa,
        SUM(CASE WHEN s.gpa = 5.00 THEN 1 ELSE 0 END) AS golden_gpa_count,
        SUM(CASE WHEN s.gpa >= 4.50 THEN 1 ELSE 0 END) AS high_achievers,
        SUM(CASE WHEN s.gpa >= 3.50 AND s.gpa < 4.50 THEN 1 ELSE 0 END) AS mid_achievers,
        SUM(CASE WHEN s.gpa >= 2.50 AND s.gpa < 3.50 THEN 1 ELSE 0 END) AS average_achievers,
        RANK() OVER (PARTITION BY s.exam_year, s.board_id ORDER BY AVG(s.gpa) DESC) AS institution_rank
    FROM ssc_results s
    JOIN education_boards b ON s.board_id = b.id
    WHERE s.institution_name IS NOT NULL AND s.institution_name != ''
    GROUP BY s.institution_name, b.name, s.exam_year, s.board_id
    
    UNION ALL
    
    -- HSC Institution Analysis
    SELECT 
        h.institution_name,
        b.name AS board_name,
        'HSC' AS exam_type,
        h.exam_year,
        COUNT(*) AS total_students,
        SUM(CASE WHEN h.result_status = 'Passed' THEN 1 ELSE 0 END) AS passed_students,
        SUM(CASE WHEN h.result_status = 'Failed' THEN 1 ELSE 0 END) AS failed_students,
        ROUND(AVG(h.gpa), 2) AS avg_gpa,
        MAX(h.gpa) AS max_gpa,
        MIN(CASE WHEN h.gpa > 0 THEN h.gpa END) AS min_passing_gpa,
        SUM(CASE WHEN h.gpa = 5.00 THEN 1 ELSE 0 END) AS golden_gpa_count,
        SUM(CASE WHEN h.gpa >= 4.50 THEN 1 ELSE 0 END) AS high_achievers,
        SUM(CASE WHEN h.gpa >= 3.50 AND h.gpa < 4.50 THEN 1 ELSE 0 END) AS mid_achievers,
        SUM(CASE WHEN h.gpa >= 2.50 AND h.gpa < 3.50 THEN 1 ELSE 0 END) AS average_achievers,
        RANK() OVER (PARTITION BY h.exam_year, h.board_id ORDER BY AVG(h.gpa) DESC) AS institution_rank
    FROM hsc_results h
    JOIN education_boards b ON h.board_id = b.id
    WHERE h.institution_name IS NOT NULL AND h.institution_name != ''
    GROUP BY h.institution_name, b.name, h.exam_year, h.board_id
) combined
ORDER BY exam_year DESC, 
    CASE exam_type 
        WHEN 'HSC' THEN 1 
        WHEN 'SSC' THEN 2 
        WHEN 'JSC' THEN 3 
    END,
    avg_gpa DESC,
    institution_rank ASC;


-- ==========================================
-- VIEW 14: Top Performers by Exam Type
-- Lists students with GPA 5.00 (Golden GPA)
-- ==========================================
CREATE OR REPLACE VIEW v_education_top_performers AS
SELECT 
    exam_type,
    exam_year,
    roll_number,
    student_name,
    institution_name,
    board_name,
    gpa,
    result_status,
    'Golden A+' AS achievement_badge

FROM (
    -- JSC Top Performers
    SELECT 
        'JSC' AS exam_type,
        j.exam_year,
        j.roll_number,
        j.student_name,
        j.institution_name,
        b.name AS board_name,
        j.gpa,
        j.result_status
    FROM jsc_results j
    JOIN education_boards b ON j.board_id = b.id
    WHERE j.gpa = 5.00 AND j.result_status = 'Passed'
    
    UNION ALL
    
    -- SSC Top Performers
    SELECT 
        'SSC' AS exam_type,
        s.exam_year,
        s.roll_number,
        s.student_name,
        s.institution_name,
        b.name AS board_name,
        s.gpa,
        s.result_status
    FROM ssc_results s
    JOIN education_boards b ON s.board_id = b.id
    WHERE s.gpa = 5.00 AND s.result_status = 'Passed'
    
    UNION ALL
    
    -- HSC Top Performers
    SELECT 
        'HSC' AS exam_type,
        h.exam_year,
        h.roll_number,
        h.student_name,
        h.institution_name,
        b.name AS board_name,
        h.gpa,
        h.result_status
    FROM hsc_results h
    JOIN education_boards b ON h.board_id = b.id
    WHERE h.gpa = 5.00 AND h.result_status = 'Passed'
) combined
ORDER BY exam_year DESC, exam_type, board_name;


-- ==========================================
-- AGRICULTURE MINISTRY VIEWS
-- Analytics for subsidies, crop production, and training
-- ==========================================


-- ==========================================
-- VIEW: District Agriculture Summary
-- Per-district, per-crop report combining crop reports & subsidies
-- One row per district + crop with production metrics and district-level subsidy totals
-- ==========================================
CREATE OR REPLACE VIEW v_agri_district_summary AS
SELECT 
    di.id AS district_id,
    COALESCE(d.name, '—') AS division_name,
    COALESCE(di.name, '—') AS district_name,

    -- Crop Details
    COALESCE(cr.crop_name, '—') AS crop_name,
    COALESCE(cr.season, '—') AS season,
    COALESCE(cr.total_reports, 0) AS total_reports,
    COALESCE(cr.total_yield_mt, 0) AS total_yield_mt,
    COALESCE(cr.total_land_acres, 0) AS total_land_acres,
    COALESCE(cr.avg_price_per_ton, 0) AS avg_price_per_ton,
    COALESCE(cr.estimated_crop_value, 0) AS estimated_crop_value,
    COALESCE(cr.irrigation_methods, '—') AS irrigation_methods,

    -- Subsidy Metrics (district-level)
    COALESCE(sub.total_subsidy_apps, 0) AS total_subsidy_apps,
    COALESCE(sub.total_amount_requested, 0) AS total_amount_requested,
    COALESCE(sub.total_amount_approved, 0) AS total_amount_approved,
    CASE 
        WHEN COALESCE(sub.total_subsidy_apps, 0) > 0 
        THEN ROUND(COALESCE(sub.approved_count, 0) * 100.0 / sub.total_subsidy_apps, 1)
        ELSE 0
    END AS subsidy_approval_rate,

    -- Productivity Rating (per crop, based on yield per acre)
    CASE 
        WHEN COALESCE(cr.total_land_acres, 0) > 0 
             AND (cr.total_yield_mt / cr.total_land_acres) >= 3 THEN 'High Yield'
        WHEN COALESCE(cr.total_land_acres, 0) > 0 
             AND (cr.total_yield_mt / cr.total_land_acres) >= 1.5 THEN 'Medium Yield'
        WHEN COALESCE(cr.total_land_acres, 0) > 0 THEN 'Low Yield'
        ELSE 'No Data'
    END AS productivity_rating

FROM districts di
JOIN divisions d ON di.division_id = d.id

-- Crop Reports subquery grouped by district + crop
LEFT JOIN (
    SELECT 
        r.district_id,
        r.crop_name,
        GROUP_CONCAT(DISTINCT r.season SEPARATOR ', ') AS season,
        COUNT(*) AS total_reports,
        ROUND(SUM(r.yield_metric_ton), 2) AS total_yield_mt,
        ROUND(SUM(r.land_area_acres), 2) AS total_land_acres,
        ROUND(AVG(r.market_price_per_ton), 2) AS avg_price_per_ton,
        ROUND(SUM(r.yield_metric_ton * COALESCE(r.market_price_per_ton, 0)), 2) AS estimated_crop_value,
        GROUP_CONCAT(DISTINCT r.irrigation_method SEPARATOR ', ') AS irrigation_methods
    FROM agri_crop_reports r
    WHERE r.district_id IS NOT NULL
    GROUP BY r.district_id, r.crop_name
) cr ON di.id = cr.district_id

-- Subsidies subquery grouped by district
LEFT JOIN (
    SELECT 
        s.district_id,
        COUNT(*) AS total_subsidy_apps,
        ROUND(SUM(s.amount_requested), 2) AS total_amount_requested,
        ROUND(SUM(CASE WHEN s.status = 'Approved' THEN s.amount_requested ELSE 0 END), 2) AS total_amount_approved,
        SUM(CASE WHEN s.status = 'Approved' THEN 1 ELSE 0 END) AS approved_count
    FROM agri_subsidies s
    WHERE s.district_id IS NOT NULL
    GROUP BY s.district_id
) sub ON di.id = sub.district_id

-- Only show districts that have at least some agricultural data
WHERE cr.district_id IS NOT NULL OR sub.district_id IS NOT NULL

ORDER BY d.name, di.name, cr.crop_name;


-- ==========================================
-- VIEW: Agriculture Training Program Summary
-- Training programs with registration analytics
-- ==========================================
CREATE OR REPLACE VIEW v_agri_training_summary AS
SELECT 
    t.id AS program_id,
    t.title AS program_title,
    t.category,
    t.status AS program_status,
    
    -- Location
    COALESCE(t.location, '—') AS location,
    COALESCE(d.name, '—') AS division_name,
    COALESCE(di.name, '—') AS district_name,
    
    -- Schedule
    t.start_date,
    t.end_date,
    DATEDIFF(t.end_date, t.start_date) AS duration_days,
    
    -- Trainer
    COALESCE(t.trainer_name, 'TBA') AS trainer_name,
    COALESCE(t.trainer_designation, '—') AS trainer_designation,
    
    -- Capacity
    t.capacity,
    COALESCE(reg.total_registered, 0) AS total_registered,
    t.capacity - COALESCE(reg.total_registered, 0) AS seats_available,
    
    -- Fill Rate
    CASE 
        WHEN t.capacity > 0 THEN ROUND(COALESCE(reg.total_registered, 0) * 100.0 / t.capacity, 1)
        ELSE 0
    END AS fill_rate_pct,
    
    -- Registration Breakdown
    COALESCE(reg.attended_count, 0) AS attended_count,
    COALESCE(reg.cancelled_count, 0) AS cancelled_count,
    
    -- Attendance Rate
    CASE 
        WHEN COALESCE(reg.total_registered, 0) > 0 
        THEN ROUND(COALESCE(reg.attended_count, 0) * 100.0 / reg.total_registered, 1)
        ELSE 0
    END AS attendance_rate_pct,
    
    -- Timeline
    t.created_at AS program_created_at,
    
    -- Program Classification
    CASE 
        WHEN COALESCE(reg.total_registered, 0) >= t.capacity THEN 'Full'
        WHEN COALESCE(reg.total_registered, 0) >= t.capacity * 0.75 THEN 'Nearly Full'
        WHEN COALESCE(reg.total_registered, 0) >= t.capacity * 0.25 THEN 'Open'
        ELSE 'Low Interest'
    END AS demand_level

FROM agri_training_programs t
LEFT JOIN divisions d ON t.division_id = d.id
LEFT JOIN districts di ON t.district_id = di.id
LEFT JOIN (
    SELECT 
        program_id,
        COUNT(*) AS total_registered,
        SUM(CASE WHEN status = 'Attended' THEN 1 ELSE 0 END) AS attended_count,
        SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_count
    FROM agri_training_registrations
    GROUP BY program_id
) reg ON t.id = reg.program_id
ORDER BY t.start_date DESC;
