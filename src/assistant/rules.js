'use strict';
const { z } = require('zod');
const text = z.string().trim().min(1).max(200).refine(v => !/[<>\u0000-\u001f]/.test(v), 'Use plain text without markup.');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v); return !isNaN(d) && d.toISOString().slice(0, 10) === v && d < new Date() && d.getUTCFullYear() >= 1900; }, 'Enter a valid past birth date.');
const fields = {
  name_bn: text, name_en: text, date_of_birth: date,
  gender: z.enum(['Male', 'Female', 'Other']),
  mobile: z.string().regex(/^(?:\+?88)?01\d{9}$/),
  present_address: text.max(200)
};
const labels = {
  name_bn: ['আপনার বাংলা নাম লিখুন।', 'Your name in Bangla'],
  name_en: ['আপনার ইংরেজি নাম লিখুন।', 'Your name in English'],
  date_of_birth: ['আপনার জন্মতারিখ লিখুন।', 'Date of birth (YYYY-MM-DD)'],
  gender: ['আপনার লিঙ্গ নির্বাচন করুন।', 'Gender'],
  mobile: ['আপনার মোবাইল নম্বর লিখুন।', 'Mobile number'],
  present_address: ['আপনার বর্তমান ঠিকানা লিখুন।', 'Present address']
};
const NATIONX_DEMO_FIRST_TIME_NID_RULES = Object.freeze({
  code: 'NATIONX_DEMO_FIRST_TIME_NID_RULES',
  notice: 'NationX competition demonstration requirements—not official Bangladesh Election Commission requirements. This application does not issue a government NID.',
  fields: Object.keys(fields), documents: ['photo', 'birth_certificate'], labels
});
const patchSchema = z.object(fields).partial().strict();
const registrationSchema = z.object({ username: text, email: z.email().max(200), password: z.string().min(8).max(72), mobile: fields.mobile }).strict();
const transitions = {
  DRAFT: ['CANCELLED'], SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['ADDITIONAL_INFORMATION_REQUIRED', 'BIOMETRIC_APPOINTMENT_REQUIRED', 'APPROVED_PENDING_ISSUANCE', 'REJECTED'],
  ADDITIONAL_INFORMATION_REQUIRED: ['SUBMITTED'],
  BIOMETRIC_APPOINTMENT_REQUIRED: ['UNDER_REVIEW'],
  APPROVED_PENDING_ISSUANCE: [], REJECTED: [], CANCELLED: []
};
const editable = state => ['DRAFT', 'ADDITIONAL_INFORMATION_REQUIRED'].includes(state);
const fail = (status, code, message = code) => Object.assign(new Error(message), { status, code });
const json = value => typeof value === 'string' ? JSON.parse(value) : value;
module.exports = { NATIONX_DEMO_FIRST_TIME_NID_RULES, fields, labels, patchSchema, registrationSchema, transitions, editable, fail, json };
