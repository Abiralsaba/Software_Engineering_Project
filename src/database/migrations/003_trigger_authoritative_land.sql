-- NationX compatibility migration 003
-- Trigger-authoritative land mutation transfer and duplicate side-effect guard.
--
-- The admin route authenticates/authorizes the admin, locks the mutation,
-- changes its status, notifies the seller, and writes route audit/action logs.
-- This trigger alone validates and transfers ownership and updates the one
-- precisely associated service request in the same transaction.

DELIMITER //

DROP TRIGGER IF EXISTS after_mutation_approval //
CREATE TRIGGER after_mutation_approval
AFTER UPDATE ON land_mutations_v2
FOR EACH ROW
BEGIN
    DECLARE v_transfer_amount DECIMAL(10,4) DEFAULT NULL;
    DECLARE v_seller_record_id INT DEFAULT NULL;
    DECLARE v_seller_record_count INT DEFAULT 0;
    DECLARE v_seller_current_size DECIMAL(10,4) DEFAULT NULL;
    DECLARE v_buyer_record_count INT DEFAULT 0;
    DECLARE v_linked_request_id INT DEFAULT NULL;
    DECLARE v_linked_request_count INT DEFAULT 0;

    IF NEW.status = 'Approved' AND NOT (OLD.status <=> NEW.status) THEN
        IF OLD.status <> 'Pending' THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Only a pending land mutation can be approved';
        END IF;

        IF NEW.buyer_id IS NULL OR NEW.buyer_id = NEW.user_id THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'A different registered buyer is required';
        END IF;

        IF NEW.land_amount IS NULL
           OR TRIM(NEW.land_amount) NOT REGEXP '^[0-9]+([.][0-9]{1,4})?$' THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Land transfer amount must be a valid positive number';
        END IF;

        SET v_transfer_amount = CAST(TRIM(NEW.land_amount) AS DECIMAL(10,4));
        IF v_transfer_amount <= 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Land transfer amount must be greater than zero';
        END IF;

        SELECT COUNT(*)
        INTO v_seller_record_count
        FROM my_land_record
        WHERE user_id = NEW.user_id
          AND khatian_no = NEW.khatian_no
          AND dag_no = NEW.dag_no
          AND status = 'Approved';

        IF v_seller_record_count <> 1 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Exactly one approved seller land record is required';
        END IF;

        SELECT id, land_size
        INTO v_seller_record_id, v_seller_current_size
        FROM my_land_record
        WHERE user_id = NEW.user_id
          AND khatian_no = NEW.khatian_no
          AND dag_no = NEW.dag_no
          AND status = 'Approved'
        LIMIT 1
        FOR UPDATE;

        IF v_seller_record_id IS NULL OR v_seller_current_size IS NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Seller land record is unavailable';
        END IF;

        IF v_transfer_amount > v_seller_current_size THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Land transfer amount exceeds current ownership';
        END IF;

        SELECT COUNT(*)
        INTO v_buyer_record_count
        FROM my_land_record
        WHERE user_id = NEW.buyer_id
          AND khatian_no = NEW.khatian_no
          AND dag_no = NEW.dag_no;

        IF v_buyer_record_count <> 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Buyer already has a matching land record';
        END IF;

        SELECT COUNT(*), MIN(id)
        INTO v_linked_request_count, v_linked_request_id
        FROM service_requests
        WHERE user_id = NEW.user_id
          AND service_type = 'Land Mutation'
          AND status = 'pending'
          AND details LIKE CONCAT('ID: ', NEW.tracking_number, ' -%');

        IF v_linked_request_count <> 1 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Exactly one linked pending land service request is required';
        END IF;

        INSERT INTO my_land_record (
            user_id, division_id, district_id, upazila_id,
            khatian_no, dag_no, mouza, land_size, deed_no, land_price,
            ownership_description, status
        ) VALUES (
            NEW.buyer_id, NEW.division_id, NEW.district_id, NEW.upazila_id,
            NEW.khatian_no, NEW.dag_no, 'Mutation Transfer', v_transfer_amount,
            IFNULL(NEW.deed_no, 'N/A'), NEW.land_price,
            CONCAT('Purchased via Mutation (Tracking: ', NEW.tracking_number, ')'),
            'Approved'
        );

        IF v_transfer_amount = v_seller_current_size THEN
            DELETE FROM my_land_record WHERE id = v_seller_record_id;
        ELSE
            UPDATE my_land_record
            SET land_size = v_seller_current_size - v_transfer_amount
            WHERE id = v_seller_record_id;
        END IF;

        UPDATE service_requests
        SET status = 'approved'
        WHERE id = v_linked_request_id;
    END IF;
END //

-- Land approval/rejection routes deliberately create their own user-facing
-- notifications. Skip only Land Mutation here to avoid a second notification.
DROP TRIGGER IF EXISTS tr_service_request_status_change //
CREATE TRIGGER tr_service_request_status_change
AFTER UPDATE ON service_requests
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status AND NEW.service_type <> 'Land Mutation' THEN
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

-- Status changes are audited by the authenticated admin route (or corrected
-- procedure). Retain trigger auditing only for non-status land data changes.
DROP TRIGGER IF EXISTS tr_land_mutation_audit_update //
CREATE TRIGGER tr_land_mutation_audit_update
AFTER UPDATE ON land_mutations_v2
FOR EACH ROW
BEGIN
    IF NOT (OLD.land_price <=> NEW.land_price)
       OR NOT (OLD.buyer_nid <=> NEW.buyer_nid)
       OR NOT (OLD.buyer_id <=> NEW.buyer_id)
       OR NOT (OLD.khatian_no <=> NEW.khatian_no)
       OR NOT (OLD.dag_no <=> NEW.dag_no)
       OR NOT (OLD.land_amount <=> NEW.land_amount) THEN
        INSERT INTO audit_log (
            table_name, record_id, action, old_values, new_values, changed_fields
        ) VALUES (
            'land_mutations_v2',
            NEW.id,
            'UPDATE',
            JSON_OBJECT(
                'land_price', OLD.land_price,
                'buyer_nid', OLD.buyer_nid,
                'buyer_id', OLD.buyer_id,
                'khatian_no', OLD.khatian_no,
                'dag_no', OLD.dag_no,
                'land_amount', OLD.land_amount
            ),
            JSON_OBJECT(
                'land_price', NEW.land_price,
                'buyer_nid', NEW.buyer_nid,
                'buyer_id', NEW.buyer_id,
                'khatian_no', NEW.khatian_no,
                'dag_no', NEW.dag_no,
                'land_amount', NEW.land_amount
            ),
            'land data'
        );
    END IF;
END //

DELIMITER ;

INSERT INTO nationx_schema_migrations (version, description)
VALUES ('003', 'Make the validated database trigger authoritative for land transfer');
