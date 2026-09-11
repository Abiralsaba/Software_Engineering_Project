const { test, expect } = require('@playwright/test');
const sharp = require('sharp');
process.env.DB_NAME='central_govt_db_test';
require('dotenv').config({quiet:true});
const db=require('../../src/config/db');
let applicantId;
test.afterAll(async()=>{
  if(applicantId){
    for(const table of ['assistant_events'])await db.query(`DELETE FROM ${table} WHERE session_id IN (SELECT id FROM assistant_sessions WHERE applicant_id=?)`,[applicantId]);
    await db.query('DELETE FROM assistant_sessions WHERE applicant_id=?',[applicantId]);
    for(const table of ['assistant_confirmations','nid_application_documents','nid_application_status_history'])await db.query(`DELETE FROM ${table} WHERE application_id IN (SELECT id FROM nid_first_time_applications WHERE applicant_id=?)`,[applicantId]);
    await db.query('DELETE FROM nid_first_time_applications WHERE applicant_id=?',[applicantId]);await db.query('DELETE FROM nid_applicant_accounts WHERE id=?',[applicantId]);
  }
  await db.end();
});
test('No-NID registration, direct-route denial, manual draft and explicit submission in real browser',async({page,request},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/register.html');
  await page.getByRole('radio',{name:/I don’t have an NID/}).check();
  await expect(page.getByLabel('NID Number',{exact:true})).toHaveCount(0);
  const email=`browser-applicant-${Date.now()}@nationx.test`;
  await page.getByLabel('Full Name').fill('Synthetic Browser Applicant');
  await page.getByLabel('Mobile Number').fill('01700000000');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill('Synthetic-demo-2026!');
  await page.getByLabel('Confirm Password').fill('Synthetic-demo-2026!');
  await page.getByRole('checkbox').check();
  const [registration]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/applicants/register')),page.getByRole('button',{name:'Create Applicant Account'}).click()]);
  const registered=await registration.json();applicantId=registered.user.id;expect(registration.status()).toBe(201);
  await expect(page).toHaveURL(/nid-applicant.html/);
  await page.getByLabel('Demo verification code').fill(registered.demoVerificationCode);
  await page.getByRole('button',{name:'Confirm demo code'}).click();
  await expect(page.getByLabel('Demo verification code')).toHaveCount(0);
  await page.goto('/passport.html?section=apply');
  await expect(page).toHaveURL(/nid-applicant.html\?blocked=/);
  await expect(page.getByText(/You cannot access that citizen service/)).toBeVisible();
  expect((await request.post('/api/passport/apply',{headers:{Authorization:`Bearer ${registered.token}`},data:{}})).status()).toBe(403);
  if(process.env.ASSISTANT_LIVE_SMOKE === '1') {
    await page.getByRole('button',{name:'● Tap to speak'}).click();
    await expect(page.getByRole('button',{name:'■ Stop recording'})).toBeVisible();
    // Capture the complete 6.45-second synthetic speech fixture through MediaRecorder.
    await page.waitForTimeout(7200);
    await page.getByRole('button',{name:'■ Stop recording'}).click();
    await expect(page.locator('#assistant-transcript')).not.toHaveValue('',{timeout:90000});
    await expect(page.getByRole('button',{name:'Yes — confirm and send'})).toBeEnabled();
    await page.getByRole('button',{name:'Yes — confirm and send'}).click();
    await expect(page.getByLabel('Answer or correct a field')).toBeVisible({timeout:45000});
  } else {
    await page.getByRole('button',{name:'Start first-time application',exact:true}).click();
  }
  await expect(page.getByText('Draft version 1',{exact:false})).toBeVisible();
  await page.getByLabel('আপনার বাংলা নাম লিখুন।Your name in Bangla').fill('সিন্থেটিক আবেদনকারী');
  await page.getByLabel('আপনার ইংরেজি নাম লিখুন।Your name in English').fill('Synthetic Browser Applicant');
  await page.getByLabel('আপনার জন্মতারিখ লিখুন।Date of birth (YYYY-MM-DD)').fill('1990-01-01');
  await page.getByLabel('আপনার লিঙ্গ নির্বাচন করুন।Gender').selectOption('Other');
  await page.getByLabel('আপনার মোবাইল নম্বর লিখুন।Mobile number').fill('01700000000');
  await page.getByLabel('আপনার বর্তমান ঠিকানা লিখুন।Present address').fill('DEMO DATA — browser synthetic address');
  await page.getByRole('button',{name:'Confirm and save entered fields'}).click();
  await expect(page.getByText('Draft version 2',{exact:false})).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('আপনার ইংরেজি নাম লিখুন।Your name in English')).toHaveValue('Synthetic Browser Applicant');
  const png=await sharp({create:{width:100,height:100,channels:3,background:'#007d45'}}).png().toBuffer();
  for(const kind of ['photo','birth certificate']){
    const [uploaded]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/documents')&&r.request().method()==='POST'),page.getByLabel(new RegExp(`^${kind} —`)).setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:png})]);expect(uploaded.status()).toBe(200);
  }
  await page.getByRole('button',{name:'Review application',exact:true}).click();
  await expect(page.getByRole('region',{name:'Final application review'})).toBeVisible();
  await page.getByRole('button',{name:'No — keep editing'}).click();
  await page.getByLabel('আপনার ইংরেজি নাম লিখুন।Your name in English').fill('Synthetic Corrected Applicant');
  await page.getByRole('button',{name:'Confirm and save entered fields'}).click();
  await page.getByRole('button',{name:'Review application',exact:true}).click();
  await expect(page.getByRole('region',{name:'Final application review'}).getByText('Synthetic Corrected Applicant',{exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('applicant-review.png'),fullPage:true});
  await page.getByRole('button',{name:'Yes — submit my application'}).click();
  await expect(page.locator('output')).toHaveText(/^NX-DEMO-/);
  const tracking=await page.locator('output').textContent();await page.reload();await expect(page.locator('output')).toHaveText(tracking);
  expect(errors).toEqual([]);
  await page.getByRole('button',{name:'Logout',exact:true}).click();
  await page.goto('/index.html#signin');await page.getByLabel(/I registered without an NID/).check();
  await page.locator('#citizen-email').fill(email);await page.locator('#citizen-password').fill('Synthetic-demo-2026!');await page.getByRole('button',{name:'Login to Portal'}).click();
  await page.locator('.swal2-confirm').click();await expect(page).toHaveURL(/nid-applicant.html/);await expect(page.locator('.nx-receipt output')).toHaveText(tracking);
  await page.goto('/index.html#admin');
  await page.locator('#admin-email').fill('admin.demo@nationx.test');await page.locator('#admin-password').fill('NationX-Admin-2026!');
  await page.getByRole('button',{name:'Sign In to Admin Panel'}).click();await page.locator('.swal2-confirm').click();
  await expect(page).toHaveURL(/reports.html/);await page.goto('/admin-nid.html');
  await page.getByRole('row').filter({hasText:tracking}).getByRole('button',{name:'Review applicant'}).click();
  await page.getByRole('button',{name:'View photo',exact:true}).click();await expect(page.getByAltText('Applicant photo',{exact:true})).toBeVisible();
  await page.getByLabel('Next applicant status').selectOption('UNDER_REVIEW');
  await page.getByLabel('Review remarks / appointment instructions').fill('Synthetic browser review; no identity issued.');
  await page.getByRole('button',{name:'Update selected applicant',exact:true}).click();
  await expect(page.getByText('UNDER_REVIEW: Synthetic browser review; no identity issued.',{exact:true})).toBeVisible();
  expect((await request.post('/api/passport/apply',{headers:{Authorization:`Bearer ${registered.token}`},data:{}})).status()).toBe(403);
  expect(errors).toEqual([]);
});
