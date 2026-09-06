// education Routes - Public API endpoints for checking exam result..

const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ==========================================
// PUBLIC ENDPOINTS - No Auth Required
// ==========================================

// GET /boards
router.get('/boards', async (req, res) => {
    try {
        const [boards] = await db.query('SELECT * FROM education_boards ORDER BY name');
        res.json(boards);
    } catch (error) {
        console.error('Error fetching boards:', error);
        res.status(500).json({ error: 'Failed to fetch education boards' });
    }
});

// check result by exam type, ..
router.get('/results/:examType/:year/:roll', async (req, res) => {
    try {
        const { examType, year, roll } = req.params;

        // Validate exam type
        const validExamTypes = ['jsc', 'ssc', 'hsc'];
        if (!validExamTypes.includes(examType.toLowerCase())) {
            return res.status(400).json({ error: 'Invalid exam type. Use: jsc, ssc, or hsc' });
        }

        const tableName = `${examType.toLowerCase()}_results`;

        // get result with board name
        const [results] = await db.query(`
            SELECT r.*, b.name as board_name, b.code as board_code
            FROM ${tableName} r
            LEFT JOIN education_boards b ON r.board_id = b.id
            WHERE r.roll_number = ? AND r.exam_year = ?
        `, [roll, year]);

        if (results.length === 0) {
            return res.status(404).json({
                error: 'Result not found',
                message: `No ${examType.toUpperCase()} result found for Roll: ${roll}, Year: ${year}`
            });
        }

        // Format response based on exam type
        const result = results[0];
        let subjects = [];

        if (examType.toLowerCase() === 'jsc') {
            subjects = [
                { name: 'বাংলা (Bangla)', grade: result.bangla },
                { name: 'ইংরেজি (English)', grade: result.english },
                { name: 'গণিত (Mathematics)', grade: result.mathematics },
                { name: 'সাধারণ বিজ্ঞান (General Science)', grade: result.general_science },
                { name: 'বাংলাদেশ ও বিশ্বপরিচয় (BGS)', grade: result.bangladesh_global_studies },
                { name: 'ধর্ম (Religion)', grade: result.religion },
                { name: 'তথ্য ও যোগাযোগ প্রযুক্তি (ICT)', grade: result.ict }
            ];
        } else if (examType.toLowerCase() === 'ssc') {
            subjects = [
                { name: 'বাংলা ১ম পত্র', grade: result.bangla_1st },
                { name: 'বাংলা ২য় পত্র', grade: result.bangla_2nd },
                { name: 'ইংরেজি ১ম পত্র', grade: result.english_1st },
                { name: 'ইংরেজি ২য় পত্র', grade: result.english_2nd },
                { name: 'গণিত (Mathematics)', grade: result.mathematics },
                { name: 'পদার্থবিজ্ঞান (Physics)', grade: result.physics },
                { name: 'রসায়ন (Chemistry)', grade: result.chemistry },
                { name: 'জীববিজ্ঞান (Biology)', grade: result.biology },
                { name: 'উচ্চতর গণিত (Higher Math)', grade: result.higher_math },
                { name: 'বাংলাদেশ ও বিশ্বপরিচয় (BGS)', grade: result.bangladesh_global_studies },
                { name: 'ধর্ম (Religion)', grade: result.religion },
                { name: 'তথ্য ও যোগাযোগ প্রযুক্তি (ICT)', grade: result.ict }
            ];
        } else if (examType.toLowerCase() === 'hsc') {
            subjects = [
                { name: 'বাংলা ১ম পত্র', grade: result.bangla_1st },
                { name: 'বাংলা ২য় পত্র', grade: result.bangla_2nd },
                { name: 'ইংরেজি ১ম পত্র', grade: result.english_1st },
                { name: 'ইংরেজি ২য় পত্র', grade: result.english_2nd },
                { name: 'পদার্থবিজ্ঞান ১ম পত্র', grade: result.physics_1st },
                { name: 'পদার্থবিজ্ঞান ২য় পত্র', grade: result.physics_2nd },
                { name: 'রসায়ন ১ম পত্র', grade: result.chemistry_1st },
                { name: 'রসায়ন ২য় পত্র', grade: result.chemistry_2nd },
                { name: 'জীববিজ্ঞান ১ম পত্র', grade: result.biology_1st },
                { name: 'জীববিজ্ঞান ২য় পত্র', grade: result.biology_2nd },
                { name: 'উচ্চতর গণিত ১ম পত্র', grade: result.higher_math_1st },
                { name: 'উচ্চতর গণিত ২য় পত্র', grade: result.higher_math_2nd },
                { name: 'তথ্য ও যোগাযোগ প্রযুক্তি (ICT)', grade: result.ict }
            ];

            // Add optional subject if exists
            if (result.optional_subject_name && result.optional_subject_grade) {
                subjects.push({
                    name: result.optional_subject_name,
                    grade: result.optional_subject_grade
                });
            }
        }

        // Filter out null grades
        subjects = subjects.filter(s => s.grade);

        res.json({
            examType: examType.toUpperCase(),
            examYear: result.exam_year,
            student: {
                name: result.student_name,
                rollNumber: result.roll_number,
                registrationNumber: result.registration_number,
                fatherName: result.father_name,
                motherName: result.mother_name,
                dateOfBirth: result.date_of_birth,
                institution: result.institution_name,
                board: result.board_name,
                group: result.exam_group || 'General'
            },
            subjects: subjects,
            result: {
                gpa: result.gpa,
                status: result.result_status
            }
        });

    } catch (error) {
        console.error('Error fetching result:', error);
        res.status(500).json({ error: 'Failed to fetch result' });
    }
});

// GET /years
router.get('/years', async (req, res) => {
    try {
        // get unique years from all result tables
        const [jscYears] = await db.query('SELECT DISTINCT exam_year FROM jsc_results ORDER BY exam_year DESC');
        const [sscYears] = await db.query('SELECT DISTINCT exam_year FROM ssc_results ORDER BY exam_year DESC');
        const [hscYears] = await db.query('SELECT DISTINCT exam_year FROM hsc_results ORDER BY exam_year DESC');

        // Combine and deduplicate
        const allYears = new Set([
            ...jscYears.map(r => r.exam_year),
            ...sscYears.map(r => r.exam_year),
            ...hscYears.map(r => r.exam_year)
        ]);

        res.json([...allYears].sort((a, b) => b - a));
    } catch (error) {
        console.error('Error fetching years:', error);
        res.status(500).json({ error: 'Failed to fetch exam years' });
    }
});

// GET /institutions/:boardId
router.get('/institutions/:boardId', async (req, res) => {
    try {
        const { boardId } = req.params;
        const [institutions] = await db.query(
            'SELECT * FROM education_institutions WHERE board_id = ? ORDER BY name',
            [boardId]
        );
        res.json(institutions);
    } catch (error) {
        console.error('Error fetching institutions:', error);
        res.status(500).json({ error: 'Failed to fetch institutions' });
    }
});

// GET /institutions
router.get('/institutions', async (req, res) => {
    try {
        const [institutions] = await db.query(
            'SELECT i.*, b.name as board_name FROM education_institutions i LEFT JOIN education_boards b ON i.board_id = b.id ORDER BY i.board_id, i.name'
        );
        res.json(institutions);
    } catch (error) {
        console.error('Error fetching institutions:', error);
        res.status(500).json({ error: 'Failed to fetch institutions' });
    }
});

module.exports = router;
