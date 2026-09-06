-- NationX compatibility migration 004
-- Keep the documented sp_process_land_mutation routine compatible with the
-- trigger-authoritative ownership model and the message-only notifications
-- table. No active backend route calls this routine; it remains available for
-- DBMS demonstration and is tested only for contract safety.

DELIMITER //

DROP PROCEDURE IF EXISTS sp_process_land_mutation //
CREATE PROCEDURE sp_process_land_mutation(
    IN p_mutation_id INT,
    IN p_new_status VARCHAR(20),
    IN p_admin_notes TEXT
)
BEGIN
    DECLARE v_user_id INT DEFAULT NULL;
    DECLARE v_buyer_id INT DEFAULT NULL;
    DECLARE v_tracking_number VARCHAR(50) DEFAULT NULL;
    DECLARE v_old_status VARCHAR(20) DEFAULT NULL;
    DECLARE v_khatian_no VARCHAR(100) DEFAULT NULL;
    DECLARE v_dag_no VARCHAR(100) DEFAULT NULL;
    DECLARE v_request_id INT DEFAULT NULL;
    DECLARE v_request_count INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT user_id, buyer_id, tracking_number, status, khatian_no, dag_no
    INTO v_user_id, v_buyer_id, v_tracking_number, v_old_status,
         v_khatian_no, v_dag_no
    FROM land_mutations_v2
    WHERE id = p_mutation_id
    FOR UPDATE;

    IF v_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mutation record not found';
    END IF;

    IF p_new_status NOT IN ('Approved', 'Rejected') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unsupported mutation status';
    END IF;

    IF v_old_status <> 'Pending' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only a pending mutation can be processed';
    END IF;

    IF p_new_status = 'Rejected' THEN
        SELECT COUNT(*), MIN(id)
        INTO v_request_count, v_request_id
        FROM service_requests
        WHERE user_id = v_user_id
          AND service_type = 'Land Mutation'
          AND status = 'pending'
          AND details LIKE CONCAT('ID: ', v_tracking_number, ' -%');

        IF v_request_count <> 1 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Exactly one linked pending land service request is required';
        END IF;
    END IF;

    -- Approval invokes the ownership trigger. The procedure does not transfer
    -- or duplicate land records itself.
    UPDATE land_mutations_v2
    SET status = p_new_status
    WHERE id = p_mutation_id;

    IF p_new_status = 'Rejected' THEN
        UPDATE service_requests SET status = 'rejected' WHERE id = v_request_id;
    END IF;

    INSERT INTO notifications (user_id, type, message, is_read)
    VALUES (
        v_user_id,
        'Land Mutation',
        CONCAT(
            'Land Mutation ', p_new_status, ': Your mutation request (',
            v_tracking_number, ') was ', LOWER(p_new_status), '.',
            IF(p_admin_notes IS NULL OR p_admin_notes = '', '', CONCAT(' ', p_admin_notes))
        ),
        0
    );

    IF p_new_status = 'Approved' AND v_buyer_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, message, is_read)
        VALUES (
            v_buyer_id,
            'Land Mutation',
            CONCAT(
                'Land Transfer Received: Khatian ', v_khatian_no,
                ', Dag ', v_dag_no, ', tracking ', v_tracking_number, '.'
            ),
            0
        );
    END IF;

    INSERT INTO audit_log (
        table_name, record_id, action, old_values, new_values,
        changed_fields, user_id
    ) VALUES (
        'land_mutations_v2',
        p_mutation_id,
        'UPDATE',
        JSON_OBJECT('status', v_old_status),
        JSON_OBJECT('status', p_new_status, 'notes', p_admin_notes),
        'status',
        NULL
    );

    COMMIT;

    SELECT 'SUCCESS' AS result,
           p_mutation_id AS mutation_id,
           p_new_status AS new_status;
END //

DELIMITER ;

INSERT INTO nationx_schema_migrations (version, description)
VALUES ('004', 'Make the land procedure trigger-safe and notification-schema compatible');
