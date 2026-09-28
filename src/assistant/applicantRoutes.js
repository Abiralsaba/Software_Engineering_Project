'use strict';
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomUUID, randomInt, createHash } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const db = require('../config/db');
const { registrationSchema, fail } = require('./rules');
const { requirePrincipal, requireApplicant, APPLICANT_AUDIENCE, safeError } = require('./identity');
const router = express.Router();
const hash = value => createHash('sha256').update(value).digest('hex');
function requireLocalDemo(req) {
  if (process.env.NODE_ENV === 'production' || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) throw fail(503, 'CONTACT_DELIVERY_NOT_CONFIGURED', 'Applicant contact checking currently supports the local demonstration only.');
}
router.use(rateLimit({ windowMs: 15 * 60000, limit: 40 }));
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
function session(account) {
  if (!process.env.JWT_SECRET) throw fail(503, 'AUTH_NOT_CONFIGURED');
  return { token: jwt.sign({ principal_type: 'NID_APPLICANT' }, process.env.JWT_SECRET, { subject: account.id, audience: APPLICANT_AUDIENCE, expiresIn: '1h' }), user: { id: account.id, name: account.name, accountType: 'NID_APPLICANT' } };
}
const locationRows = level => async (req, res, next) => {
  try {
    const parent = z.coerce.number().int().positive().optional().parse(req.params.parentId);
    const queries = {
      divisions: ['SELECT id,name,name_bn,geo_code FROM divisions ORDER BY name', []],
      districts: ['SELECT id,division_id,name,name_bn,geo_code FROM districts WHERE division_id=? ORDER BY name', [parent]],
      upazilas: ['SELECT id,district_id,name,name_bn,geo_code FROM upazilas WHERE district_id=? ORDER BY name', [parent]]
    };
    const [rows] = await db.query(...queries[level]);
    res.json(rows);
  } catch (error) { next(error); }
};
router.get('/locations/divisions', locationRows('divisions'));
router.get('/locations/districts/:parentId', locationRows('districts'));
router.get('/locations/upazilas/:parentId', locationRows('upazilas'));

async function validateLocation(c, profile, prefix) {
  const [[match]] = await c.query(
    `SELECT u.id FROM upazilas u
     JOIN districts d ON d.id=u.district_id
     WHERE u.id=? AND d.id=? AND d.division_id=? LIMIT 1`,
    [profile[`${prefix}_upazila_id`], profile[`${prefix}_district_id`], profile[`${prefix}_division_id`]]
  );
  if (!match) throw fail(400, 'INVALID_LOCATION', `Choose a valid ${prefix} division, district, and upazila.`);
}
router.post('/register', async (req, res) => {
  // Deliberately local demonstration contact check; not real email verification.
  requireLocalDemo(req);
  const data = registrationSchema.parse(req.body);
  const email = data.email.toLowerCase();
  const [[existingCitizen]] = await db.query('SELECT id FROM reg_info WHERE email=? LIMIT 1', [email]);
  if (existingCitizen) throw fail(409, 'ACCOUNT_EXISTS', 'Use your existing citizen login.');
  const id = randomUUID(); const code = String(randomInt(100000, 1000000)); const applicationId = data.profile ? randomUUID() : null;
  const passwordHash = await bcrypt.hash(data.password, 10);
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    const [[existingApplicant]] = await c.query('SELECT id FROM nid_applicant_accounts WHERE email=? LIMIT 1 FOR UPDATE', [email]);
    if (existingApplicant) throw fail(409, 'ACCOUNT_EXISTS', 'An applicant account already uses this email.');
    if (data.profile) {
      await validateLocation(c, data.profile, 'present');
      await validateLocation(c, data.profile, 'permanent');
    }
    const name = data.profile?.name_en || data.username;
    await c.query(
      'INSERT INTO nid_applicant_accounts (id,name,email,password_hash,mobile,verification_hash,verification_expires) VALUES (?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 15 MINUTE))',
      [id, name, email, passwordHash, data.mobile, hash(id + code)]
    );
    if (data.profile) {
      await c.query('INSERT INTO nid_first_time_applications (id,applicant_id,fields_json) VALUES (?,?,?)', [applicationId, id, JSON.stringify(data.profile)]);
      await c.query("INSERT INTO nid_application_status_history (application_id,to_status,actor_type,actor_id,remarks) VALUES (?,'DRAFT','applicant',?,'Created from confirmed registration profile')", [applicationId, id]);
    }
    await c.commit();
    res.status(201).json({ ...session({ id, name }), applicationId, profileSaved: Boolean(data.profile), demoVerificationCode: code, contactNotice: 'LOCAL DEMO ONLY: this displayed code simulates contact verification; no email or SMS was sent.' });
  } catch (e) {
    await c.rollback();
    if (e.code === 'ER_DUP_ENTRY') throw fail(409, 'ACCOUNT_EXISTS');
    throw e;
  } finally { c.release(); }
});
router.post('/login', async (req, res) => {
  const input = z.object({ email: z.email().max(200), password: z.string().min(1).max(72) }).strict().parse(req.body);
  const [[account]] = await db.query('SELECT id,name,password_hash,active FROM nid_applicant_accounts WHERE email=?', [input.email]);
  if (!account || !account.active || !await bcrypt.compare(input.password, account.password_hash)) throw fail(401, 'INVALID_CREDENTIALS');
  res.json(session(account));
});
router.use(requirePrincipal, requireApplicant);
router.get('/me', (req, res) => res.json(req.principal.account));
router.post('/contact-code', async (req, res) => {
  requireLocalDemo(req);
  const code = String(randomInt(100000, 1000000));
  const [result] = await db.query('UPDATE nid_applicant_accounts SET verification_hash=?,verification_expires=DATE_ADD(NOW(),INTERVAL 15 MINUTE),verification_attempts=0 WHERE id=? AND contact_verified_at IS NULL AND (verification_expires IS NULL OR verification_expires<DATE_ADD(NOW(),INTERVAL 14 MINUTE))', [hash(req.principal.id + code), req.principal.id]);
  if (!result.affectedRows) throw fail(429, 'WAIT_BEFORE_NEW_CODE', 'Wait one minute before requesting another demo code.');
  res.json({ demoVerificationCode: code, mode: 'DEMO', message: 'Local simulation only. No email or SMS was sent.' });
});
router.post('/verify-contact', async (req, res) => {
  const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).strict().parse(req.body);
  const [result] = await db.query('UPDATE nid_applicant_accounts SET contact_verified_at=NOW(),verification_hash=NULL WHERE id=? AND verification_hash=? AND verification_expires>NOW() AND verification_attempts<5', [req.principal.id, hash(req.principal.id + code)]);
  if (!result.affectedRows) {
    await db.query('UPDATE nid_applicant_accounts SET verification_attempts=verification_attempts+1 WHERE id=? AND contact_verified_at IS NULL', [req.principal.id]);
    throw fail(400, 'INVALID_OR_EXPIRED_CODE');
  }
  res.json({ verified: true, mode: 'DEMO', notice: 'Demonstration contact check only—not government identity verification.' });
});
router.use(safeError);
module.exports = router;
