#!/usr/bin/env node

'use strict';

const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const geography = require('../../src/database/seeds/data/bangladesh-administrative.json');

const allowedTargets = new Set(['central_govt_db', 'central_govt_db_test']);
const args = process.argv.slice(2);
const targetAt = args.indexOf('--target');
const target = targetAt >= 0 ? args[targetAt + 1] : process.env.DB_NAME;
const dryRun = args.includes('--dry-run');

if (!allowedTargets.has(target)) {
    console.error('Refusing seed: --target must be central_govt_db or central_govt_db_test.');
    process.exit(1);
}

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: target,
    charset: 'utf8mb4'
};

const qid = value => `\`${value.replaceAll('`', '``')}\``;

async function columnExists(connection, table, column) {
    const [[row]] = await connection.query(
        `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [target, table, column]
    );
    return Number(row.count) > 0;
}

async function ensureLocationColumns(connection) {
    const definitions = [
        ['divisions', 'name_bn', 'VARCHAR(100) NULL AFTER name'],
        ['divisions', 'geo_code', 'VARCHAR(20) NULL AFTER name_bn'],
        ['districts', 'name_bn', 'VARCHAR(100) NULL AFTER name'],
        ['districts', 'geo_code', 'VARCHAR(20) NULL AFTER name_bn'],
        ['upazilas', 'name_bn', 'VARCHAR(100) NULL AFTER name'],
        ['upazilas', 'geo_code', 'VARCHAR(20) NULL AFTER name_bn']
    ];
    for (const [table, column, definition] of definitions) {
        if (!await columnExists(connection, table, column)) {
            await connection.query(`ALTER TABLE ${qid(table)} ADD COLUMN ${qid(column)} ${definition}`);
        }
    }
}

async function findOne(connection, table, identity) {
    const columns = Object.keys(identity);
    const where = columns.map(column => `${qid(column)} <=> ?`).join(' AND ');
    const [rows] = await connection.query(
        `SELECT id FROM ${qid(table)} WHERE ${where} LIMIT 1`,
        columns.map(column => identity[column])
    );
    return rows[0]?.id || null;
}

async function ensureRow(connection, table, identity, values, update = false) {
    const existing = await findOne(connection, table, identity);
    if (existing) {
        if (update) {
            const columns = Object.keys(values);
            await connection.query(
                `UPDATE ${qid(table)} SET ${columns.map(column => `${qid(column)} = ?`).join(', ')} WHERE id = ?`,
                [...columns.map(column => values[column]), existing]
            );
        }
        return existing;
    }
    const row = { ...identity, ...values };
    const columns = Object.keys(row);
    const [result] = await connection.query(
        `INSERT INTO ${qid(table)} (${columns.map(qid).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        columns.map(column => row[column])
    );
    return result.insertId;
}

async function seedLocations(connection) {
    let districts = 0;
    let upazilas = 0;
    const ids = new Map();
    for (const division of geography.divisions) {
        let divisionId = await findOne(connection, 'divisions', { geo_code: division.code });
        if (!divisionId) divisionId = await findOne(connection, 'divisions', { name: division.name });
        if (divisionId) {
            await connection.query(
                'UPDATE divisions SET name = ?, name_bn = ?, geo_code = ? WHERE id = ?',
                [division.name, division.name_bn, division.code, divisionId]
            );
        } else {
            divisionId = await ensureRow(connection, 'divisions', { name: division.name }, {
                name_bn: division.name_bn,
                geo_code: division.code
            });
        }
        ids.set(division.code, divisionId);
        for (const district of division.districts) {
            let districtId = await findOne(connection, 'districts', { geo_code: district.code });
            if (!districtId) districtId = await findOne(connection, 'districts', { division_id: divisionId, name: district.name });
            if (districtId) {
                await connection.query(
                    'UPDATE districts SET division_id = ?, name = ?, name_bn = ?, geo_code = ? WHERE id = ?',
                    [divisionId, district.name, district.name_bn, district.code, districtId]
                );
            } else {
                districtId = await ensureRow(connection, 'districts', { division_id: divisionId, name: district.name }, {
                    name_bn: district.name_bn,
                    geo_code: district.code
                });
            }
            ids.set(district.code, districtId);
            districts += 1;
            for (const upazila of district.upazilas) {
                let upazilaId = await findOne(connection, 'upazilas', { geo_code: upazila.code });
                if (!upazilaId) upazilaId = await findOne(connection, 'upazilas', { district_id: districtId, name: upazila.name });
                if (upazilaId) {
                    await connection.query(
                        'UPDATE upazilas SET district_id = ?, name = ?, name_bn = ?, geo_code = ? WHERE id = ?',
                        [districtId, upazila.name, upazila.name_bn, upazila.code, upazilaId]
                    );
                } else {
                    upazilaId = await ensureRow(connection, 'upazilas', { district_id: districtId, name: upazila.name }, {
                        name_bn: upazila.name_bn,
                        geo_code: upazila.code
                    });
                }
                ids.set(upazila.code, upazilaId);
                upazilas += 1;
            }
        }
    }
    return { ids, divisions: geography.divisions.length, districts, upazilas };
}

const studentNames = [
    'আফরিন সুলতানা', 'মাহিন রহমান', 'তাসনিম জাহান', 'আরমান হোসেন',
    'সাদিয়া ইসলাম', 'রায়হান কবির', 'প্রিয়ন্তী দাস', 'নাবিল আহমেদ',
    'সুমাইয়া আক্তার', 'তন্ময় চক্রবর্তী', 'মেহজাবিন নূর', 'আদনান ফারুক',
    'নুসরাত তাবাসসুম', 'ফারহান জামিল', 'ঐশী সাহা', 'শাওন মিয়া',
    'মারিয়া বিনতে হক', 'জুবায়ের হাসান', 'পূজা রানী', 'ইফতেখার আলম',
    'রাইসা রহমান', 'সামিউল ইসলাম'
];
const fatherNames = ['মোস্তাফিজুর রহমান', 'আব্দুল কাদের', 'সাইফুল ইসলাম', 'জহিরুল হক', 'বিপ্লব কুমার দাস'];
const motherNames = ['রোকেয়া বেগম', 'নাজমা আক্তার', 'শাহানা পারভীন', 'সুলতানা রাজিয়া', 'মঞ্জু রানী দাস'];
const institutions = {
    DHK: 'ঢাকা মহানগর মডেল স্কুল ও কলেজ', CTG: 'চট্টগ্রাম আঞ্চলিক মডেল কলেজ',
    RAJ: 'রাজশাহী শিক্ষা নগরী মডেল কলেজ', JES: 'যশোর মডেল স্কুল ও কলেজ',
    COM: 'কুমিল্লা মডেল শিক্ষা প্রতিষ্ঠান', SYL: 'সিলেট মডেল স্কুল ও কলেজ',
    DIN: 'দিনাজপুর আঞ্চলিক মডেল কলেজ', BAR: 'বরিশাল মডেল স্কুল ও কলেজ',
    MYM: 'ময়মনসিংহ মডেল শিক্ষা প্রতিষ্ঠান', MAD: 'বাংলাদেশ মডেল দাখিল ও আলিম মাদ্রাসা',
    TEC: 'বাংলাদেশ কারিগরি মডেল ইনস্টিটিউট'
};

async function seedEducation(connection) {
    const [boards] = await connection.query('SELECT id, code FROM education_boards ORDER BY id');
    let inserted = 0;
    for (const [boardIndex, board] of boards.entries()) {
        for (let sample = 0; sample < 2; sample += 1) {
            const person = (boardIndex * 2 + sample) % studentNames.length;
            const suffix = String((boardIndex + 1) * 10 + sample + 1).padStart(3, '0');
            const common = [
                studentNames[person], fatherNames[person % fatherNames.length],
                motherNames[(person + 2) % motherNames.length], institutions[board.code] || 'আঞ্চলিক মডেল শিক্ষা প্রতিষ্ঠান',
                board.id
            ];
            const grades = sample === 0 ? ['A+', 'A+', 'A', 'A+', 'A', 'A+', 'A+'] : ['A', 'A-', 'A', 'A+', 'A-', 'A', 'A'];
            const [jsc] = await connection.query(
                `INSERT IGNORE INTO jsc_results
                 (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id,
                  bangla, english, mathematics, general_science, bangladesh_global_studies, religion, ict, gpa, result_status)
                 VALUES (?, ?, 2022, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Passed')`,
                [`71${suffix}`, `DEMO-JSC-2022-${board.code}-${suffix}`, ...common, ...grades, sample === 0 ? 4.86 : 4.43]
            );
            const science = sample === 0
                ? ['A+', 'A+', 'A+', 'A', 'A+', 'A+', 'A+', 'A', 'A+', 'A', 'A+', 'A+']
                : ['A', 'A', 'A-', 'A', 'A+', 'A', 'A-', 'A', 'A', 'A', 'A+', 'A'];
            const [ssc] = await connection.query(
                `INSERT IGNORE INTO ssc_results
                 (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group,
                  bangla_1st, bangla_2nd, english_1st, english_2nd, mathematics, physics, chemistry, biology, higher_math,
                  bangladesh_global_studies, religion, ict, gpa, result_status)
                 VALUES (?, ?, 2024, ?, ?, ?, ?, ?, 'Science', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Passed')`,
                [`81${suffix}`, `DEMO-SSC-2024-${board.code}-${suffix}`, ...common, ...science, sample === 0 ? 4.92 : 4.42]
            );
            const college = sample === 0
                ? ['A+', 'A+', 'A+', 'A', 'A+', 'A+', 'A+', 'A+', 'A', 'A+', null, null, 'A+']
                : ['A', 'A', 'A-', 'A', 'A', 'A-', 'A', 'A', null, null, 'A', 'A+', 'A'];
            const [hsc] = await connection.query(
                `INSERT IGNORE INTO hsc_results
                 (roll_number, registration_number, exam_year, student_name, father_name, mother_name, institution_name, board_id, exam_group,
                  bangla_1st, bangla_2nd, english_1st, english_2nd, physics_1st, physics_2nd, chemistry_1st, chemistry_2nd,
                  biology_1st, biology_2nd, higher_math_1st, higher_math_2nd, ict, gpa, result_status)
                 VALUES (?, ?, 2024, ?, ?, ?, ?, ?, 'Science', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Passed')`,
                [`91${suffix}`, `DEMO-HSC-2024-${board.code}-${suffix}`, ...common, ...college, sample === 0 ? 4.91 : 4.36]
            );
            inserted += jsc.affectedRows + ssc.affectedRows + hsc.affectedRows;
        }
    }
    return inserted;
}

async function seedShop(connection) {
    const items = [
        ['বাংলাদেশ নাগরিক সহায়িকা (ডেমো)', 'সেবা, অধিকার ও জরুরি যোগাযোগের পরিচিতিমূলক সংস্করণ।', 280, '/images/demo/shop/civic-handbook.png', 80],
        ['লাল-সবুজ পোলো শার্ট', 'আরামদায়ক সুতি কাপড়; কোনো সরকারি প্রতীক বা লোগো নেই।', 650, '/images/demo/shop/nationx-polo.png', 55],
        ['হস্তশিল্প পাটের ডেস্ক অর্গানাইজার', 'দেশীয় পাটে তৈরি টেকসই ডেস্ক অর্গানাইজার।', 480, '/images/demo/shop/jute-organizer.png', 45],
        ['পরিবেশবান্ধব ফাইবার মগ', 'পুনর্ব্যবহারযোগ্য বাঁশ-ফাইবার মগ, ৩৫০ মিলি।', 320, '/images/demo/shop/eco-mug.png', 70],
        ['নাগরিক নোটবুক সেট', 'দুটি হার্ডকভার নোটবুক ও একটি কলমের ডেমো সেট।', 390, '/images/demo/shop/jute-organizer.png', 60],
        ['বাংলাদেশ ভ্রমণ স্মারক বই', 'প্রাকৃতিক ও সাংস্কৃতিক ঐতিহ্যভিত্তিক ছবির ডেমো সংস্করণ।', 550, '/images/demo/shop/civic-handbook.png', 35],
        ['পাটের উপহার প্যাক', 'স্থানীয় কারিগরের তৈরি পুনর্ব্যবহারযোগ্য উপহার সামগ্রী।', 720, '/images/demo/shop/jute-organizer.png', 30],
        ['ডেস্ক মগ ও নোটবুক কম্বো', 'অফিস ও পড়াশোনার জন্য ব্যবহারিক উপহার কম্বো।', 790, '/images/demo/shop/eco-mug.png', 40],
        ['নকশিকাঁথা বুকমার্ক সেট', 'বাংলার লোকজ নকশা থেকে অনুপ্রাণিত ছয়টি পুনর্ব্যবহারযোগ্য বুকমার্ক।', 220, '/images/demo/shop/civic-handbook.png', 65],
        ['পাটের নাগরিক ফাইল ফোল্ডার', 'আবেদনপত্র ও সরকারি নথি গুছিয়ে রাখার জন্য দেশীয় পাটের ফোল্ডার।', 360, '/images/demo/shop/jute-organizer.png', 48],
        ['মাটির চা কাপ সেট', 'গ্রামীণ কারিগরের নকশায় তৈরি চারটি পুনর্ব্যবহারযোগ্য মাটির কাপ।', 460, '/images/demo/shop/eco-mug.png', 36],
        ['লাল-সবুজ ক্যানভাস ব্যাগ', 'দৈনন্দিন বাজার ও বই বহনের জন্য মজবুত পুনর্ব্যবহারযোগ্য ব্যাগ।', 520, '/images/demo/shop/nationx-polo.png', 52]
    ];
    for (const [name, description, price, image_url, stock_quantity] of items) {
        await ensureRow(connection, 'shop_items', { name }, { description, price, image_url, stock_quantity }, true);
    }
    const legacy = [
        ['Constitution of Bangladesh', '/images/demo/shop/civic-handbook.png'],
        ['Souvenir T-Shirt', '/images/demo/shop/nationx-polo.png'],
        ['Eco Mug', '/images/demo/shop/eco-mug.png'],
        ['National Flag', '/images/demo/shop/national-flag.png']
    ];
    for (const [name, image] of legacy) await connection.query('UPDATE shop_items SET image_url = ? WHERE name = ?', [image, name]);
    return items.length;
}

async function seedCommunity(connection, alice, bob) {
    const groups = [
        ['কৃষক জ্ঞান ও বাজার নেটওয়ার্ক', 'ফসল ব্যবস্থাপনা, ন্যায্যমূল্য ও কৃষি প্রশিক্ষণের তথ্য বিনিময়ের ডেমো কমিউনিটি।', '/images/demo/community/farmers-network.png', alice.id],
        ['সবুজ পাড়া স্বেচ্ছাসেবক দল', 'পরিচ্ছন্নতা, পুনর্ব্যবহার ও স্থানীয় পরিবেশ উদ্যোগের সমন্বয় প্ল্যাটফর্ম।', '/images/demo/community/green-neighbourhood.png', bob.id],
        ['নারী উদ্যোক্তা সহায়তা কেন্দ্র', 'হস্তশিল্প, ডিজিটাল বিপণন ও ক্ষুদ্র ব্যবসা শেখার অন্তর্ভুক্তিমূলক কমিউনিটি।', '/images/demo/community/women-entrepreneurs.png', alice.id],
        ['ডিজিটাল দক্ষতা শিক্ষার্থী ফোরাম', 'অনলাইন সরকারি সেবা, নিরাপদ ইন্টারনেট ও কর্মদক্ষতা শেখার ডেমো গ্রুপ।', '/images/demo/community/digital-learners.png', bob.id],
        ['নদী ও জলাশয় রক্ষা মঞ্চ', 'স্থানীয় নদী, খাল ও পুকুর পরিচ্ছন্ন রাখা এবং পানির মান পর্যবেক্ষণের নাগরিক উদ্যোগ।', '/images/demo/community/green-neighbourhood.png', alice.id],
        ['গ্রামীণ পাঠাগার ও শিক্ষা চক্র', 'শিশু-কিশোর পাঠাভ্যাস, বই বিনিময় এবং বৃত্তি ও ভর্তি তথ্য ভাগ করার কমিউনিটি।', '/images/demo/community/digital-learners.png', bob.id]
    ];
    const postTexts = [
        ['আগামী শনিবার বোরো ধানের রোগবালাই ব্যবস্থাপনা নিয়ে উন্মুক্ত আলোচনা হবে। অংশগ্রহণের আগে প্রশ্ন লিখে রাখুন।', 'আজকের বাজারদর তালিকায় ধান ও সবজির হালনাগাদ মূল্য যোগ করা হয়েছে। বিক্রির আগে স্থানীয় দর যাচাই করুন।'],
        ['শুক্রবার সকাল ৮টায় পরিচ্ছন্নতা কার্যক্রম শুরু হবে। গ্লাভস ও আলাদা বর্জ্য ব্যাগ প্রস্তুত থাকবে।', 'প্লাস্টিক, কাগজ ও জৈব বর্জ্য আলাদা করার সহজ নির্দেশিকা গ্রুপের নথিতে দেওয়া হয়েছে।'],
        ['পাটজাত পণ্যের মান নির্ধারণ ও ছবি তোলার ছোট কর্মশালা আগামী সপ্তাহে অনুষ্ঠিত হবে।', 'নতুন উদ্যোক্তাদের জন্য মূল্য নির্ধারণ, প্যাকেজিং ও অনলাইন নিরাপত্তা নিয়ে প্রশ্নোত্তর পর্ব রাখা হয়েছে।'],
        ['আগামী সেশনে অনলাইন আবেদনপত্র পূরণ, শক্তিশালী পাসওয়ার্ড এবং ফিশিং শনাক্তকরণ শেখানো হবে।', 'ল্যাপটপ না থাকলেও মোবাইল নিয়ে অংশ নেওয়া যাবে। অনুশীলনের জন্য ডেমো তথ্য ব্যবহার করুন।'],
        ['শনিবার সকালে খালের তিনটি স্থানে পানির স্বচ্ছতা ও বর্জ্যের অবস্থা পর্যবেক্ষণ করা হবে।', 'পানি দূষণের ছবি তোলার সময় ব্যক্তিগত তথ্য বা মানুষের মুখ প্রকাশ না করার অনুরোধ করা হলো।'],
        ['এই মাসের পাঠচক্রে মুক্তিযুদ্ধভিত্তিক শিশুতোষ বই পড়া ও আলোচনা হবে।', 'কলেজ ভর্তি ও বৃত্তি আবেদনের নির্ভরযোগ্য লিংকগুলো গ্রুপের নথি বিভাগে যোগ করা হয়েছে।']
    ];
    for (const [index, [name, description, cover_image, creator]] of groups.entries()) {
        const groupId = await ensureRow(connection, 'community_groups', { name }, { description, cover_image, created_by: creator, status: 'approved' }, true);
        await ensureRow(connection, 'community_members', { group_id: groupId, user_id: creator }, { role: 'admin' });
        const second = creator === alice.id ? bob.id : alice.id;
        await ensureRow(connection, 'community_members', { group_id: groupId, user_id: second }, { role: 'member' });
        for (const [postIndex, content] of postTexts[index].entries()) {
            const author = postIndex === 0 ? creator : second;
            const postId = await ensureRow(connection, 'community_posts', { group_id: groupId, content }, {
                user_id: author,
                image_url: postIndex === 0 ? cover_image : null,
                status: 'approved'
            });
            await ensureRow(connection, 'post_likes', { post_id: postId, user_id: second }, {});
            await ensureRow(connection, 'post_comments', { post_id: postId, user_id: creator, content: 'তথ্যটি উপকারী। সময়সূচি ও অংশগ্রহণের নিয়ম পরিষ্কারভাবে দেওয়ার জন্য ধন্যবাদ।' }, {});
        }
    }
    return groups.length;
}

async function seedMinistries(connection, alice, bob, locationIds) {
    const dhaka = locationIds.get('BD30');
    const dhakaDistrict = locationIds.get('BD3026');
    const savar = locationIds.get('BD30260072');
    const firstHospital = (await connection.query('SELECT id FROM health_hospitals ORDER BY id LIMIT 1'))[0][0]?.id || null;

    const nidProfile = await ensureRow(connection, 'nid_profiles', { user_id: alice.id }, {
        nid_number: alice.nid, name_bn: 'আয়েশা রহমান', name_en: 'Ayesha Rahman',
        father_name_bn: 'মোস্তাফিজুর রহমান', father_name_en: 'Mostafizur Rahman',
        mother_name_bn: 'রোকেয়া বেগম', mother_name_en: 'Rokeya Begum', date_of_birth: '1995-01-15',
        gender: 'Female', blood_group: 'B+', mobile_primary: alice.mobile, email: alice.email,
        present_division_id: dhaka, present_district_id: dhakaDistrict, present_upazila_id: savar,
        present_full_address: 'বাড়ি ১২, সড়ক ৪, মিরপুর, ঢাকা — ডেমো ঠিকানা',
        permanent_division_id: dhaka, permanent_district_id: dhakaDistrict, permanent_upazila_id: savar,
        permanent_full_address: 'সাভার, ঢাকা — ডেমো ঠিকানা', occupation: 'Teacher', occupation_bn: 'শিক্ষক',
        religion: 'Islam', nationality: 'Bangladeshi', fingerprint_registered: 1, iris_registered: 1,
        biometric_verified: 1, card_type: 'Smart', card_issued: 1, card_issue_date: '2023-02-10',
        card_expiry_date: '2033-02-09', profile_status: 'Active'
    }, true);
    await ensureRow(connection, 'nid_correction_requests', { request_no: 'NID-DEMO-2026-001' }, {
        user_id: alice.id, nid_profile_id: nidProfile, nid_number: alice.nid, correction_category: 'Present Address',
        current_value: 'পুরোনো ডেমো ঠিকানা', corrected_value: 'বাড়ি ১২, সড়ক ৪, মিরপুর, ঢাকা',
        document_description: 'ডেমো ঠিকানা প্রমাণপত্র', fee_amount: 230, fee_paid: 1,
        payment_ref: 'DEMO-NID-PAY-001', status: 'Under Review'
    });

    await ensureRow(connection, 'passport_applications', { application_number: 'DEMO-PAS-2026-001' }, {
        user_id: alice.id, service_type: 'New', passport_type: 'Ordinary', page_count: '48', validity_years: '10',
        delivery_type: 'Regular', full_name_bn: 'আয়েশা রহমান', full_name_en: 'AYESHA RAHMAN',
        father_name_bn: 'মোস্তাফিজুর রহমান', father_name_en: 'MOSTAFIZUR RAHMAN',
        mother_name_bn: 'রোকেয়া বেগম', mother_name_en: 'ROKEYA BEGUM', date_of_birth: '1995-01-15',
        gender: 'Female', religion: 'Islam', marital_status: 'Single', nationality: 'Bangladeshi',
        nid_number: alice.nid, mobile_number: alice.mobile, email: alice.email, education: 'Graduate',
        present_village_road: 'মিরপুর ডেমো সড়ক', present_post_office: 'Mirpur', present_postal_code: '1216',
        present_upazila: 'Savar', present_district: 'Dhaka', present_division: 'Dhaka', same_as_present: 1,
        permanent_village_road: 'সাভার ডেমো সড়ক', permanent_post_office: 'Savar', permanent_postal_code: '1340',
        permanent_upazila: 'Savar', permanent_district: 'Dhaka', permanent_division: 'Dhaka',
        emergency_contact_name: 'আরিফ হোসেন', emergency_contact_phone: bob.mobile, emergency_contact_relation: 'Brother',
        preferred_office: 'RPO-DHK', status: 'Under Review', fee_amount: 5750, penalty_amount: 0,
        total_fee: 5750, payment_status: 'Paid', payment_method: 'Online Banking', payment_transaction_id: 'DEMO-PAS-TXN-001',
        payment_date: '2026-09-15 10:30:00'
    });

    const healthCard = await ensureRow(connection, 'health_cards', { card_number: 'DEMO-HC-0001' }, {
        user_id: alice.id, full_name: 'আয়েশা রহমান', father_name: 'মোস্তাফিজুর রহমান', mother_name: 'রোকেয়া বেগম',
        nid_number: alice.nid, date_of_birth: '1995-01-15', gender: 'Female', blood_group: 'B+', phone: alice.mobile,
        emergency_contact: bob.mobile, division: 'ঢাকা', district: 'ঢাকা', upazila: 'সাভার',
        address: 'মিরপুর, ঢাকা — ডেমো ঠিকানা', allergies: 'কোনো পরিচিত অ্যালার্জি নেই', disability: 'None', status: 'Approved'
    });
    await ensureRow(connection, 'health_vaccinations', { certificate_number: 'DEMO-VAX-0001' }, {
        user_id: alice.id, health_card_id: healthCard, vaccine_name: 'হেপাটাইটিস বি', vaccine_type: 'Hepatitis B',
        dose_number: 1, vaccination_date: '2026-08-12', vaccination_center: 'ঢাকা মেডিকেল কলেজ হাসপাতাল',
        batch_number: 'DEMO-BATCH-01', administered_by: 'ডেমো স্বাস্থ্যকর্মী', next_dose_date: '2026-10-12', status: 'Completed'
    });
    await ensureRow(connection, 'health_appointments', { user_id: alice.id, appointment_date: '2026-10-05', department: 'Medicine' }, {
        hospital_id: firstHospital, patient_name: 'আয়েশা রহমান', patient_age: 31, patient_gender: 'Female', phone: alice.mobile,
        doctor_name: 'ডা. নাবিলা সুলতানা (ডেমো)', appointment_time: '10:30 AM', symptoms: 'নিয়মিত স্বাস্থ্য পরীক্ষা',
        urgency: 'Normal', status: 'Confirmed'
    });

    const connectionId = await ensureRow(connection, 'water_connections', { connection_number: 'DEMO-WASA-0001' }, {
        user_id: alice.id, holder_name: 'আয়েশা রহমান', nid_number: alice.nid, phone: alice.mobile,
        connection_type: 'Residential', pipe_size: '0.75 inch', division: 'Dhaka', district: 'Dhaka', upazila: 'Savar',
        address: 'মিরপুর, ঢাকা — ডেমো ঠিকানা', ward_no: '07', zone: 'Zone 4', wasa_region: 'Dhaka WASA',
        status: 'Active', monthly_rate: 320, approved_date: '2026-01-20'
    });
    for (const bill of [
        ['2026-07', 1240, 1262, 22, 396, 'Paid', 'DEMO-WATER-0726'],
        ['2026-08', 1262, 1287, 25, 450, 'Paid', 'DEMO-WATER-0826'],
        ['2026-09', 1287, 1311, 24, 432, 'Pending', null]
    ]) await ensureRow(connection, 'water_bill_payments', { connection_id: connectionId, billing_month: bill[0] }, {
        user_id: alice.id, connection_number: 'DEMO-WASA-0001', meter_reading_prev: bill[1], meter_reading_current: bill[2],
        units_consumed: bill[3], amount: bill[4], surcharge: 0, total_amount: bill[4], payment_method: 'Online',
        transaction_id: bill[6], status: bill[5], paid_date: bill[5] === 'Paid' ? `${bill[0]}-25 12:00:00` : null
    });
    await ensureRow(connection, 'water_quality_reports', { user_id: bob.id, location_details: 'রাজশাহী নগরীর ডেমো নমুনা স্থান' }, {
        source_type: 'Tube Well', division: 'Rajshahi', district: 'Rajshahi', upazila: 'Paba',
        issue_type: 'Iron Content', severity: 'Medium', description: 'পানিতে লৌহের স্বাদ ও হালকা রঙ লক্ষ্য করা গেছে।',
        affected_people: 18, sample_collected: 1, test_result: 'ডেমো নমুনা পরীক্ষাধীন', status: 'Testing'
    });

    await ensureRow(connection, 'agri_subsidies', { user_id: bob.id, bank_account: 'DEMO-AGR-0001' }, {
        farmer_name: 'আরিফ হোসেন', phone: bob.mobile, subsidy_type: 'Seeds', amount_requested: 18000,
        land_size_acres: 2.5, crop_type: 'বোরো ধান', land_ownership: 'Own', division_id: dhaka,
        district_id: dhakaDistrict, upazila_id: savar, village: 'ডেমো কৃষি গ্রাম', bank_name: 'বাংলাদেশ কৃষি ব্যাংক',
        bank_branch: 'সাভার', nid_number: bob.nid, status: 'Under Review'
    });
    await ensureRow(connection, 'agri_crop_reports', { user_id: bob.id, harvest_date: '2026-05-18', crop_name: 'বোরো ধান' }, {
        farmer_name: 'আরিফ হোসেন', crop_variety: 'ব্রি ধান-৮৯', season: 'Boro', yield_metric_ton: 7.2,
        land_area_acres: 2.5, fertilizer_used: 'সুষম সার ব্যবস্থাপনা', irrigation_method: 'Tubewell',
        market_price_per_ton: 34500, division_id: dhaka, district_id: dhakaDistrict, upazila_id: savar,
        remarks: 'ডেমো মৌসুমি উৎপাদন প্রতিবেদন'
    });
    await ensureRow(connection, 'agri_expert_queries', { user_id: bob.id, question: 'ধানের পাতায় বাদামি দাগ দেখা দিলে প্রাথমিকভাবে কী ব্যবস্থা নেওয়া উচিত?' }, {
        category: 'Pest Control', crop_name: 'ধান', answer: 'আক্রান্ত পাতা পর্যবেক্ষণ করুন, জমির পানি ও সার ব্যবস্থাপনা যাচাই করুন এবং স্থানীয় কৃষি কর্মকর্তার পরামর্শে অনুমোদিত ব্যবস্থা নিন।',
        status: 'Replied', answered_by: 'উপসহকারী কৃষি কর্মকর্তা (ডেমো)', answered_at: '2026-09-20 11:00:00'
    });
    await ensureRow(connection, 'agri_farmer_market', { user_id: bob.id, product_name: 'ব্রি ধান-৮৯' }, {
        farmer_name: 'আরিফ হোসেন', product_category: 'Rice', quantity: 35, unit: 'maund', price_per_unit: 1450,
        phone: bob.mobile, email: bob.email, division_id: dhaka, district_id: dhakaDistrict, upazila_id: savar,
        description: 'পরিষ্কার ও শুকনো ডেমো বাজার তালিকা; পরিদর্শন সাপেক্ষে।', available_from: '2026-09-20',
        available_until: '2026-11-30', status: 'Approved'
    });
    await ensureRow(connection, 'agri_training_programs', { title: 'নিরাপদ সবজি উৎপাদন ও বাজারজাতকরণ' }, {
        description: 'মাটি প্রস্তুতি, সমন্বিত বালাই ব্যবস্থাপনা, সংগ্রহোত্তর পরিচর্যা ও ন্যায্যমূল্য নিয়ে দুই দিনের ডেমো প্রশিক্ষণ।',
        category: 'Crop Management', location: 'উপজেলা কৃষি প্রশিক্ষণ কেন্দ্র, সাভার', division_id: dhaka,
        district_id: dhakaDistrict, start_date: '2026-11-12', end_date: '2026-11-13', capacity: 40,
        trainer_name: 'কৃষিবিদ সায়মা রহমান (ডেমো)', trainer_designation: 'কৃষি সম্প্রসারণ কর্মকর্তা', status: 'Upcoming'
    });

    const [[zone]] = await connection.query('SELECT id FROM nbr_tax_zones ORDER BY id LIMIT 1');
    const tinId = await ensureRow(connection, 'nbr_tin_registrations', { tin_number: '999999999001' }, {
        user_id: alice.id, taxpayer_name: 'আয়েশা রহমান', father_name: 'মোস্তাফিজুর রহমান', mother_name: 'রোকেয়া বেগম',
        date_of_birth: '1995-01-15', nid_number: alice.nid, mobile: alice.mobile, email: alice.email,
        present_address: 'মিরপুর, ঢাকা — ডেমো ঠিকানা', permanent_address: 'সাভার, ঢাকা — ডেমো ঠিকানা',
        taxpayer_type: 'Individual', source_of_income: 'চাকরি', zone_id: zone?.id || null, circle: 'ডেমো সার্কেল-১',
        status: 'Approved', remarks: 'শুধু স্থানীয় প্রদর্শনের জন্য', approved_at: '2026-07-01 10:00:00'
    });
    const returnId = await ensureRow(connection, 'nbr_tax_returns', { submission_ref: 'DEMO-RETURN-2026-001' }, {
        user_id: alice.id, tin_id: tinId, assessment_year: '2026-2027', income_year: '2025-2026', return_type: 'Normal',
        salary_income: 720000, total_income: 720000, taxable_income: 370000, tax_on_income: 8500, tax_rebate: 1500,
        net_tax_liability: 7000, tax_paid_advance: 7000, tax_due: 0, total_assets: 1450000, total_liabilities: 150000,
        net_wealth: 1300000, total_expenditure: 420000, status: 'Accepted', admin_remarks: 'ডেমো রিটার্ন'
    });
    await ensureRow(connection, 'nbr_tax_payments', { receipt_no: 'DEMO-TAX-RCP-001' }, {
        user_id: alice.id, return_id: returnId, tin_id: tinId, payment_type: 'Income Tax', amount: 7000,
        payment_method: 'Online', bank_name: 'ডেমো ব্যাংক', branch_name: 'ডিজিটাল শাখা',
        transaction_id: 'DEMO-TAX-TXN-001', payment_date: '2026-08-10', fiscal_year: '2025-2026', status: 'Verified'
    });

    await ensureRow(connection, 'land_mutations_v2', { tracking_number: 'DEMO-LAND-2026-001' }, {
        user_id: alice.id, division_id: dhaka, district_id: dhakaDistrict, upazila_id: savar,
        applicant_name: 'আয়েশা রহমান', applicant_father: 'মোস্তাফিজুর রহমান', applicant_mother: 'রোকেয়া বেগম',
        applicant_nid: alice.nid, khatian_no: 'DEMO-KH-204', dag_no: 'DEMO-DAG-781', land_amount: '5.50',
        land_price: 850000, deed_no: 'DEMO-DEED-2026-44', ownership_type: 'Own', buyer_name: 'আরিফ হোসেন',
        buyer_father_name: 'সাইফুল ইসলাম', buyer_mother_name: 'নাজমা আক্তার', buyer_nid: bob.nid,
        buyer_id: bob.id, status: 'Pending'
    });
}

async function seedNoticesAndMarkets(connection) {
    const markets = [
        ['Coarse Rice', 'মোটা চাল', 'Rice', 'kg', 55], ['Fine Lentil', 'ভালো মানের মসুর ডাল', 'Grains', 'kg', 145],
        ['Bottle Gourd', 'লাউ', 'Vegetables', 'piece', 65], ['Eggplant', 'বেগুন', 'Vegetables', 'kg', 70],
        ['Papaya', 'পেঁপে', 'Fruits', 'kg', 55], ['Pangas Fish', 'পাঙ্গাশ মাছ', 'Fish', 'kg', 220],
        ['Liquid Milk', 'তরল দুধ', 'Dairy', 'litre', 95], ['Red Chili Powder', 'মরিচ গুঁড়া', 'Spices', 'kg', 520],
        ['Medium Rice', 'মাঝারি চাল', 'Rice', 'kg', 68], ['Soybean Oil', 'সয়াবিন তেল', 'Oil', 'litre', 175],
        ['Potato', 'আলু', 'Vegetables', 'kg', 42], ['Onion', 'পেঁয়াজ', 'Vegetables', 'kg', 75],
        ['Rohu Fish', 'রুই মাছ', 'Fish', 'kg', 360], ['Broiler Chicken', 'ব্রয়লার মুরগি', 'Meat', 'kg', 195],
        ['Banana', 'কলা', 'Fruits', 'dozen', 110], ['Turmeric Powder', 'হলুদ গুঁড়া', 'Spices', 'kg', 390]
    ];
    for (const [item_name, item_name_bn, category, unit, price] of markets) {
        await ensureRow(connection, 'market_prices', { item_name, effective_date: '2026-09-25' }, { item_name_bn, category, unit, price });
    }
    const notices = [
        ['স্বাস্থ্যসেবা অ্যাপয়েন্টমেন্টের ডেমো সময়সূচি', 'স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়', 'General'],
        ['কৃষি প্রশিক্ষণে নিবন্ধনের বিজ্ঞপ্তি', 'কৃষি মন্ত্রণালয়', 'Circular'],
        ['পানি সংযোগ আবেদন যাচাই নির্দেশনা', 'পানি সম্পদ মন্ত্রণালয়', 'General'],
        ['অনলাইন কর রিটার্ন সহায়তা সপ্তাহ', 'জাতীয় রাজস্ব বোর্ড', 'Circular'],
        ['স্মার্ট জাতীয় পরিচয়পত্র তথ্য হালনাগাদ নির্দেশিকা', 'নির্বাচন কমিশন', 'General'],
        ['ই-পাসপোর্ট আবেদনকারীদের নথি যাচাই ক্যাম্প', 'ইমিগ্রেশন ও পাসপোর্ট অধিদপ্তর', 'Circular'],
        ['বিশ্ববিদ্যালয় ভর্তি সহায়তা কেন্দ্রের সময়সূচি', 'শিক্ষা মন্ত্রণালয়', 'General'],
        ['স্থানীয় হস্তশিল্প মেলার অংশগ্রহণ আহ্বান', 'শিল্প মন্ত্রণালয়', 'Tender']
    ];
    for (const [index, [title_bn, department, category]] of notices.entries()) {
        await ensureRow(connection, 'govt_notices', { reference_no: `DEMO-NOTICE-2026-${String(index + 1).padStart(2, '0')}` }, {
            title: `Demo public notice ${index + 1}`, title_bn, department, category, priority: index === 1 || index === 5 ? 'High' : 'Medium',
            content: 'এটি NationX স্থানীয় প্রদর্শনের জন্য তৈরি নমুনা বিজ্ঞপ্তি। কোনো বাস্তব সরকারি নির্দেশনা নয়।',
            publish_date: '2026-09-20', expiry_date: '2026-12-31', status: 'Published'
        });
    }
}

async function counts(connection) {
    const tables = ['divisions', 'districts', 'upazilas', 'jsc_results', 'ssc_results', 'hsc_results', 'shop_items', 'community_groups', 'community_posts', 'market_prices', 'govt_notices'];
    const result = {};
    for (const table of tables) {
        const [[row]] = await connection.query(`SELECT COUNT(*) AS count FROM ${qid(table)}`);
        result[table] = Number(row.count);
    }
    return result;
}

async function main() {
    const connection = await mysql.createConnection(config);
    let lock = false;
    try {
        const [[lockRow]] = await connection.query("SELECT GET_LOCK('nationx_professional_demo_seed', 10) AS acquired");
        lock = Number(lockRow.acquired) === 1;
        if (!lock) throw new Error('Another demo seed is already running.');
        const before = await counts(connection);
        if (dryRun) {
            console.log(JSON.stringify({ target, dry_run: true, current: before, planned: { divisions: 8, districts: 64, upazilas: 495, education_rows: 66, shop_items: 12, community_groups: 6, market_prices: 16, govt_notices: 8 } }, null, 2));
            return;
        }
        await ensureLocationColumns(connection);
        const [[alice], [bob]] = await Promise.all([
            connection.query("SELECT id,name,nid,mobile,email FROM reg_info WHERE email='alice.demo@nationx.test'").then(([rows]) => rows),
            connection.query("SELECT id,name,nid,mobile,email FROM reg_info WHERE email='bob.demo@nationx.test'").then(([rows]) => rows)
        ]);
        if (!alice || !bob) throw new Error('Synthetic citizens are missing. Run the reviewed database installer first.');

        await connection.beginTransaction();
        try {
            await connection.query("UPDATE reg_info SET name='আয়েশা রহমান (ডেমো)', address='বাড়ি ১২, সড়ক ৪, মিরপুর, ঢাকা — ডেমো ঠিকানা' WHERE id=?", [alice.id]);
            await connection.query("UPDATE reg_info SET name='আরিফ হোসেন (ডেমো)', address='বাড়ি ৮, কলেজ রোড, রাজশাহী — ডেমো ঠিকানা' WHERE id=?", [bob.id]);
            await connection.query('UPDATE user_info u JOIN reg_info r ON r.id=u.user_id SET u.name=r.name,u.address=r.address WHERE r.id IN (?,?)', [alice.id, bob.id]);
            alice.name = 'আয়েশা রহমান (ডেমো)'; bob.name = 'আরিফ হোসেন (ডেমো)';
            const locations = await seedLocations(connection);
            const educationRows = await seedEducation(connection);
            const shopItems = await seedShop(connection);
            const groups = await seedCommunity(connection, alice, bob);
            await seedMinistries(connection, alice, bob, locations.ids);
            await seedNoticesAndMarkets(connection);
            await connection.commit();
            const after = await counts(connection);
            console.log(JSON.stringify({ target, source: geography.attribution, locations: { divisions: locations.divisions, districts: locations.districts, upazilas: locations.upazilas }, education_rows_added: educationRows, shop_catalogue_seeded: shopItems, community_groups_seeded: groups, before, after }, null, 2));
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } finally {
        if (lock) await connection.query("DO RELEASE_LOCK('nationx_professional_demo_seed')");
        await connection.end();
    }
}

main().catch(error => {
    console.error(`Demo seed failed: ${error.message}`);
    process.exit(1);
});
