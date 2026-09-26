'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const jwt=require('jsonwebtoken');
const db=require('../../src/config/db');
const {createAssistantRouter}=require('../../src/assistant/assistantRoutes');

test('citizen audio requires authentication, transcribes without creating NID sessions and erases audio',async t=>{
  const previous=process.env.JWT_SECRET;process.env.JWT_SECRET='synthetic-audio-route-test-secret';
  t.after(()=>{if(previous===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=previous;});
  const queries=[];
  const mock=t.mock.method(db,'query',async(sql)=>{queries.push(sql);assert.match(sql,/SELECT id,name,nid FROM reg_info/);return [[{id:71,name:'Synthetic Citizen',nid:'TEST'}]];});
  let calls=0,received;
  const app=express();app.use(express.json());app.use('/api/assistant',createAssistantRouter({transcribe:async(file,options)=>{calls++;received=file.buffer;assert.equal(options.language,'bn');return {transcript:'পানির সংযোগ',requires_confirmation:true};}}));
  const server=await new Promise(resolve=>{const value=app.listen(0,'127.0.0.1',()=>resolve(value));});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}/api/assistant/audio`;
  assert.equal((await fetch(url,{method:'POST'})).status,401);
  assert.equal(calls,0);
  const body=new FormData();body.append('audio',new Blob(['synthetic-audio'],{type:'audio/wav'}),'sample.wav');body.append('language','bn');
  const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${jwt.sign({id:71},process.env.JWT_SECRET)}`},body});
  assert.equal(response.status,200);assert.equal((await response.json()).transcript,'পানির সংযোগ');
  assert.equal(calls,1);assert.equal(queries.length,1);assert.ok(received.every(byte=>byte===0));
  mock.mock.restore();
});
