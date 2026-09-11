'use strict';
const express = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const db = require('../config/db');
const service = require('./applicationService');
const { requirePrincipal, safeError } = require('./identity');
const { labels, fail } = require('./rules');
const { GeminiIntentProvider, propose, keywordIntent } = require('./geminiIntentProvider');
const whisper = require('./whisperProvider');
const navigation = Object.freeze({ REPLACE_LOST_NID: '/nid.html?section=reissue', CORRECT_EXISTING_NID: '/nid.html?section=correction', APPLY_FOR_SMART_CARD: '/nid.html?section=smart-card', CHECK_NID_STATUS: '/nid.html?section=applications', OPEN_NID_SERVICE: '/nid.html' });
function createAssistantRouter({ provider = new GeminiIntentProvider(), transcribe = whisper.transcribe } = {}) {
  const router = express.Router();
  router.use(requirePrincipal, rateLimit({ windowMs: 60000, limit: 40 }));
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); if (process.env.VOICE_ASSISTANT_ENABLED === 'false') return next(fail(503, 'ASSISTANT_DISABLED')); next(); });
  async function owned(c, req, lock = false) {
    const id = z.uuid().parse(req.params.sessionId);
    const [[session]] = await c.query(`SELECT *,expires_at>NOW() valid FROM assistant_sessions WHERE id=? AND ${req.principal.type === 'applicant' ? 'applicant_id' : 'citizen_id'}=?${lock ? ' FOR UPDATE' : ''}`, [id, req.principal.id]);
    if (!session) throw fail(404, 'SESSION_NOT_FOUND');
    if (!session.valid) throw fail(410, 'SESSION_EXPIRED');
    return session;
  }
  async function response(req, session) {
    const app = session.application_id && req.principal.type === 'applicant' ? await service.read(req.principal.id, session.application_id) : null;
    if (session.state === 'CANCELLED') return { session_id: session.id, state: 'CANCELLED', action: 'SHOW_ERROR', message_bn: 'সহকারী বন্ধ হয়েছে। আপনার খসড়া সংরক্ষিত আছে।', message_en: 'Assistant cancelled. Your saved draft is preserved.' };
    if (app) {
      const field = app.missing_fields[0];
      const submitted = !['DRAFT','ADDITIONAL_INFORMATION_REQUIRED'].includes(app.status);
      const state = submitted ? 'SUBMITTED' : field ? 'COLLECTING_INFORMATION' : app.missing_documents.length ? 'DOCUMENTS_REQUIRED' : 'REVIEW_REQUIRED';
      return { session_id: session.id, state, action: submitted ? 'SHOW_RECEIPT' : state === 'REVIEW_REQUIRED' ? 'SHOW_REVIEW' : 'ASK_QUESTION', application: app, expected_field: field || null,
        message_bn: submitted ? `আপনার আবেদনের অবস্থা: ${app.status}।` : field ? labels[field][0] : app.missing_documents.length ? 'প্রয়োজনীয় ডেমো নথি আপলোড করুন।' : 'সব তথ্য যাচাই করুন। তারপর নিশ্চিত করুন।',
        message_en: submitted ? `Application ${app.status}. Tracking: ${app.tracking_number || 'not submitted'}. Citizen services remain locked.` : field ? labels[field][1] : app.missing_documents.length ? 'Upload the required demonstration documents.' : 'Review every detail before confirming submission.' };
    }
    return { session_id: session.id, state: session.state, action: 'ASK_QUESTION', message_bn: 'আপনি কি নতুন NID আবেদন করতে চান, নাকি আবেদনের অবস্থা জানতে চান?', message_en: 'Would you like to start an NID application or check its status?' };
  }
  router.get('/health', async (req, res) => res.json(await whisper.health()));
  router.post('/sessions', async (req, res) => {
    const id = randomUUID();
    await db.query('INSERT INTO assistant_sessions (id,applicant_id,citizen_id,expires_at) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 24 HOUR))', [id, req.principal.type === 'applicant' ? req.principal.id : null, req.principal.type === 'citizen' ? req.principal.id : null]);
    res.status(201).json(await response(req, { id, state: 'NEW' }));
  });
  router.get('/sessions/:sessionId', async (req, res) => res.json(await response(req, await owned(db, req))));
  async function message(req, res) {
    const data = z.object({ text: z.string().trim().min(1).max(1000), confirmed: z.literal(true), field: z.enum(Object.keys(labels)).optional(), version: z.number().int().positive().optional() }).strict().parse(req.body);
    const before = await owned(db, req);
    if (before.state === 'CANCELLED') throw fail(409, 'SESSION_CANCELLED');
    // Field values never leave this process for Gemini. They are explicitly confirmed in React.
    const localControl = keywordIntent(data.text);
    const isControl = ['CANCEL','GO_BACK','REPEAT_LAST_MESSAGE'].includes(localControl);
    const intent = isControl ? localControl : data.field ? null : await propose(data.text, provider);
    const output = await service.transaction(async c => {
      const session = await owned(c, req, true);
      if (session.state === 'CANCELLED') throw fail(409, 'SESSION_CANCELLED');
      if (data.field && !isControl) {
        if (req.principal.type !== 'applicant' || !session.application_id) throw fail(409, 'NO_ACTIVE_APPLICATION');
        await service.patch(req.principal.id, session.application_id, data.version, { [data.field]: data.text });
      } else if (intent === 'CANCEL') {
        await c.query("UPDATE assistant_sessions SET state='CANCELLED' WHERE id=?", [session.id]); session.state = 'CANCELLED';
      } else if (intent === 'NID_REQUIRED' || (req.principal.type === 'applicant' && ['REPLACE_LOST_NID','CORRECT_EXISTING_NID','APPLY_FOR_SMART_CARD'].includes(intent))) {
        return { session_id: session.id, state: 'IDENTITY_CHECK', action: 'SHOW_ELIGIBILITY_MESSAGE', message_bn: 'এই সেবার জন্য NID প্রয়োজন। আপনার NID আবেদনের অবস্থা দেখুন।', message_en: 'This service requires an existing NID. Open your first-time application or status instead.' };
      } else if (req.principal.type === 'citizen' && navigation[intent]) {
        return { session_id: session.id, state: 'INTENT_CONFIRMED', action: 'NAVIGATE', destination: navigation[intent], message_bn: 'আপনার NID সেবার ফর্ম খুলুন।', message_en: 'Open the existing NID form. Review and submit there; the assistant has not submitted it.' };
      } else if (req.principal.type === 'citizen' && ['CREATE_NID_APPLICATION','CONTINUE_NID_APPLICATION'].includes(intent)) {
        return { session_id: session.id, state: 'IDENTITY_CHECK', action: 'SHOW_ELIGIBILITY_MESSAGE', message_bn: 'আপনার অ্যাকাউন্টে ইতিমধ্যে NID আছে।', message_en: 'Your account already has an NID. Use correction, replacement or smart-card services.' };
      } else if (['CREATE_NID_APPLICATION','CONTINUE_NID_APPLICATION','CHECK_NID_STATUS','OPEN_NID_SERVICE'].includes(intent) && req.principal.type === 'applicant') {
        const app = await service.current(req.principal.id, intent !== 'CHECK_NID_STATUS');
        if (app) { session.application_id = app.id; await c.query("UPDATE assistant_sessions SET application_id=?,intent=?,state='COLLECTING_INFORMATION' WHERE id=?", [app.id,intent,session.id]); }
      } else if (!['GO_BACK','REPEAT_LAST_MESSAGE','CORRECT_PREVIOUS_ANSWER'].includes(intent)) {
        return { session_id: session.id, state: 'INTENT_CLARIFICATION', action: 'ASK_QUESTION', message_bn: 'আপনি নতুন আবেদন করবেন, নাকি অবস্থা দেখবেন?', message_en: 'Please choose new application or application status.' };
      }
      await c.query('INSERT INTO assistant_events (session_id,event_code) VALUES (?,?)', [session.id, data.field && !isControl ? 'FIELD_CONFIRMED' : intent]);
      const out = await response(req, session);
      await c.query('UPDATE assistant_sessions SET state=? WHERE id=?', [out.state, session.id]);
      if (intent === 'GO_BACK' || intent === 'CORRECT_PREVIOUS_ANSWER') out.edit_previous = true;
      return out;
    });
    res.json(output);
  }
  router.post('/sessions/:sessionId/message', message);
  router.post('/sessions/:sessionId/correct', message);
  router.post('/sessions/:sessionId/confirm', async (req, res) => {
    const data = z.object({ version: z.number().int().positive(), confirmation_token: z.string(), confirmed: z.literal(true) }).strict().parse(req.body);
    const output = await service.transaction(async c => {
      const session = await owned(c, req, true);
      if (session.state === 'CANCELLED' || req.principal.type !== 'applicant' || !session.application_id) throw fail(409, 'NO_ACTIVE_APPLICATION');
      await service.submit(req.principal.id, session.application_id, data.version, data.confirmation_token);
      await c.query("UPDATE assistant_sessions SET state='SUBMITTED' WHERE id=?", [session.id]);
      return response(req, session);
    });
    res.json(output);
  });
  router.post('/sessions/:sessionId/cancel', async (req, res) => {
    const output = await service.transaction(async c => {
      const session = await owned(c, req, true);
      await c.query("UPDATE assistant_sessions SET state='CANCELLED' WHERE id=?", [session.id]);
      return response(req, { ...session, state: 'CANCELLED' });
    });
    res.json(output);
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: whisper.MAX_BYTES, files: 1, fields: 1, parts: 3 } });
  router.post('/sessions/:sessionId/audio', async (req, res, next) => { const session = await owned(db, req); if (session.state === 'CANCELLED') throw fail(409,'SESSION_CANCELLED'); next(); }, upload.single('audio'), async (req, res) => {
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', abort);
    try { res.json(await transcribe(req.file, { signal: controller.signal, language: req.body.language })); }
    finally { res.off('close', abort); req.file?.buffer?.fill(0); }
  });
  router.use(safeError);
  return router;
}
module.exports = { createAssistantRouter, navigation };
