'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ quiet: true });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('Test database only');
const db = require('../../src/config/db');
const { applicantBoundary, publicPaths } = require('../../src/assistant/identity');
const { router, adminRouter } = require('../../src/assistant/applicationRoutes');
const { createAssistantRouter } = require('../../src/assistant/assistantRoutes');
const { keywordIntent, GeminiIntentProvider } = require('../../src/assistant/geminiIntentProvider');
let server, base; const ids = [];
const mock = { classify: async text => ({ schema_version: 'nationx-assistant-intent-v1', language: 'bn', service: 'NID', intent: keywordIntent(text), entities: {}, clarification_required: false }) };
async function request(route, token, method = 'GET', body) {
  const form = body instanceof FormData;
  const r = await fetch(base + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !form ? { 'Content-Type': 'application/json' } : {}) }, body: body ? form ? body : JSON.stringify(body) : undefined });
  let data; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
test('Applicant registration, isolation, draft, confirmation and assistant integration', async t => {
  const app = express(); app.use(express.json()); app.use('/api', applicantBoundary);
  app.use('/api/applicants', require('../../src/assistant/applicantRoutes'));
  app.use('/api/nid/first-time-applications', router); app.use('/api/nid/first-time-admin', adminRouter);
  app.use('/api/assistant', createAssistantRouter({ provider: process.env.ASSISTANT_LIVE_SMOKE === '1' ? new GeminiIntentProvider() : mock }));
  app.use('/api/nid', require('../../src/routes/nidRoutes'));
  app.use('/api/auth', require('../../src/routes/authRoutes'));
  app.use('/api/passport', require('../../src/routes/passportRoutes'));
  app.use('/api/payment', require('../../src/routes/paymentRoutes'));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); base = `http://127.0.0.1:${server.address().port}`;
  try {
    const suffix = Date.now();
    let alice, bob;
    await t.test('No-NID registration creates separate accounts, and login returns an applicant audience', async () => {
      for (const name of ['Alice','Bob']) {
        const email = `voice-${name}-${suffix}@nationx.test`;
        const r = await request('/api/applicants/register', null, 'POST', { username: `Synthetic ${name}`, email, password: 'Synthetic-demo-2026!', mobile: '01700000000' });
        assert.equal(r.status, 201, JSON.stringify(r.data)); ids.push(r.data.user.id);
        const decoded = jwt.decode(r.data.token); assert.equal(decoded.aud, 'nationx-nid-applicant'); assert.equal(decoded.id, undefined); assert.equal(decoded.nid, undefined);
        const [[count]] = await db.query('SELECT COUNT(*) n FROM reg_info WHERE email=?', [email]); assert.equal(count.n,0);
        const login = await request('/api/applicants/login', null,'POST',{email,password:'Synthetic-demo-2026!'}); assert.equal(login.status,200);
        assert.equal((await request('/api/applicants/verify-contact',r.data.token,'POST',{code:r.data.demoVerificationCode})).status,200);
        if (name === 'Alice') alice = r.data; else bob = r.data;
      }
    });
    await t.test('Existing citizen registration still requires NID; existing citizen retains NID API access', async () => {
      const missing = await request('/api/auth/register',null,'POST',{username:'Synthetic no NID',email:`missing-${suffix}@nationx.test`,password:'Synthetic-demo-2026!',mobile:'01700000000',dob:'1990-01-01',gender:'Male'});
      assert.equal(missing.status,400);
      const [[citizen]] = await db.query("SELECT id,nid FROM reg_info WHERE email='alice.demo@nationx.test'"); assert.ok(citizen);
      const token = jwt.sign(citizen,process.env.JWT_SECRET,{expiresIn:'1h'});
      assert.equal((await request('/api/nid/dashboard',token)).status,200);
      assert.equal((await request('/api/nid/first-time-applications',token,'POST',{})).status,403);
      assert.equal((await request('/api/payment/land/tax/init',null,'POST',{})).status,403);
      assert.equal((await request('/api/payment/land/tax/init',token,'POST',{nid:'not-the-current-citizen'})).status,400);
    });
    await t.test('Every discovered legacy route is default-denied for applicant tokens unless explicitly public', async () => {
      const appSource = fs.readFileSync(path.resolve(__dirname,'../../src/app.js'),'utf8');
      const variableFiles = Object.fromEntries([...appSource.matchAll(/const (\w+) = require\('\.\/routes\/(\w+)'\)/g)].map(m=>[m[1],m[2]]));
      let denied = 0;
      for (const mount of appSource.matchAll(/app\.use\('(\/api\/[^']+)', (\w+)\)/g)) {
        const file = variableFiles[mount[2]]; if (!file) continue;
        const source = fs.readFileSync(path.resolve(__dirname,`../../src/routes/${file}.js`),'utf8');
        for (const route of source.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)) {
          const url = (mount[1] + (route[2] === '/' ? '' : route[2])).replace(/:[\w]+/g,'123');
          if (route[1] === 'get' && publicPaths.some(p=>p.test(url))) continue;
          const result = await request(url,alice.token,route[1].toUpperCase(),route[1] === 'get' ? undefined : {});
          assert.equal(result.status,403,`${route[1]} ${url}: ${JSON.stringify(result.data)}`); denied++;
        }
      }
      assert.ok(denied>300); t.diagnostic(`Denied ${denied} discovered legacy endpoint/method combinations.`);
      assert.equal((await request('/api/nid/fees',alice.token)).status,200);
    });
    let draft;
    await t.test('Concurrent draft starts create one application and deny cross-user reads', async () => {
      const rows = await Promise.all([1,2,3].map(()=>request('/api/nid/first-time-applications',alice.token,'POST',{})));
      assert.ok(rows.every(r=>r.status===200),JSON.stringify(rows)); draft = rows[0].data;
      assert.ok(rows.every(r=>r.data.id===draft.id)); assert.equal(draft.tracking_number,null);
      assert.equal((await request(`/api/nid/first-time-applications/${draft.id}`,bob.token)).status,404);
      assert.equal((await request(`/api/nid/first-time-applications/${draft.id}`)).status,401);
    });
    let session;
    await t.test('Bangla intent starts/resumes the genuine draft; sensitive fields are saved only when confirmed', async () => {
      session = (await request('/api/assistant/sessions',alice.token,'POST',{})).data.session_id;
      assert.equal((await request(`/api/assistant/sessions/${session}`,bob.token)).status,404);
      let command = 'আমার NID বানাও';
      if (process.env.ASSISTANT_LIVE_SMOKE === '1') {
        assert.ok(path.isAbsolute(process.env.SYNTHETIC_AUDIO_PATH || ''), 'Provide an external synthetic WAV fixture');
        const form = new FormData(); form.append('audio', new Blob([fs.readFileSync(process.env.SYNTHETIC_AUDIO_PATH)], { type: 'audio/wav' }), 'synthetic.wav'); form.append('language','bn');
        const audio = await request(`/api/assistant/sessions/${session}/audio`,alice.token,'POST',form);
        assert.equal(audio.status,200,JSON.stringify(audio.data)); assert.equal(audio.data.requires_confirmation,true);
        command = audio.data.transcript; assert.equal(keywordIntent(command),'CREATE_NID_APPLICATION');
        t.diagnostic(`Actual local Whisper synthetic transcript: ${command}`);
      }
      const r = await request(`/api/assistant/sessions/${session}/message`,alice.token,'POST',{text:command,confirmed:true}); assert.equal(r.status,200,JSON.stringify(r.data)); assert.equal(r.data.application.id,draft.id);
      const unconfirmed = await request(`/api/nid/first-time-applications/${draft.id}/draft`,alice.token,'PATCH',{version:draft.version,fields:{name_en:'Unconfirmed'}}); assert.equal(unconfirmed.status,400);
      const confirmed = await request(`/api/assistant/sessions/${session}/message`,alice.token,'POST',{text:'সিন্থেটিক নাগরিক',field:'name_bn',version:draft.version,confirmed:true}); assert.equal(confirmed.status,200,JSON.stringify(confirmed.data)); draft=confirmed.data.application;
      const denied = await request(`/api/assistant/sessions/${session}/message`,alice.token,'POST',{text:'Passport করতে চাই',confirmed:true}); assert.equal(denied.data.action,'SHOW_ELIGIBILITY_MESSAGE');
    });
    await t.test('Draft validation, optimistic locking and required private documents', async () => {
      const prefix = `/api/nid/first-time-applications/${draft.id}`;
      const fields = {name_en:'Synthetic Applicant',date_of_birth:'1990-01-01',gender:'Other',mobile:'01700000000',present_address:'DEMO DATA — synthetic address'};
      assert.equal((await request(`${prefix}/draft`,alice.token,'PATCH',{version:draft.version,confirmed:true,fields:{citizen_id:1}})).status,400);
      const r = await request(`${prefix}/draft`,alice.token,'PATCH',{version:draft.version,confirmed:true,fields}); assert.equal(r.status,200,JSON.stringify(r.data)); draft=r.data;
      assert.equal((await request(`${prefix}/draft`,alice.token,'PATCH',{version:1,confirmed:true,fields:{name_en:'stale'}})).status,409);
      assert.equal((await request(`${prefix}/review`,alice.token,'POST',{version:draft.version})).status,422);
      const png = await sharp({create:{width:100,height:100,channels:3,background:'#008050'}}).png().toBuffer();
      for(const kind of ['photo','birth_certificate']) {
        const form = new FormData(); form.append('document',new Blob([png],{type:'image/png'}),'synthetic.png'); form.append('kind',kind); form.append('version',draft.version);
        const uploaded = await request(`${prefix}/documents`,alice.token,'POST',form); assert.equal(uploaded.status,200,JSON.stringify(uploaded.data)); draft=uploaded.data;
      }
      assert.equal((await request(`${prefix}/documents/${draft.documents[0].id}`,bob.token)).status,404);
    });
    let confirmation;
    await t.test('A submission failure rolls back status, tracking, token consumption and history together', async () => {
      const prefix=`/api/nid/first-time-applications/${draft.id}`;
      const review=await request(`${prefix}/review`,alice.token,'POST',{version:draft.version}); assert.equal(review.status,200);
      const originalGet = db.getConnection;
      db.getConnection = async function () {
        const c=await originalGet.call(db); const query=c.query; const release=c.release;
        c.query=async function(sql,params) {
          if(typeof sql==='string'&&sql.startsWith('INSERT INTO nid_application_status_history')&&params?.[0]===draft.id) throw new Error('Synthetic test-only write failure');
          return query.call(c,sql,params);
        };
        c.release=function(){c.query=query;c.release=release;return release.call(c);};return c;
      };
      try { assert.equal((await request(`${prefix}/submit`,alice.token,'POST',{version:draft.version,confirmed:true,confirmation_token:review.data.confirmation_token})).status,500); }
      finally { db.getConnection=originalGet; }
      const after=(await request(prefix,alice.token)).data;
      assert.equal(after.status,'DRAFT'); assert.equal(after.tracking_number,null);assert.equal(after.history.filter(h=>h.to_status==='SUBMITTED').length,0);
      const [[used]]=await db.query('SELECT COUNT(*) n FROM assistant_confirmations WHERE application_id=? AND consumed_at IS NOT NULL',[draft.id]);assert.equal(used.n,0);
    });
    await t.test('Corrections invalidate review; concurrent repeated submission produces one tracking and history', async () => {
      const prefix = `/api/nid/first-time-applications/${draft.id}`;
      const old = await request(`${prefix}/review`,alice.token,'POST',{version:draft.version}); assert.equal(old.status,200);
      draft=(await request(`${prefix}/draft`,alice.token,'PATCH',{version:draft.version,confirmed:true,fields:{name_en:'Synthetic corrected applicant'}})).data;
      assert.equal((await request(`${prefix}/submit`,alice.token,'POST',{version:draft.version,confirmed:true,confirmation_token:old.data.confirmation_token})).status,409);
      confirmation=(await request(`${prefix}/review`,alice.token,'POST',{version:draft.version})).data;
      const results=await Promise.all([1,2,3].map(()=>request(`${prefix}/submit`,alice.token,'POST',{version:draft.version,confirmed:true,confirmation_token:confirmation.confirmation_token})));
      assert.ok(results.every(r=>r.status===200),JSON.stringify(results)); assert.equal(new Set(results.map(r=>r.data.tracking_number)).size,1);
      draft=results[0].data; assert.match(draft.tracking_number,/^NX-DEMO-/); assert.equal(draft.history.filter(r=>r.to_status==='SUBMITTED').length,1);
      assert.equal((await request('/api/passport/apply',alice.token,'POST',{})).status,403);
      assert.equal((await request(`${prefix}/submit`,alice.token,'POST',{version:draft.version,confirmation_token:confirmation.confirmation_token,confirmed:false})).status,400);
    });
    await t.test('Admin transitions are selected-record-only, versioned and never issue/activate an NID', async () => {
      const other = (await request('/api/nid/first-time-applications',bob.token,'POST',{})).data;
      const [[admin]]=await db.query("SELECT id FROM admins WHERE status='approved' LIMIT 1"); assert.ok(admin);
      const token=jwt.sign({id:admin.id,isAdmin:true},process.env.JWT_SECRET,{expiresIn:'1h'});
      const prefix=`/api/nid/first-time-admin/${draft.id}/status`;
      assert.equal((await request(prefix,alice.token,'POST',{status:'UNDER_REVIEW',version:draft.version,remarks:'Synthetic review'})).status,403);
      const updated=await request(prefix,token,'POST',{status:'UNDER_REVIEW',version:draft.version,remarks:'Synthetic review'}); assert.equal(updated.status,200,JSON.stringify(updated.data));
      assert.equal((await request(prefix,token,'POST',{status:'APPROVED_PENDING_ISSUANCE',version:updated.data.version,remarks:'Synthetic approval, not issuance'})).status,200);
      const [[a]]=await db.query('SELECT identity_state FROM nid_applicant_accounts WHERE id=?',[alice.user.id]); assert.equal(a.identity_state,'NID_APPROVED_PENDING_ISSUANCE');
      assert.equal((await request(`/api/nid/first-time-applications/${other.id}`,bob.token)).data.status,'DRAFT');
      assert.equal((await request('/api/passport/apply',alice.token,'POST',{})).status,403);
      assert.equal((await request('/api/assistant/sessions/'+session+'/cancel',alice.token,'POST',{})).status,200);
      assert.equal((await request('/api/assistant/sessions/'+session+'/message',alice.token,'POST',{text:'আমার NID বানাও',confirmed:true})).status,409);
    });
    await t.test('Expired sessions and suspended applicant accounts are rejected using current DB state', async () => {
      const s=(await request('/api/assistant/sessions',bob.token,'POST',{})).data.session_id;
      await db.query('UPDATE assistant_sessions SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=? AND applicant_id=?',[s,bob.user.id]);
      assert.equal((await request(`/api/assistant/sessions/${s}`,bob.token)).status,410);
      await db.query("UPDATE nid_applicant_accounts SET identity_state='SUSPENDED' WHERE id=?",[bob.user.id]);
      assert.equal((await request('/api/applicants/me',bob.token)).status,403);
    });
  } finally {
    // Only freshly created synthetic UUID-owned records, only in the test database.
    for(const id of ids) {
      await db.query('DELETE FROM assistant_events WHERE session_id IN (SELECT id FROM assistant_sessions WHERE applicant_id=?)',[id]);
      await db.query('DELETE FROM assistant_sessions WHERE applicant_id=?',[id]);
      for(const table of ['assistant_confirmations','nid_application_documents','nid_application_status_history']) await db.query(`DELETE FROM ${table} WHERE application_id IN (SELECT id FROM nid_first_time_applications WHERE applicant_id=?)`,[id]);
      await db.query('DELETE FROM nid_first_time_applications WHERE applicant_id=?',[id]);
      await db.query('DELETE FROM nid_applicant_accounts WHERE id=?',[id]);
    }
    await new Promise(resolve=>server.close(resolve)); await db.end();
  }
});
