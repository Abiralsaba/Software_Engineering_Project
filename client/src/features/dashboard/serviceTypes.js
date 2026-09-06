export const serviceTypes = {
  identity: [
    ['nid_correction', 'NID Correction'],
    ['birth_cert_correction', 'Birth Certificate Correction'],
    ['death_cert_correction', 'Death Certificate Correction'],
    ['character_certificate', 'Character Certificate'],
    ['income_certificate', 'Income Certificate']
  ],
  education: [
    ['education_sss', 'SSC Certificate'],
    ['education_hsc', 'HSC Certificate'],
    ['education_jsc', 'JSC Certificate'],
    ['education_university_verification', 'University Certificate Verification'],
    ['education_transcript', 'Transcript Correction']
  ],
  transport: [
    ['transport_driving_lic_correction', 'Driving Licence Correction'],
    ['transport_driving_lic_renew', 'Driving Licence Renewal'],
    ['transport_vehicle_reg_correction', 'Vehicle Registration Correction'],
    ['transport_ownership_transfer', 'Vehicle Ownership Transfer']
  ],
  immigration: [
    ['immigration_visa', 'Visa Related Problem'],
    ['immigration_passport_correction', 'Passport Correction'],
    ['immigration_emigration_clearance', 'Emigration Clearance']
  ],
  business: [
    ['business_trade_lic', 'Trade Licence'],
    ['business_tin_certificate', 'TIN Certificate'],
    ['business_vat_reg', 'VAT Registration'],
    ['business_company_reg', 'Company Registration'],
    ['business_import_export', 'Import/Export']
  ],
  legal: [
    ['legal_gd', 'General Diary (GD)'],
    ['legal_case', 'Case Filing'],
    ['legal_complain', 'File Complaint']
  ]
};

export const serviceCategories = [
  ['identity', 'Identity & Citizenship'],
  ['education', 'Education'],
  ['transport', 'Transport'],
  ['immigration', 'Immigration'],
  ['business', 'Business & Tax'],
  ['legal', 'Legal & Police']
];
