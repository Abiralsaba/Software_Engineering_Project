'use strict';
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
const { rateLimit } = require('express-rate-limit');
const db = require('../config/db');
const { requirePrincipal, requireApplicant, safeError } = require('./identity');
const service = require('./applicationService');
const { NATIONX_DEMO_FIRST_TIME_NID_RULES: rules, fail, transitions } = require('./rules');
const router = express.Router();
const version = z.number().int().positive();
router.use(requirePrincipal, requireApplicant, rateLimit({ windowMs: 60000, limit: 90 }));
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.post('/', async (req, res) => res.json(await service.current(req.principal.id, true)));
router.get('/current', async (req, res) => res.json(await service.current(req.principal.id)));
router.get('/:id', async (req, res) => res.json(await service.read(req.principal.id, z.uuid().parse(req.params.id))));
router.get('/:id/status', async (req, res) => res.json(await service.read(req.principal.id, z.uuid().parse(req.params.id))));
router.patch('/:id/draft', async (req, res) => {
  const data = z.object({ version, fields: z.record(z.string(), z.unknown()), confirmed: z.literal(true) }).strict().parse(req.body);
  res.json(await service.patch(req.principal.id, req.params.id, data.version, data.fields));
});
router.post('/:id/review', async (req, res) => res.json(await service.review(req.principal.id, req.params.id, version.parse(req.body.version))));
router.post('/:id/submit', async (req, res) => {
  const data = z.object({ version, confirmation_token: z.string(), confirmed: z.literal(true) }).strict().parse(req.body);
  res.json(await service.submit(req.principal.id, req.params.id, data.version, data.confirmation_token));
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, parts: 4 } });
router.post('/:id/documents', async (req, res, next) => { await service.owned(db, req.principal.id, req.params.id); next(); }, upload.single('document'), async (req, res) => {
  const kind = z.enum(rules.documents).parse(req.body.kind);
  const docVersion = z.coerce.number().int().positive().parse(req.body.version);
  const file = req.file;
  if (!file || !['image/jpeg', 'image/png'].includes(file.mimetype)) throw fail(400, 'INVALID_DOCUMENT', 'Use a PNG or JPEG image, up to 5 MB.');
  const png = file.buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = file.buffer[0] === 255 && file.buffer[1] === 216 && file.buffer[2] === 255;
  if (!(file.mimetype === 'image/png' ? png : jpeg)) throw fail(400, 'INVALID_DOCUMENT');
  let content;
  try { content = await sharp(file.buffer, { limitInputPixels: 20000000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(); }
  catch { throw fail(400, 'INVALID_DOCUMENT'); }
  const application = await service.revise(req.principal.id, req.params.id, docVersion, async c => {
    await c.query('INSERT INTO nid_application_documents (id,application_id,kind,mime_type,content) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE content=VALUES(content),mime_type=VALUES(mime_type)', [randomUUID(), req.params.id, kind, 'image/jpeg', content]);
  });
  res.json(application);
});
router.get('/:id/documents/:documentId', async (req, res) => {
  await service.owned(db, req.principal.id, req.params.id);
  const [[file]] = await db.query('SELECT mime_type,content FROM nid_application_documents WHERE id=? AND application_id=?', [req.params.documentId, req.params.id]);
  if (!file) throw fail(404, 'DOCUMENT_NOT_FOUND');
  res.set({ 'Content-Type': file.mime_type, 'Content-Disposition': 'attachment; filename="application-document.jpg"', 'X-Content-Type-Options': 'nosniff' }).send(file.content);
});
router.delete('/:id/documents/:documentId', async (req, res) => {
  res.json(await service.revise(req.principal.id, req.params.id, version.parse(req.body.version), async c => {
    const [result] = await c.query('DELETE FROM nid_application_documents WHERE id=? AND application_id=?', [req.params.documentId, req.params.id]);
    if (!result.affectedRows) throw fail(404, 'DOCUMENT_NOT_FOUND');
  }));
});
router.use(safeError);

const adminRouter = express.Router();
adminRouter.use(require('../middleware/adminMiddleware'));
adminRouter.use(async (req, res, next) => {
  // Repository has no department-scoped admin roles. Recheck its approved-admin rule in DB.
  const [[admin]] = await db.query("SELECT id FROM admins WHERE id=? AND status='approved'", [req.admin.id]);
  if (!admin) throw fail(403, 'APPROVED_ADMIN_REQUIRED');
  res.set('Cache-Control', 'no-store'); next();
});
adminRouter.get('/', async (req, res) => {
  const page = z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page);
  const status = z.enum(Object.keys(transitions)).optional().parse(req.query.status || undefined);
  const where = status ? ' WHERE status=?' : " WHERE status<>'DRAFT'";
  const values = status ? [status] : [];
  const [[count]] = await db.query(`SELECT COUNT(*) total FROM nid_first_time_applications${where}`, values);
  const [rows] = await db.query(`SELECT id,status,tracking_number,version,submitted_at FROM nid_first_time_applications${where} ORDER BY created_at DESC,id LIMIT 20 OFFSET ?`, [...values, (page - 1) * 20]);
  res.json({ rows, total: count.total, page });
});
adminRouter.get('/:id', async (req, res) => {
  const [[row]] = await db.query('SELECT * FROM nid_first_time_applications WHERE id=?', [req.params.id]);
  if (!row) throw fail(404, 'APPLICATION_NOT_FOUND');
  res.json({ ...await service.view(db, row), allowed_statuses: transitions[row.status] || [] });
});
adminRouter.get('/:id/documents/:documentId', async (req, res) => {
  const [[file]] = await db.query('SELECT d.content,d.mime_type FROM nid_application_documents d JOIN nid_first_time_applications a ON a.id=d.application_id WHERE d.id=? AND d.application_id=? AND a.status<>\'DRAFT\'', [req.params.documentId, req.params.id]);
  if (!file) throw fail(404, 'DOCUMENT_NOT_FOUND');
  res.set({ 'Content-Type': file.mime_type, 'Content-Disposition': 'attachment; filename="application-document.jpg"', 'X-Content-Type-Options': 'nosniff' }).send(file.content);
});
adminRouter.post('/:id/status', async (req, res) => {
  const input = z.object({ status: z.enum(Object.keys(transitions)), version, remarks: z.string().trim().min(1).max(1000) }).strict().parse(req.body);
  const result = await service.transaction(async c => {
    const [[row]] = await c.query('SELECT * FROM nid_first_time_applications WHERE id=? FOR UPDATE', [req.params.id]);
    if (!row) throw fail(404, 'APPLICATION_NOT_FOUND');
    service.checkVersion(row, input.version);
    if (row.status === 'DRAFT' || !transitions[row.status]?.includes(input.status)) throw fail(409, 'INVALID_STATUS_TRANSITION');
    await c.query('UPDATE nid_first_time_applications SET status=?,version=version+1 WHERE id=?', [input.status, row.id]);
    const identity = input.status === 'APPROVED_PENDING_ISSUANCE' ? 'NID_APPROVED_PENDING_ISSUANCE' : 'NID_UNDER_REVIEW';
    await c.query('UPDATE nid_applicant_accounts SET identity_state=? WHERE id=?', [identity, row.applicant_id]);
    await c.query("INSERT INTO nid_application_status_history (application_id,from_status,to_status,actor_type,actor_id,remarks) VALUES (?,?,?,'admin',?,?)", [row.id, row.status, input.status, String(req.admin.id), input.remarks]);
    return { status: input.status, version: row.version + 1 };
  });
  res.json(result);
});
adminRouter.use(safeError);
module.exports = { router, adminRouter };
