'use strict';

const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const defaultDb = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const { MAX_IMAGE_BYTES, processImage } = require('../services/medicineIdentifier/imageProcessor');
const { CONSENT_TEXT, configuredProvider } = require('../services/medicineIdentifier/provider');
const catalogue = require('../services/medicineIdentifier/catalogue');
const { requiredQuantity } = require('../services/medicineIdentifier/savings');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 3, fields: 10 } });
const scanIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const correctionSchema = z.object({
    brand_name_candidate: z.string().trim().max(255).nullable().optional(),
    generic_name_candidate: z.string().trim().max(255).nullable().optional(),
    strength_text: z.string().trim().max(255).nullable().optional(),
    dosage_form: z.string().trim().max(150).nullable().optional(),
    manufacturer_candidate: z.string().trim().max(255).nullable().optional(),
    registration_reference_candidate: z.string().trim().max(100).nullable().optional(),
    dose_amount: z.number().finite().positive().nullable().optional(),
    dose_unit: z.string().trim().max(50).nullable().optional(),
    frequency_per_day: z.number().finite().positive().nullable().optional(),
    duration_days: z.number().finite().positive().nullable().optional(),
    total_quantity: z.number().finite().positive().nullable().optional()
}).strict();

function json(value, fallback = null) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return fallback; }
}

function packageAsItem(extraction) {
    return extraction;
}

function extractionItems(mode, extraction) {
    return mode === 'prescription' ? extraction.medicine_items : [packageAsItem(extraction)];
}

function itemColumns(item) {
    return [item.brand_name_candidate || null, item.generic_name_candidate || null, item.strength_text || null,
        item.dosage_form || null, item.manufacturer_candidate || null, item.registration_reference_candidate || null];
}

async function ownedSession(db, scanId, userId) {
    if (!scanIdPattern.test(scanId)) throw Object.assign(new Error('Invalid scan ID.'), { status: 400 });
    const [rows] = await db.query('SELECT * FROM medicine_scan_sessions WHERE scan_id=? LIMIT 1', [scanId]);
    if (!rows.length) throw Object.assign(new Error('Scan not found.'), { status: 404 });
    if (Number(rows[0].user_id) !== Number(userId)) throw Object.assign(new Error('This scan belongs to another citizen.'), { status: 403 });
    return rows[0];
}

function sendError(error, res) {
    const status = error.status || (error instanceof multer.MulterError ? 400 : 500);
    if (status >= 500 && !String(error.code || '').startsWith('PROVIDER_') && error.code !== 'INVALID_PROVIDER_OUTPUT') {
        console.error('Medicine scan request failed:', error.message);
    }
    const message = status >= 500 && !error.code ? 'Medicine scan request failed.' : error.message;
    res.status(status).json({ error: message, code: error.code || undefined });
}

function uploadImages(req, res, next) {
    upload.array('images', 3)(req, res, error => {
        if (error) {
            (req.files || []).forEach(file => file.buffer?.fill(0));
            return sendError(error, res);
        }
        next();
    });
}

function createMedicineScanRouter(options = {}) {
    const db = options.db || defaultDb;
    const provider = options.provider || configuredProvider();
    const router = express.Router();
    router.use(verifyToken);
    const scanLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, max: options.scanLimit || Number(process.env.MEDICINE_SCAN_RATE_LIMIT || 10),
        standardHeaders: true, legacyHeaders: false,
        keyGenerator: req => `citizen-${req.user.id}`,
        message: { error: 'Too many Medicine Identifier requests. Please try again later.' }
    });

    router.post('/', scanLimiter, uploadImages, async (req, res) => {
        const processed = [];
        try {
            const mode = req.body?.mode;
            if (!['prescription', 'package'].includes(mode)) return res.status(400).json({ error: 'Mode must be prescription or package.' });
            if (req.body?.consent !== 'true') return res.status(400).json({ error: 'Consent is required before image extraction.' });
            const files = req.files || [];
            const maximum = mode === 'prescription' ? 3 : 2;
            if (!files.length || files.length > maximum) return res.status(400).json({ error: `Upload between one and ${maximum} image(s) for this mode.` });
            for (const file of files) processed.push(await processImage(file));

            const providerResult = await provider.extract(mode, processed);
            const items = extractionItems(mode, providerResult.extraction);
            const candidateSets = [];
            const retake = mode === 'prescription' && providerResult.extraction.needs_retake;
            if (!retake) {
                for (const item of items) candidateSets.push(await catalogue.matchExtracted(item, db));
            }
            const scanId = crypto.randomUUID();
            const status = retake ? 'RETAKE_REQUIRED' : 'WAITING_CONFIRMATION';
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                await connection.query(`INSERT INTO medicine_scan_sessions
                    (scan_id,user_id,scan_mode,status,provider_name,model_name,schema_version,image_count,image_hashes,image_metadata,consented_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`, [scanId, req.user.id, mode, status, providerResult.provider,
                    providerResult.model, providerResult.schemaVersion, processed.length,
                    JSON.stringify(processed.map(image => image.hash)), JSON.stringify(processed.map(image => image.metadata))]);
                for (let index = 0; index < items.length; index += 1) {
                    const item = items[index];
                    const itemId = crypto.randomUUID();
                    await connection.query(`INSERT INTO medicine_scan_items
                        (item_id,scan_id,item_index,raw_visible_text,structured_extraction,user_corrections,brand_candidate,generic_candidate,
                         strength_candidate,dosage_form_candidate,manufacturer_candidate,registration_candidate,uncertain_fields)
                        VALUES (?,?,?,?,?,NULL,?,?,?,?,?,?,?)`, [itemId, scanId, index, item.raw_visible_text || '', JSON.stringify(item),
                        ...itemColumns(item), JSON.stringify(item.uncertain_fields || [])]);
                    for (const candidate of candidateSets[index] || []) {
                        await connection.query(`INSERT INTO medicine_scan_candidates
                            (candidate_id,item_id,medicine_id,candidate_rank,match_score,matching_evidence,conflicts_or_missing)
                            VALUES (?,?,?,?,?,?,?)`, [crypto.randomUUID(), itemId, candidate.medicine.medicine_id, candidate.rank,
                            candidate.score, JSON.stringify(candidate.evidence), JSON.stringify(candidate.conflicts_or_missing)]);
                    }
                }
                await connection.commit();
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally { connection.release(); }
            res.status(201).json(await scanDetail(db, scanId, req.user.id));
        } catch (error) { sendError(error, res); }
        finally {
            (req.files || []).forEach(file => file.buffer?.fill(0));
            processed.forEach(image => image.buffer?.fill(0));
        }
    });

    router.get('/', async (req, res) => {
        try {
            const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
            const [rows] = await db.query(`SELECT scan_id,scan_mode,status,provider_name,model_name,image_count,created_at,updated_at
                FROM medicine_scan_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT ?`, [req.user.id, limit]);
            res.json({ scans: rows });
        } catch (error) { sendError(error, res); }
    });

    router.get('/:scanId', async (req, res) => {
        try { res.json(await scanDetail(db, req.params.scanId, req.user.id)); } catch (error) { sendError(error, res); }
    });

    router.post('/:scanId/items/:itemId/confirm', async (req, res) => {
        try {
            const session = await ownedSession(db, req.params.scanId, req.user.id);
            const [items] = await db.query('SELECT * FROM medicine_scan_items WHERE item_id=? AND scan_id=? LIMIT 1', [req.params.itemId, session.scan_id]);
            if (!items.length) return res.status(404).json({ error: 'Scan item not found.' });
            const selectionType = String(req.body.selection_type || '').toUpperCase();
            if (!['CATALOGUE', 'NONE', 'MANUAL'].includes(selectionType)) return res.status(400).json({ error: 'Choose a catalogue medicine, none, or manual entry.' });
            const corrections = correctionSchema.parse(req.body.corrections || {});
            let medicineId = null;
            let manualLabel = null;
            if (selectionType === 'CATALOGUE') {
                medicineId = req.body.medicine_id;
                const medicine = await catalogue.medicineById(medicineId, db);
                if (!medicine) return res.status(400).json({ error: 'Select an identification-eligible Tier A/B catalogue medicine.' });
            } else if (selectionType === 'MANUAL') {
                manualLabel = String(req.body.manual_label || '').trim().slice(0, 500);
                if (!manualLabel) return res.status(400).json({ error: 'Manual medicine text is required.' });
            }
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                await connection.query('UPDATE medicine_scan_items SET user_corrections=? WHERE item_id=?', [JSON.stringify(corrections), req.params.itemId]);
                await connection.query(`INSERT INTO medicine_scan_confirmations
                    (confirmation_id,item_id,selection_type,medicine_id,manual_label,user_corrections)
                    VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE selection_type=VALUES(selection_type),medicine_id=VALUES(medicine_id),
                    manual_label=VALUES(manual_label),user_corrections=VALUES(user_corrections),confirmed_at=CURRENT_TIMESTAMP`,
                [crypto.randomUUID(), req.params.itemId, selectionType, medicineId, manualLabel, JSON.stringify(corrections)]);
                const [[progress]] = await connection.query(`SELECT COUNT(*) AS item_count,COUNT(c.confirmation_id) AS confirmed_count,
                    SUM(c.selection_type='CATALOGUE') AS catalogue_count FROM medicine_scan_items i
                    LEFT JOIN medicine_scan_confirmations c ON c.item_id=i.item_id WHERE i.scan_id=?`, [session.scan_id]);
                const nextStatus = Number(progress.confirmed_count) < Number(progress.item_count)
                    ? 'WAITING_CONFIRMATION' : (Number(progress.catalogue_count) > 0 ? 'CONFIRMED' : 'NO_MATCH');
                await connection.query('UPDATE medicine_scan_sessions SET status=? WHERE scan_id=?', [nextStatus, session.scan_id]);
                await connection.commit();
            } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
            res.json(await scanDetail(db, session.scan_id, req.user.id));
        } catch (error) {
            if (error?.name === 'ZodError') return res.status(400).json({ error: 'Corrections contain invalid fields or values.' });
            sendError(error, res);
        }
    });

    router.get('/:scanId/items/:itemId/alternatives', async (req, res) => {
        try {
            const session = await ownedSession(db, req.params.scanId, req.user.id);
            const [rows] = await db.query(`SELECT i.structured_extraction,i.user_corrections,c.medicine_id,c.selection_type
                FROM medicine_scan_items i LEFT JOIN medicine_scan_confirmations c ON c.item_id=i.item_id
                WHERE i.item_id=? AND i.scan_id=? LIMIT 1`, [req.params.itemId, session.scan_id]);
            if (!rows.length) return res.status(404).json({ error: 'Scan item not found.' });
            if (rows[0].selection_type !== 'CATALOGUE' || !rows[0].medicine_id) return res.status(409).json({ error: 'Confirm a catalogue medicine before viewing possible alternatives.' });
            const extracted = json(rows[0].structured_extraction, {});
            const corrections = json(rows[0].user_corrections, {});
            const combined = { ...extracted, ...corrections };
            const quantity = req.query.quantity || requiredQuantity({
                doseAmount: combined.dose_amount, frequencyPerDay: combined.frequency_per_day,
                durationDays: combined.duration_days, totalQuantity: combined.total_quantity,
                dosageForm: combined.dosage_form, doseUnit: combined.dose_unit
            });
            const result = await catalogue.alternatives(rows[0].medicine_id, quantity, db);
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                await connection.query('DELETE FROM medicine_savings_estimates WHERE item_id=?', [req.params.itemId]);
                for (const alternative of result.alternatives) {
                    await connection.query(`INSERT INTO medicine_savings_estimates
                        (savings_estimate_id,item_id,original_medicine_id,alternative_medicine_id,required_quantity,
                         original_package_selection,alternative_package_selection,original_estimated_cost,alternative_estimated_cost,
                         estimated_saving,currency,comparison_evidence) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [crypto.randomUUID(), req.params.itemId, rows[0].medicine_id, alternative.medicine.medicine_id, quantity,
                        result.original_purchase_estimate ? JSON.stringify(result.original_purchase_estimate.selected_packages) : null,
                        alternative.purchase_estimate ? JSON.stringify(alternative.purchase_estimate.selected_packages) : null,
                        result.original_purchase_estimate?.estimated_cost || null, alternative.purchase_estimate?.estimated_cost || null,
                        alternative.estimated_saving, alternative.purchase_estimate?.currency || alternative.package_comparison?.currency || null,
                        JSON.stringify(alternative.matching_specifications)]);
                }
                await connection.commit();
            } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
            res.json(result);
        } catch (error) { sendError(error, res); }
    });

    router.delete('/:scanId', async (req, res) => {
        try {
            const session = await ownedSession(db, req.params.scanId, req.user.id);
            await db.query('DELETE FROM medicine_scan_sessions WHERE scan_id=? AND user_id=?', [session.scan_id, req.user.id]);
            res.json({ success: true, message: 'Scan history deleted.' });
        } catch (error) { sendError(error, res); }
    });
    return router;
}

async function scanDetail(db, scanId, userId) {
    const session = await ownedSession(db, scanId, userId);
    const [items] = await db.query('SELECT * FROM medicine_scan_items WHERE scan_id=? ORDER BY item_index', [scanId]);
    for (const item of items) {
        item.structured_extraction = json(item.structured_extraction, {});
        item.user_corrections = json(item.user_corrections, null);
        item.uncertain_fields = json(item.uncertain_fields, []);
        const [candidates] = await db.query(`SELECT candidate_id,medicine_id,candidate_rank,match_score,matching_evidence,conflicts_or_missing
            FROM medicine_scan_candidates WHERE item_id=? ORDER BY candidate_rank LIMIT 5`, [item.item_id]);
        item.candidates = [];
        for (const candidate of candidates) {
            const medicine = await catalogue.medicineById(candidate.medicine_id, db);
            if (medicine) item.candidates.push({ ...candidate, matching_evidence: json(candidate.matching_evidence, []),
                conflicts_or_missing: json(candidate.conflicts_or_missing, []), medicine: medicine.detail });
        }
        const [confirmations] = await db.query(`SELECT selection_type,medicine_id,manual_label,user_corrections,confirmed_at
            FROM medicine_scan_confirmations WHERE item_id=? LIMIT 1`, [item.item_id]);
        item.confirmation = confirmations[0] ? { ...confirmations[0], user_corrections: json(confirmations[0].user_corrections, {}) } : null;
    }
    return {
        scan_id: session.scan_id, scan_mode: session.scan_mode, status: session.status,
        provider_name: session.provider_name, model_name: session.model_name, schema_version: session.schema_version,
        image_count: session.image_count, consent_text: CONSENT_TEXT, created_at: session.created_at, updated_at: session.updated_at,
        extraction_summary: session.status === 'RETAKE_REQUIRED' && items[0] ? items[0].structured_extraction : null,
        items
    };
}

const router = createMedicineScanRouter();
router.createMedicineScanRouter = createMedicineScanRouter;
router.scanDetail = scanDetail;
module.exports = router;
