'use strict';
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { fail } = require('./rules');
const APPLICANT_AUDIENCE = 'nationx-nid-applicant';
const denial = { error: 'VERIFIED_NID_REQUIRED', message_bn: 'এই সেবার জন্য একটি যাচাইকৃত জাতীয় পরিচয়পত্র প্রয়োজন।', message_en: 'An existing citizen account with an NID is required. Submitting an application does not unlock this service.', allowed_action: 'OPEN_NID_APPLICATION_STATUS' };
const isApplicant = claims => claims?.aud === APPLICANT_AUDIENCE || claims?.principal_type === 'NID_APPLICANT';
function decode(req) {
  if (!process.env.JWT_SECRET) throw fail(503, 'AUTH_NOT_CONFIGURED');
  const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
  if (!match) throw fail(401, 'AUTHENTICATION_REQUIRED');
  try { return jwt.verify(match[1], process.env.JWT_SECRET); }
  catch { throw fail(401, 'SESSION_EXPIRED'); }
}
async function requirePrincipal(req, res, next) {
  try {
    const claims = decode(req);
    if (claims.isAdmin) throw fail(403, 'CITIZEN_OR_APPLICANT_REQUIRED');
    if (isApplicant(claims)) {
      if (claims.aud !== APPLICANT_AUDIENCE || claims.principal_type !== 'NID_APPLICANT' || typeof claims.sub !== 'string') throw fail(403, 'INVALID_PRINCIPAL');
      const [[account]] = await db.query('SELECT id,name,email,mobile,active,identity_state,contact_verified_at,contact_mode FROM nid_applicant_accounts WHERE id=?', [claims.sub]);
      if (!account || !account.active || account.identity_state === 'SUSPENDED') throw fail(403, 'ACCOUNT_UNAVAILABLE');
      req.principal = { type: 'applicant', id: account.id, account };
    } else {
      if (claims.aud || !Number.isSafeInteger(claims.id)) throw fail(403, 'INVALID_PRINCIPAL');
      const [[account]] = await db.query('SELECT id,name,nid FROM reg_info WHERE id=?', [claims.id]);
      if (!account?.nid) throw fail(403, 'EXISTING_NID_REQUIRED');
      // Existing NationX registration is retained, NOT re-labelled as government verification.
      req.principal = { type: 'citizen', id: account.id, account };
    }
    next();
  } catch (e) { next(e); }
}
function requireApplicant(req, res, next) {
  if (req.principal?.type !== 'applicant') return next(fail(403, 'FIRST_TIME_APPLICANT_REQUIRED', 'Existing NID holders should use correction, replacement or smart-card services.'));
  next();
}
// Explicitly public information, inspected before legacy authentication middleware.
const publicPaths = [
  /^\/api\/nid\/(centers|fees)\/?$/,
  /^\/api\/passport\/(offices|fees|fee\/calculate)\/?$/,
  /^\/api\/health\/hospitals\/browse\/?$/,
  /^\/api\/water\/projects\/browse\/?$/,
  /^\/api\/university\/(admissions(?:\/\d+)?|universities)\/?$/,
  /^\/api\/education\/(boards|years|institutions(?:\/\d+)?)\/?$/,
  /^\/api\/notices(?:\/\d+)?\/?$/,
  /^\/api\/shop\/market-prices\/?$/
];
function applicantBoundary(req, res, next) {
  if (!req.headers.authorization) return next();
  let claims;
  try { claims = decode(req); } catch (e) { return res.status(e.status).json({ error: e.code }); }
  if (!isApplicant(claims)) return next();
  const route = req.originalUrl.split('?')[0];
  if (/^\/api\/(applicants|assistant)(\/|$)/.test(route) || /^\/api\/nid\/first-time-applications(\/|$)/.test(route) || (req.method === 'GET' && publicPaths.some(p => p.test(route)))) return next();
  return res.status(403).json(denial);
}
function safeError(err, req, res, next) {
  if (res.headersSent) return next(err);
  const validation = err.name === 'ZodError' || err instanceof SyntaxError;
  const status = validation || err.code?.startsWith('LIMIT_') ? 400 : err.status || 500;
  res.status(status).json({ error: status === 500 ? 'ASSISTANT_UNAVAILABLE' : validation ? 'INVALID_INPUT' : err.code || 'INVALID_REQUEST', message: status === 500 ? 'Please retry or use the manual NID interface.' : validation ? 'Check the supplied fields.' : err.message });
}
module.exports = { APPLICANT_AUDIENCE, isApplicant, denial, decode, requirePrincipal, requireApplicant, applicantBoundary, safeError, publicPaths };
