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
router.post('/register', async (req, res) => {
  // Deliberately local demonstration contact check; not real email verification.
  requireLocalDemo(req);
  const data = registrationSchema.parse(req.body);
  const [[existing]] = await db.query('SELECT id FROM reg_info WHERE email=? LIMIT 1', [data.email]);
  if (existing) throw fail(409, 'ACCOUNT_EXISTS', 'Use your existing citizen login.');
  const id = randomUUID(); const code = String(randomInt(100000, 1000000));
  try {
    await db.query('INSERT INTO nid_applicant_accounts (id,name,email,password_hash,mobile,verification_hash,verification_expires) VALUES (?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 15 MINUTE))', [id, data.username, data.email.toLowerCase(), await bcrypt.hash(data.password, 10), data.mobile, hash(id + code)]);
  } catch (e) { if (e.code === 'ER_DUP_ENTRY') throw fail(409, 'ACCOUNT_EXISTS'); throw e; }
  res.status(201).json({ ...session({ id, name: data.username }), demoVerificationCode: code, contactNotice: 'LOCAL DEMO ONLY: this displayed code simulates contact verification; no email or SMS was sent.' });
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
