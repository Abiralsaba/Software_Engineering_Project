'use strict';
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const db = require('../config/db');
const { NATIONX_DEMO_FIRST_TIME_NID_RULES: rules, patchSchema, editable, fail, json } = require('./rules');
const hash = value => createHash('sha256').update(value).digest('hex');
async function transaction(fn) {
  const c = await db.getConnection();
  try { await c.beginTransaction(); const value = await fn(c); await c.commit(); return value; }
  catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}
async function owned(c, applicantId, id, lock = false) {
  const [[row]] = await c.query(`SELECT * FROM nid_first_time_applications WHERE id=? AND applicant_id=?${lock ? ' FOR UPDATE' : ''}`, [id, applicantId]);
  if (!row) throw fail(404, 'APPLICATION_NOT_FOUND');
  return { ...row, fields_json: json(row.fields_json) };
}
async function view(c, row) {
  const [documents] = await c.query('SELECT id,kind,mime_type,created_at FROM nid_application_documents WHERE application_id=? ORDER BY kind', [row.id]);
  const [history] = await c.query('SELECT from_status,to_status,remarks,created_at FROM nid_application_status_history WHERE application_id=? ORDER BY id', [row.id]);
  const fields = json(row.fields_json);
  return { id: row.id, status: row.status, version: row.version, fields, tracking_number: row.tracking_number, documents, history, rules, missing_fields: rules.fields.filter(key => !fields[key]), missing_documents: rules.documents.filter(kind => !documents.some(d => d.kind === kind)) };
}
async function current(applicantId, create = false) {
  return transaction(async c => {
    // Account lock serializes draft creation even before an application row exists.
    const [[account]] = await c.query('SELECT id FROM nid_applicant_accounts WHERE id=? FOR UPDATE', [applicantId]);
    if (!account) throw fail(404, 'APPLICANT_NOT_FOUND');
    let [[row]] = await c.query('SELECT * FROM nid_first_time_applications WHERE applicant_id=?', [applicantId]);
    if (!row && create) {
      const id = randomUUID();
      await c.query("INSERT INTO nid_first_time_applications (id,applicant_id,fields_json) VALUES (?,?,'{}')", [id, applicantId]);
      await c.query("INSERT INTO nid_application_status_history (application_id,to_status,actor_type,actor_id) VALUES (?,'DRAFT','applicant',?)", [id, applicantId]);
      row = await owned(c, applicantId, id);
    }
    return row ? view(c, row) : null;
  });
}
async function read(applicantId, id) { return view(db, await owned(db, applicantId, id)); }
function checkVersion(row, version) { if (!Number.isSafeInteger(version) || row.version !== version) throw fail(409, 'DRAFT_CHANGED', 'Your draft changed. Reload and review it again.'); }
async function revise(applicantId, id, version, change) {
  return transaction(async c => {
    const row = await owned(c, applicantId, id, true); checkVersion(row, version);
    if (!editable(row.status)) throw fail(409, 'APPLICATION_NOT_EDITABLE');
    await change(c, row);
    await c.query('UPDATE nid_first_time_applications SET version=version+1 WHERE id=?', [id]);
    // Tokens are version-bound, so earlier review confirmations become unusable.
    return view(c, await owned(c, applicantId, id));
  });
}
async function patch(applicantId, id, version, fields) {
  const values = patchSchema.parse(fields);
  if (!Object.keys(values).length) throw fail(400, 'EMPTY_PATCH');
  return revise(applicantId, id, version, async (c, row) => {
    await c.query('UPDATE nid_first_time_applications SET fields_json=? WHERE id=?', [JSON.stringify({ ...row.fields_json, ...values }), id]);
  });
}
function ready(row) {
  if (row.missing_fields.length || row.missing_documents.length) throw fail(422, 'INCOMPLETE_APPLICATION', 'Complete every required field and document before reviewing.');
}
async function review(applicantId, id, version) {
  return transaction(async c => {
    const row = await owned(c, applicantId, id, true); checkVersion(row, version);
    if (!editable(row.status)) throw fail(409, 'APPLICATION_NOT_EDITABLE');
    const application = await view(c, row); ready(application);
    const token = randomBytes(32).toString('hex');
    await c.query('INSERT INTO assistant_confirmations (id,application_id,draft_version,token_hash,expires_at) VALUES (?,?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))', [randomUUID(), id, version, hash(token)]);
    return { application, confirmation_token: token, notice: 'Review all details. Submission does not issue an NID or unlock citizen services.' };
  });
}
async function submit(applicantId, id, version, token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw fail(400, 'CONFIRMATION_REQUIRED');
  return transaction(async c => {
    const row = await owned(c, applicantId, id, true);
    const [[confirmation]] = await c.query('SELECT *, expires_at>NOW() AS valid FROM assistant_confirmations WHERE application_id=? AND token_hash=? FOR UPDATE', [id, hash(token)]);
    if (!confirmation || confirmation.draft_version !== version || row.version !== version) throw fail(409, 'CONFIRMATION_INVALIDATED');
    // Only the same consumed confirmation may replay the genuine receipt.
    if (confirmation.consumed_at && row.tracking_number) return view(c, row);
    if (!confirmation.valid || !editable(row.status)) throw fail(409, 'CONFIRMATION_EXPIRED_OR_USED');
    const [[account]] = await c.query('SELECT active,contact_verified_at FROM nid_applicant_accounts WHERE id=? FOR UPDATE', [applicantId]);
    if (!account.active || !account.contact_verified_at) throw fail(403, 'CONTACT_CHECK_REQUIRED');
    const application = await view(c, row); ready(application);
    const tracking = row.tracking_number || `NX-DEMO-${randomUUID().toUpperCase()}`;
    await c.query("UPDATE nid_first_time_applications SET status='SUBMITTED',tracking_number=?,submitted_at=NOW() WHERE id=?", [tracking, id]);
    await c.query('UPDATE assistant_confirmations SET consumed_at=NOW() WHERE id=?', [confirmation.id]);
    await c.query("UPDATE nid_applicant_accounts SET identity_state='NID_APPLICATION_SUBMITTED' WHERE id=?", [applicantId]);
    await c.query("INSERT INTO nid_application_status_history (application_id,from_status,to_status,actor_type,actor_id) VALUES (?,?,'SUBMITTED','applicant',?)", [id, row.status, applicantId]);
    return view(c, await owned(c, applicantId, id));
  });
}
module.exports = { transaction, owned, view, current, read, patch, revise, review, submit, hash, checkVersion };
