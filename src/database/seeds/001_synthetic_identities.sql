-- Synthetic local-only NationX identities.
-- The installer replaces hash placeholders in memory. No database credentials
-- or plaintext passwords are stored in SQL or sent to the frontend.

INSERT INTO admins (name, email, password, mobile, nid, status)
VALUES (
    'Synthetic NationX Administrator',
    'admin.demo@nationx.test',
    '__SYNTHETIC_ADMIN_PASSWORD_HASH__',
    '01990000000',
    '99900000000000099',
    'approved'
);

INSERT INTO reg_info (name, address, nid, mobile, email, password, dob, gender)
VALUES
(
    'Synthetic Citizen Alice',
    'DEMO DATA — Test Address A',
    '99900000000000001',
    '01990000001',
    'alice.demo@nationx.test',
    '__SYNTHETIC_CITIZEN_PASSWORD_HASH__',
    '1995-01-15',
    'Female'
),
(
    'Synthetic Citizen Bob',
    'DEMO DATA — Test Address B',
    '99900000000000002',
    '01990000002',
    'bob.demo@nationx.test',
    '__SYNTHETIC_CITIZEN_PASSWORD_HASH__',
    '1993-07-20',
    'Male'
);

INSERT INTO user_info (user_id, name, email, nid, mobile, dob, address, gender)
SELECT id, name, email, nid, mobile, dob, address, gender
FROM reg_info
WHERE email IN ('alice.demo@nationx.test', 'bob.demo@nationx.test');
