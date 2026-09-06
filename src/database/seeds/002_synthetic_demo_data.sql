-- Synthetic local-only demonstration data.
-- Geographic names are deliberately and visibly labelled DEMO DATA.

INSERT INTO divisions (name)
SELECT 'DEMO DATA — Test Division'
WHERE NOT EXISTS (
    SELECT 1 FROM divisions WHERE name = 'DEMO DATA — Test Division'
);

INSERT INTO districts (division_id, name)
SELECT d.id, 'DEMO DATA — Test District'
FROM divisions d
WHERE d.name = 'DEMO DATA — Test Division'
  AND NOT EXISTS (
      SELECT 1 FROM districts x
      WHERE x.division_id = d.id AND x.name = 'DEMO DATA — Test District'
  );

INSERT INTO upazilas (district_id, name)
SELECT d.id, 'DEMO DATA — Test Upazila'
FROM districts d
JOIN divisions v ON v.id = d.division_id
WHERE v.name = 'DEMO DATA — Test Division'
  AND d.name = 'DEMO DATA — Test District'
  AND NOT EXISTS (
      SELECT 1 FROM upazilas x
      WHERE x.district_id = d.id AND x.name = 'DEMO DATA — Test Upazila'
  );

-- citizen_id intentionally stays NULL. The invalid FK to the removed citizens
-- table is not remapped; document lookup continues through the NID snapshot.
INSERT INTO nid_cards (
    citizen_id, nid_number, issue_date, expiry_date, smart_card_status
)
SELECT NULL, r.nid, '2026-01-01', '2036-01-01', 1
FROM reg_info r
WHERE r.email = 'alice.demo@nationx.test'
  AND NOT EXISTS (SELECT 1 FROM nid_cards n WHERE n.nid_number = r.nid);

INSERT INTO my_land_record (
    user_id, owner_name, nid, khatian_no, dag_no, mouza, land_size,
    ownership_description, status, division_id, district_id, upazila_id,
    deed_no, land_price
)
SELECT
    r.id,
    r.name,
    r.nid,
    'DEMO-BASE-KHATIAN',
    'DEMO-BASE-DAG',
    'DEMO DATA — Test Mouza',
    100.0000,
    'DEMO DATA — Synthetic baseline parcel',
    'Approved',
    v.id,
    d.id,
    u.id,
    'DEMO-BASE-DEED',
    100000.00
FROM reg_info r
JOIN divisions v ON v.name = 'DEMO DATA — Test Division'
JOIN districts d ON d.division_id = v.id AND d.name = 'DEMO DATA — Test District'
JOIN upazilas u ON u.district_id = d.id AND u.name = 'DEMO DATA — Test Upazila'
WHERE r.email = 'alice.demo@nationx.test'
  AND NOT EXISTS (
      SELECT 1 FROM my_land_record l
      WHERE l.user_id = r.id
        AND l.khatian_no = 'DEMO-BASE-KHATIAN'
        AND l.dag_no = 'DEMO-BASE-DAG'
  );
