-- Trigger to handle land mutation approval
-- Fires after land mutation approval

DELIMITER //

CREATE TRIGGER after_mutation_approval
AFTER UPDATE ON land_mutations_v2
FOR EACH ROW
BEGIN
    DECLARE buyer_user_id INT;
    DECLARE seller_record_id INT;
    DECLARE seller_current_size DECIMAL(10, 2);
    
    -- Only proceed if status changed TO 'Approved'
    IF NEW.status = 'Approved' AND (OLD.status != 'Approved' OR OLD.status IS NULL) THEN
        
        -- Get buyer's user_id from buyer_id FK (3NF)
        SET buyer_user_id = NEW.buyer_id;
        
        -- Only proceed if buyer exists
        IF buyer_user_id IS NOT NULL THEN
            
            -- Check if buyer already has this land record
            IF NOT EXISTS (
                SELECT 1 FROM my_land_record 
                WHERE user_id = buyer_user_id 
                AND khatian_no = NEW.khatian_no 
                AND dag_no = NEW.dag_no
            ) THEN
                -- Add land to buyer's record (3NF — FKs only)
                INSERT INTO my_land_record 
                    (user_id, division_id, district_id, upazila_id, khatian_no, dag_no, mouza, land_size, deed_no, land_price, ownership_description, status)
                VALUES 
                    (buyer_user_id, NEW.division_id, NEW.district_id, NEW.upazila_id, NEW.khatian_no, NEW.dag_no, 'Mutation Transfer', NEW.land_amount, IFNULL(NEW.deed_no, 'N/A'), NEW.land_price, CONCAT('Purchased via Mutation (Tracking: ', NEW.tracking_number, ')'), 'Approved');
            END IF;
            
            -- Get seller's record info
            SELECT id, land_size INTO seller_record_id, seller_current_size 
            FROM my_land_record 
            WHERE user_id = NEW.user_id 
            AND khatian_no = NEW.khatian_no 
            AND dag_no = NEW.dag_no 
            LIMIT 1;
            
            -- Update or delete seller's record
            IF seller_record_id IS NOT NULL THEN
                IF NEW.land_amount >= seller_current_size - 0.0001 THEN
                    -- Full transfer
                    DELETE FROM my_land_record WHERE id = seller_record_id;
                ELSE
                    -- Partial transfer
                    UPDATE my_land_record 
                    SET land_size = seller_current_size - NEW.land_amount 
                    WHERE id = seller_record_id;
                END IF;
            END IF;
            
            -- Update linked service request
            UPDATE service_requests 
            SET status = 'approved' 
            WHERE details LIKE CONCAT('%', NEW.tracking_number, '%') 
            AND status = 'pending';
            
        END IF;
    END IF;
END//

DELIMITER ;
