-- NationX compatibility migration 002
-- Active backend/schema contract corrections approved for the local baseline.
-- Original dump and domain SQL files remain unchanged for review and history.

-- Admin registration actively inserts nid, while schema_full.sql predates it.
ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS nid VARCHAR(50) NULL AFTER mobile;

-- The active todo endpoint accepts and returns an optional due date.
ALTER TABLE todos
    ADD COLUMN IF NOT EXISTS due_date DATETIME NULL AFTER description;

-- Both seller ownership and buyer resolution use reg_info.id. buyer_nid remains
-- as the submitted snapshot, while buyer_id is the normalized relationship.
ALTER TABLE land_mutations_v2
    ADD COLUMN IF NOT EXISTS buyer_id INT NULL AFTER buyer_nid;

SET @buyer_fk_exists = (
    SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'land_mutations_v2'
      AND CONSTRAINT_NAME = 'fk_land_mutation_buyer'
);
SET @buyer_fk_sql = IF(
    @buyer_fk_exists = 0,
    'ALTER TABLE land_mutations_v2 ADD CONSTRAINT fk_land_mutation_buyer FOREIGN KEY (buyer_id) REFERENCES reg_info(id)',
    'SELECT 1'
);
PREPARE buyer_fk_stmt FROM @buyer_fk_sql;
EXECUTE buyer_fk_stmt;
DEALLOCATE PREPARE buyer_fk_stmt;

-- Land tax records retain the required applicant_name snapshot while optionally
-- linking the registered citizen used by the active payment route.
ALTER TABLE landtax
    ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER transaction_id;

SET @landtax_user_fk_exists = (
    SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'landtax'
      AND CONSTRAINT_NAME = 'fk_landtax_user'
);
SET @landtax_user_fk_sql = IF(
    @landtax_user_fk_exists = 0,
    'ALTER TABLE landtax ADD CONSTRAINT fk_landtax_user FOREIGN KEY (user_id) REFERENCES reg_info(id)',
    'SELECT 1'
);
PREPARE landtax_user_fk_stmt FROM @landtax_user_fk_sql;
EXECUTE landtax_user_fk_stmt;
DEALLOCATE PREPARE landtax_user_fk_stmt;

-- schema_full.sql references a removed citizens table. citizen_id has no safe
-- mapping to reg_info.id, so the column remains nullable and deliberately
-- unnormalized. This removes only the invalid constraint.
SET @nid_cards_fk_exists = (
    SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'nid_cards'
      AND CONSTRAINT_NAME = 'nid_cards_ibfk_1'
);
SET @nid_cards_fk_sql = IF(
    @nid_cards_fk_exists = 1,
    'ALTER TABLE nid_cards DROP FOREIGN KEY nid_cards_ibfk_1',
    'SELECT 1'
);
PREPARE nid_cards_fk_stmt FROM @nid_cards_fk_sql;
EXECUTE nid_cards_fk_stmt;
DEALLOCATE PREPARE nid_cards_fk_stmt;

INSERT INTO nationx_schema_migrations (version, description)
VALUES ('002', 'Align active admin, todo, land, land-tax, and NID document contracts');
