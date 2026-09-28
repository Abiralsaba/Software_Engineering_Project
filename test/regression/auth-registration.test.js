'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
process.env.DB_NAME = 'central_govt_db_test';
require('dotenv').config({ quiet: true });
if (process.env.DB_NAME !== 'central_govt_db_test') throw new Error('Test database only');
const db = require('../../src/config/db');

test('citizen registration validates identity input and writes both account tables atomically', async () => {
  const app = express(); app.use(express.json()); app.use('/api/auth', require('../../src/routes/authRoutes'));
  const server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  const base = `http://127.0.0.1:${server.address().port}`; const suffix = String(Date.now());
  const email = `citizen-registration-${suffix}@nationx.test`; const nid = `91${suffix.padStart(15, '0').slice(-15)}`;
  const payload = { username:'Synthetic Registration Citizen',email,password:'Synthetic-demo-2026!',nid,mobile:'01700000000',dob:'1990-01-01',gender:'Other',address:'DEMO DATA — synthetic address' };
  const post = body => fetch(`${base}/api/auth/register`, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) });
  try {
    const created = await post(payload); assert.equal(created.status,201,await created.text());
    const [[stored]] = await db.query('SELECT r.id,r.name,r.email,r.nid,u.user_id,u.name mirrored_name FROM reg_info r JOIN user_info u ON u.user_id=r.id WHERE r.email=?',[email]);
    assert.ok(stored); assert.equal(stored.user_id,stored.id); assert.equal(stored.mirrored_name,payload.username); assert.equal(stored.nid,nid);
    const duplicate = await post({...payload,email:`duplicate-${email}`}); assert.equal(duplicate.status,409); assert.equal((await duplicate.json()).error,'ACCOUNT_EXISTS');

    const failedEmail = `citizen-rollback-${suffix}@nationx.test`; const failedNid = `92${suffix.padStart(15, '0').slice(-15)}`;
    const originalGet = db.getConnection;
    db.getConnection = async function () {
      const connection = await originalGet.call(db); const query = connection.query; const release = connection.release;
      connection.query = async function (sql, params) {
        if (typeof sql === 'string' && sql.startsWith('INSERT INTO user_info') && params?.[2] === failedEmail) throw new Error('Synthetic mirror failure');
        return query.call(connection,sql,params);
      };
      connection.release = function () { connection.query=query; connection.release=release; return release.call(connection); };
      return connection;
    };
    try { const failed = await post({...payload,email:failedEmail,nid:failedNid}); assert.equal(failed.status,500); }
    finally { db.getConnection=originalGet; }
    const [[rolledBack]] = await db.query('SELECT COUNT(*) n FROM reg_info WHERE email=? OR nid=?',[failedEmail,failedNid]); assert.equal(rolledBack.n,0);
  } finally {
    await db.query('DELETE FROM reg_info WHERE email=?',[email]);
    await new Promise(resolve => server.close(resolve)); await db.end();
  }
});
