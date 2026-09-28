'use strict';
const { z } = require('zod');

const plainText = (max = 200) => z.string().trim().min(1).max(max)
  .refine(value => !/[<>\u0000-\u001f]/.test(value), 'Use plain text without markup.');
const optionalText = (max = 200) => plainText(max).optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
    && parsed < new Date() && parsed.getUTCFullYear() >= 1900;
}, 'Enter a valid past birth date.');
const locationId = z.coerce.number().int().positive();
const identityNumber = z.string().trim().regex(/^\d{10}$|^\d{13}$|^\d{17}$/,
  'Use a 10, 13, or 17 digit identity number.');

const requiredFields = {
  name_bn: plainText(), name_en: plainText(), father_name_bn: plainText(), mother_name_bn: plainText(),
  date_of_birth: date,
  birth_registration_number: z.string().trim().regex(/^\d{17}$/, 'Birth registration number must contain 17 digits.'),
  birth_place: plainText(120),
  gender: z.enum(['Male', 'Female', 'Hijra', 'Other']),
  marital_status: z.enum(['Unmarried', 'Married', 'Divorced', 'Widow', 'Widower']),
  education: plainText(100), occupation: plainText(100),
  mobile: z.string().trim().regex(/^(?:\+?88)?01\d{9}$/, 'Enter a valid Bangladesh mobile number.'),
  present_division_id: locationId, present_district_id: locationId, present_upazila_id: locationId,
  present_address: plainText(500), present_post_office: plainText(100),
  present_post_code: z.string().trim().regex(/^\d{4}$/, 'Post code must contain 4 digits.'),
  permanent_division_id: locationId, permanent_district_id: locationId, permanent_upazila_id: locationId,
  permanent_address: plainText(500), permanent_post_office: plainText(100),
  permanent_post_code: z.string().trim().regex(/^\d{4}$/, 'Post code must contain 4 digits.')
};

const optionalFields = {
  father_nid: identityNumber.optional(),
  father_death_year: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
  mother_nid: identityNumber.optional(),
  mother_death_year: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
  spouse_name_bn: optionalText(), spouse_nid: identityNumber.optional(),
  spouse_death_year: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
  disability: z.enum(['None', 'Visual', 'Physical', 'Hearing', 'Speech', 'Other']).optional(),
  identification_mark: optionalText(),
  blood_group: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']).optional(),
  present_ward: optionalText(30), present_village: optionalText(), present_road: optionalText(100), present_house: optionalText(100),
  permanent_ward: optionalText(30), permanent_village: optionalText(), permanent_road: optionalText(100), permanent_house: optionalText(100)
};

const fields = { ...requiredFields, ...optionalFields };
const labels = {
  name_bn: ['আপনার নাম বাংলায় লিখুন।', 'Name in Bangla'], name_en: ['আপনার নাম ইংরেজিতে লিখুন।', 'Name in English'],
  father_name_bn: ['আপনার পিতার নাম বাংলায় লিখুন।', 'Father’s name in Bangla'], father_nid: ['পিতার NID নম্বর লিখুন, প্রযোজ্য হলে।', 'Father’s NID number (if applicable)'],
  father_death_year: ['পিতা মৃত হলে মৃত্যুর সাল লিখুন।', 'Father’s year of death (if applicable)'],
  mother_name_bn: ['আপনার মাতার নাম বাংলায় লিখুন।', 'Mother’s name in Bangla'], mother_nid: ['মাতার NID নম্বর লিখুন, প্রযোজ্য হলে।', 'Mother’s NID number (if applicable)'],
  mother_death_year: ['মাতা মৃত হলে মৃত্যুর সাল লিখুন।', 'Mother’s year of death (if applicable)'],
  spouse_name_bn: ['স্বামী বা স্ত্রীর নাম লিখুন, প্রযোজ্য হলে।', 'Spouse name (if applicable)'], spouse_nid: ['স্বামী বা স্ত্রীর NID নম্বর লিখুন, প্রযোজ্য হলে।', 'Spouse NID number (if applicable)'],
  spouse_death_year: ['স্বামী বা স্ত্রী মৃত হলে মৃত্যুর সাল লিখুন।', 'Spouse year of death (if applicable)'],
  birth_registration_number: ['১৭ সংখ্যার জন্ম নিবন্ধন নম্বর লিখুন।', '17-digit birth registration number'],
  date_of_birth: ['আপনার জন্মতারিখ লিখুন।', 'Date of birth (YYYY-MM-DD)'], birth_place: ['জন্মস্থান জেলা লিখুন।', 'Birthplace district'],
  gender: ['আপনার লিঙ্গ নির্বাচন করুন।', 'Gender'], marital_status: ['আপনার বৈবাহিক অবস্থা নির্বাচন করুন।', 'Marital status'],
  education: ['আপনার শিক্ষাগত যোগ্যতা নির্বাচন করুন।', 'Educational qualification'], occupation: ['আপনার পেশা নির্বাচন করুন।', 'Occupation'],
  disability: ['প্রতিবন্ধিতার ধরন নির্বাচন করুন, প্রযোজ্য হলে।', 'Disability type (if applicable)'],
  identification_mark: ['দৃশ্যমান শনাক্তকরণ চিহ্ন লিখুন, প্রযোজ্য হলে।', 'Visible identification mark (if applicable)'], blood_group: ['রক্তের গ্রুপ নির্বাচন করুন, জানা থাকলে।', 'Blood group (if known)'],
  mobile: ['আপনার মোবাইল নম্বর লিখুন।', 'Mobile number'],
  present_division_id: ['বর্তমান ঠিকানার বিভাগ নির্বাচন করুন।', 'Present address division'], present_district_id: ['বর্তমান ঠিকানার জেলা নির্বাচন করুন।', 'Present address district'],
  present_upazila_id: ['বর্তমান ঠিকানার উপজেলা বা থানা নির্বাচন করুন।', 'Present address upazila/thana'], present_address: ['বর্তমান ঠিকানার এলাকা লিখুন।', 'Present address details'],
  present_post_office: ['বর্তমান ঠিকানার ডাকঘর লিখুন।', 'Present post office'], present_post_code: ['বর্তমান ঠিকানার পোস্ট কোড লিখুন।', 'Present post code'],
  present_ward: ['বর্তমান ওয়ার্ড নম্বর লিখুন।', 'Present ward'], present_village: ['বর্তমান গ্রাম বা মহল্লা লিখুন।', 'Present village/neighbourhood'],
  present_road: ['বর্তমান রাস্তার নাম বা নম্বর লিখুন।', 'Present road'], present_house: ['বর্তমান বাড়ির নাম বা নম্বর লিখুন।', 'Present house'],
  permanent_division_id: ['স্থায়ী ঠিকানার বিভাগ নির্বাচন করুন।', 'Permanent address division'], permanent_district_id: ['স্থায়ী ঠিকানার জেলা নির্বাচন করুন।', 'Permanent address district'],
  permanent_upazila_id: ['স্থায়ী ঠিকানার উপজেলা বা থানা নির্বাচন করুন।', 'Permanent address upazila/thana'], permanent_address: ['স্থায়ী ঠিকানার এলাকা লিখুন।', 'Permanent address details'],
  permanent_post_office: ['স্থায়ী ঠিকানার ডাকঘর লিখুন।', 'Permanent post office'], permanent_post_code: ['স্থায়ী ঠিকানার পোস্ট কোড লিখুন।', 'Permanent post code'],
  permanent_ward: ['স্থায়ী ওয়ার্ড নম্বর লিখুন।', 'Permanent ward'], permanent_village: ['স্থায়ী গ্রাম বা মহল্লা লিখুন।', 'Permanent village/neighbourhood'],
  permanent_road: ['স্থায়ী রাস্তার নাম বা নম্বর লিখুন।', 'Permanent road'], permanent_house: ['স্থায়ী বাড়ির নাম বা নম্বর লিখুন।', 'Permanent house']
};

const options = {
  gender: ['Male', 'Female', 'Hijra', 'Other'], marital_status: ['Unmarried', 'Married', 'Divorced', 'Widow', 'Widower'],
  education: ['No formal education', 'Primary', 'JSC or equivalent', 'SSC or equivalent', 'HSC or equivalent', 'Diploma', 'Graduate', 'Postgraduate', 'Other'],
  occupation: ['Student', 'Agriculture', 'Service', 'Business', 'Homemaker', 'Day labourer', 'Retired', 'Unemployed', 'Other'],
  disability: ['None', 'Visual', 'Physical', 'Hearing', 'Speech', 'Other'], blood_group: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']
};
const fieldTypes = {
  date_of_birth: 'date', birth_registration_number: 'digits', mobile: 'tel', father_nid: 'digits', mother_nid: 'digits', spouse_nid: 'digits',
  father_death_year: 'year', mother_death_year: 'year', spouse_death_year: 'year', present_post_code: 'digits', permanent_post_code: 'digits',
  present_division_id: 'location', present_district_id: 'location', present_upazila_id: 'location', permanent_division_id: 'location', permanent_district_id: 'location', permanent_upazila_id: 'location'
};

const NATIONX_DEMO_FIRST_TIME_NID_RULES = Object.freeze({
  code: 'NATIONX_DEMO_FIRST_TIME_NID_RULES',
  notice: 'NationX stores this as a self-declared application draft. It is not Election Commission verification and does not issue a government NID.',
  fields: Object.keys(requiredFields), optional_fields: Object.keys(optionalFields), documents: ['photo', 'birth_certificate'], labels, options, field_types: fieldTypes
});
const patchSchema = z.object(fields).partial().strict();
const applicationProfileSchema = z.object(fields).strict();
const registrationSchema = z.object({
  username: plainText(), email: z.email().max(200), password: z.string().min(8).max(72), mobile: requiredFields.mobile,
  profile: applicationProfileSchema.optional()
}).strict().superRefine((value, context) => {
  if (value.profile && value.profile.mobile !== value.mobile) context.addIssue({ code: 'custom', path: ['profile', 'mobile'], message: 'Profile and account mobile numbers must match.' });
});
const transitions = {
  DRAFT: ['CANCELLED'], SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['ADDITIONAL_INFORMATION_REQUIRED', 'BIOMETRIC_APPOINTMENT_REQUIRED', 'APPROVED_PENDING_ISSUANCE', 'REJECTED'],
  ADDITIONAL_INFORMATION_REQUIRED: ['SUBMITTED'], BIOMETRIC_APPOINTMENT_REQUIRED: ['UNDER_REVIEW'], APPROVED_PENDING_ISSUANCE: [], REJECTED: [], CANCELLED: []
};
const editable = state => ['DRAFT', 'ADDITIONAL_INFORMATION_REQUIRED'].includes(state);
const fail = (status, code, message = code) => Object.assign(new Error(message), { status, code });
const json = value => typeof value === 'string' ? JSON.parse(value) : value;
module.exports = { NATIONX_DEMO_FIRST_TIME_NID_RULES, fields, labels, options, patchSchema, registrationSchema, transitions, editable, fail, json };
