-- ==========================================
-- DATABASE TRIGGERS
-- Central Government System
-- ==========================================

DELIMITER //

-- TRIGGER 1: Auto-create notification on service request status change
DROP TRIGGER IF EXISTS tr_service_request_status_change //
CREATE TRIGGER tr_service_request_status_change
AFTER UPDATE ON service_requests
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO notifications (user_id, message, type)
        VALUES (
            NEW.user_id,
            CONCAT('Service Request ', UPPER(LEFT(NEW.status, 1)), LOWER(SUBSTRING(NEW.status, 2)), ': Your ', NEW.service_type, ' request has been ', NEW.status, '.'),
            CASE NEW.status 
                WHEN 'approved' THEN 'success'
                WHEN 'rejected' THEN 'error'
                ELSE 'info'
            END
        );
    END IF;
END //


-- TRIGGER 2: Update post like count on insert
DROP TRIGGER IF EXISTS tr_like_insert //
CREATE TRIGGER tr_like_insert
AFTER INSERT ON post_likes
FOR EACH ROW
BEGIN
    UPDATE community_posts 
    SET like_count = like_count + 1 
    WHERE id = NEW.post_id;
END //


-- TRIGGER 3: Update post like count on delete
DROP TRIGGER IF EXISTS tr_like_delete //
CREATE TRIGGER tr_like_delete
AFTER DELETE ON post_likes
FOR EACH ROW
BEGIN
    UPDATE community_posts 
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.post_id;
END //


-- TRIGGER 4: Update comment count on insert
DROP TRIGGER IF EXISTS tr_comment_insert //
CREATE TRIGGER tr_comment_insert
AFTER INSERT ON post_comments
FOR EACH ROW
BEGIN
    UPDATE community_posts 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.post_id;
END //


-- TRIGGER 5: Update comment count on delete
DROP TRIGGER IF EXISTS tr_comment_delete //
CREATE TRIGGER tr_comment_delete
AFTER DELETE ON post_comments
FOR EACH ROW
BEGIN
    UPDATE community_posts 
    SET comment_count = GREATEST(comment_count - 1, 0)
    WHERE id = OLD.post_id;
END //


-- ==========================================
-- TRIGGER 6: Audit log for land mutations (UPDATE)
-- Track land mutation changes
-- ==========================================
DROP TRIGGER IF EXISTS tr_land_mutation_audit_update //
CREATE TRIGGER tr_land_mutation_audit_update
AFTER UPDATE ON land_mutations_v2
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (
        table_name, 
        record_id, 
        action, 
        old_values, 
        new_values,
        changed_fields
    )
    VALUES (
        'land_mutations_v2',
        NEW.id,
        'UPDATE',
        JSON_OBJECT(
            'status', OLD.status,
            'land_price', OLD.land_price,
            'buyer_nid', OLD.buyer_nid,
            'khatian_no', OLD.khatian_no
        ),
        JSON_OBJECT(
            'status', NEW.status,
            'land_price', NEW.land_price,
            'buyer_nid', NEW.buyer_nid,
            'khatian_no', NEW.khatian_no
        ),
        CONCAT_WS(',',
            IF(OLD.status != NEW.status, 'status', NULL),
            IF(OLD.land_price != NEW.land_price, 'land_price', NULL)
        )
    );
END //


-- TRIGGER 7: Audit log for land mutations (INSERT)
DROP TRIGGER IF EXISTS tr_land_mutation_audit_insert //
CREATE TRIGGER tr_land_mutation_audit_insert
AFTER INSERT ON land_mutations_v2
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (
        table_name, 
        record_id, 
        action, 
        new_values,
        user_id
    )
    VALUES (
        'land_mutations_v2',
        NEW.id,
        'INSERT',
        JSON_OBJECT(
            'tracking_number', NEW.tracking_number,
            'buyer_nid', NEW.buyer_nid,
            'khatian_no', NEW.khatian_no,
            'land_price', NEW.land_price
        ),
        NEW.user_id
    );
END //


-- TRIGGER 8: Notify group admin on new member join
DROP TRIGGER IF EXISTS tr_member_join_notify //
CREATE TRIGGER tr_member_join_notify
AFTER INSERT ON community_members
FOR EACH ROW
BEGIN
    DECLARE v_member_name VARCHAR(255);
    DECLARE v_group_creator INT;
    
    -- Get member name
    SELECT name INTO v_member_name FROM reg_info WHERE id = NEW.user_id LIMIT 1;
    
    -- Get group creator
    SELECT created_by INTO v_group_creator FROM community_groups WHERE id = NEW.group_id LIMIT 1;
    
    -- Notify group creator (if not the same user)
    IF v_group_creator IS NOT NULL AND v_group_creator != NEW.user_id THEN
        INSERT INTO notifications (user_id, message, type)
        VALUES (
            v_group_creator,
            CONCAT('New Member Joined: ', COALESCE(v_member_name, 'Someone'), ' joined your group!'),
            'info'
        );
    END IF;
END //


-- ==========================================
-- TRIGGER 9: Auto-update user_info on reg_info change
-- Keeps user_info in sync with reg_info
-- ==========================================
DROP TRIGGER IF EXISTS tr_sync_user_info //
CREATE TRIGGER tr_sync_user_info
AFTER UPDATE ON reg_info
FOR EACH ROW
BEGIN
    -- Check if user_info exists for this user
    IF EXISTS (SELECT 1 FROM user_info WHERE user_id = NEW.id) THEN
        UPDATE user_info 
        SET 
            name = NEW.name,
            email = NEW.email,
            nid = NEW.nid,
            mobile = NEW.mobile,
            dob = NEW.dob,
            address = NEW.address,
            gender = NEW.gender
        WHERE user_id = NEW.id;
    ELSE
        -- Create user_info if it doesn't exist
        INSERT INTO user_info (user_id, name, email, nid, mobile, dob, address, gender)
        VALUES (NEW.id, NEW.name, NEW.email, NEW.nid, NEW.mobile, NEW.dob, NEW.address, NEW.gender);
    END IF;
END //


-- TRIGGER 10: Log user document uploads
DROP TRIGGER IF EXISTS tr_document_upload_log //
CREATE TRIGGER tr_document_upload_log
AFTER INSERT ON govt_user_documents
FOR EACH ROW
BEGIN
    -- Create service request entry for tracking
    INSERT INTO service_requests (user_id, service_type, details, status)
    VALUES (
        NEW.user_id,
        CONCAT(NEW.doc_category, ' Upload'),
        CONCAT('Document uploaded: ', NEW.doc_category, ' - ', COALESCE(NEW.identity_number, 'N/A')),
        'pending'
    );
END //


-- ==========================================
-- TRIGGER 12: Notify user on order placement
-- Creates notification when a new order is placed
-- ==========================================
DROP TRIGGER IF EXISTS tr_order_placed_notify //
CREATE TRIGGER tr_order_placed_notify
AFTER INSERT ON Ordered_item
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT;
    
    -- Get user_id from reg_info using ID (fixed from NID)
    SELECT id INTO v_user_id FROM reg_info WHERE id = NEW.user_id LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, message, type)
        VALUES (
            v_user_id,
            CONCAT('Order Placed Successfully! Order #', NEW.id, ' - Total: ৳', NEW.total_amount, ' (', NEW.payment_method, ')'),
            'success'
        );
    END IF;
END //


-- ==========================================
-- TRIGGER 14: Clear cart items after order placement
-- Removes items from cart immediately when order is placed
-- ==========================================
DROP TRIGGER IF EXISTS tr_clear_cart_on_order //
CREATE TRIGGER tr_clear_cart_on_order
AFTER INSERT ON Ordered_item
FOR EACH ROW
BEGIN
    DELETE FROM addto_cart WHERE user_nid = NEW.user_nid;
END //


-- ==========================================
-- TRIGGER 15: Audit log for shop orders (INSERT)
-- Track new orders
-- ==========================================
DROP TRIGGER IF EXISTS tr_shop_order_audit_insert //
CREATE TRIGGER tr_shop_order_audit_insert
AFTER INSERT ON Ordered_item
FOR EACH ROW
BEGIN
    DECLARE v_user_id INT;
    
    SELECT id INTO v_user_id FROM reg_info WHERE id = NEW.user_id LIMIT 1;
    
    INSERT INTO audit_log (
        table_name, 
        record_id, 
        action, 
        new_values,
        user_id
    )
    VALUES (
        'ordered_item',
        NEW.id,
        'INSERT',
        JSON_OBJECT(
            'order_id', NEW.id,
            'user_id', NEW.user_id,
            'total_amount', NEW.total_amount,
            'payment_method', NEW.payment_method,
            'delivery_address', NEW.delivery_address
        ),
        v_user_id
    );
END //


-- Drop obsolete triggers
DROP TRIGGER IF EXISTS tr_order_status_change_notify //
DROP TRIGGER IF EXISTS tr_shop_order_audit_update //
DROP TRIGGER IF EXISTS tr_clear_cart_on_payment //


DELIMITER ;
