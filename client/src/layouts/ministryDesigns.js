// Titles, palettes and service navigation from the original public ministry pages.
export const ministryDesigns = {
  health: { title: 'Ministry of Health & Family Welfare', bn: 'স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়', subtitle: 'সুস্থ জাতি, সমৃদ্ধ দেশ — Healthy Nation, Prosperous Country', icon: 'heartbeat', prefix: 'health', accent: '#006a4e', light: '#8ce2bb', actions: ['health-card', 'vaccination', 'hospitals', 'appointments', 'medicine-identifier'] },
  agriculture: { title: 'Ministry of Agriculture', bn: 'কৃষি মন্ত্রণালয়', subtitle: 'Empowering Farmers, Feeding the Nation', icon: 'leaf', prefix: 'agri', accent: '#006a4e', light: '#8ce2bb', actions: ['subsidies', 'crop-reports', 'expert', 'market', 'training'] },
  nid: { title: 'NID Wing', bn: 'জাতীয় পরিচয় নিবন্ধন অনুবিভাগ — বাংলাদেশ নির্বাচন কমিশন', subtitle: 'National Identity Registration Wing — Election Commission of Bangladesh', icon: 'id-card', prefix: 'nid', accent: '#006a4e', light: '#8ce2bb', actions: ['profile', 'correction', 'reissue', 'smart-card', 'verification', 'applications'] },
  passport: { title: 'e-Passport Services', bn: 'ইমিগ্রেশন ও পাসপোর্ট অধিদপ্তর', subtitle: 'Department of Immigration & Passports (DIP)', icon: 'passport', prefix: 'pp', accent: '#006a4e', light: '#8ce2bb', actions: ['apply', 'track', 'fees', 'offices'] },
  water: { title: 'পানি সম্পদ মন্ত্রণালয়', bn: 'Ministry of Water Resources', subtitle: 'Water Supply, Irrigation & Flood Management', icon: 'droplet', prefix: 'water', accent: '#006a4e', light: '#8ce2bb', actions: ['connection', 'bill', 'quality', 'complaints', 'projects'] },
  land: { title: 'Land Ministry Services', bn: 'ভূমি মন্ত্রণালয়', subtitle: 'Digital Land Services — ভূমি সেবা এখন হাতের মুঠোয়', icon: 'map-marked-alt', prefix: 'land', accent: '#006a4e', light: '#8ce2bb', actions: ['records', 'mutation', 'status', 'tax'] },
  tax: { title: 'NBR Tax Portal', bn: 'জাতীয় রাজস্ব বোর্ড', subtitle: 'National Board of Revenue — Taxpayer Services', icon: 'landmark', prefix: 'tax', accent: '#006a4e', light: '#8ce2bb', actions: ['tin', 'ereturn', 'calculator', 'payments', 'vat', 'challan'] },
  education: { title: 'Education Services', bn: 'শিক্ষা মন্ত্রণালয়', subtitle: 'Results, Admissions, and Grants', icon: 'graduation-cap', prefix: 'edu', accent: '#006a4e', light: '#8ce2bb', actions: [] }
};

const services = {
  overview: ['home', 'Overview', 'Your services at a glance'],
  dashboard: ['home', 'Tax dashboard', 'Your tax services at a glance'],
  'health-card': ['id-card-alt', 'Digital Health Card', 'স্বাস্থ্য কার্ডের জন্য আবেদন করুন'],
  vaccination: ['syringe', 'Vaccination', 'টিকাদান কর্মসূচিতে নিবন্ধন করুন'],
  hospitals: ['hospital', 'Find Hospitals', 'সরকারি হাসপাতাল ও ক্লিনিক খুঁজুন'],
  appointments: ['calendar-check', 'Appointments', 'Schedule and manage your appointments'],
  ambulance: ['ambulance', 'Ambulance', 'Request an ambulance service'],
  complaints: ['exclamation-triangle', 'Complaints', 'Submit and track your service complaints'],
  'medicine-identifier': ['pills', 'Medicine Identifier', 'Scan medicine packaging or a prescription'],
  subsidies: ['hand-holding-usd', 'Subsidies', 'কৃষি ভর্তুকির জন্য আবেদন করুন'],
  'crop-reports': ['wheat-awn', 'Crop Reports', 'ফসল উৎপাদনের তথ্য জমা দিন'],
  expert: ['user-tie', 'Expert Q&A', 'কৃষি বিশেষজ্ঞের পরামর্শ নিন'],
  market: ['store', 'Farmer Market', 'কৃষি পণ্য ক্রয়-বিক্রয়'],
  training: ['chalkboard-teacher', 'Training Programs', 'কৃষি প্রশিক্ষণে অংশ নিন'],
  profile: ['user', 'My NID Profile', 'View and update your identity profile'],
  correction: ['edit', 'NID Correction', 'জাতীয় পরিচয়পত্র সংশোধন'],
  reissue: ['redo-alt', 'NID Re-issue', 'হারানো বা ক্ষতিগ্রস্ত পরিচয়পত্র পুনঃইস্যু'],
  'smart-card': ['microchip', 'Smart NID Card', 'স্মার্ট জাতীয় পরিচয়পত্রের আবেদন'],
  address: ['map-marker-alt', 'Address Change', 'Update your registered address'],
  verification: ['check-circle', 'NID Verification', 'জাতীয় পরিচয়পত্র যাচাই'],
  family: ['users', 'Family Records', 'Manage your family information'],
  applications: ['folder-open', 'My Applications', 'View applications and their current status'],
  information: ['info-circle', 'Information', 'Service information and collection centers'],
  apply: ['file-circle-plus', 'Apply for e-Passport', 'Submit a new passport application'],
  documents: ['file-upload', 'Documents', 'Upload supporting application documents'],
  track: ['magnifying-glass-location', 'Track Application', 'Check the progress of your passport'],
  fees: ['calculator', 'Fee Calculator', 'View passport fees and delivery options'],
  offices: ['building-columns', 'Passport Offices', 'Find your nearest passport office'],
  payment: ['credit-card', 'Payment', 'Review your application payment'],
  connection: ['faucet-drip', 'Water Connection', 'পানির সংযোগের জন্য আবেদন করুন'],
  bill: ['file-invoice-dollar', 'Bill Payment', 'পানির বিল দেখুন ও পরিশোধ করুন'],
  quality: ['flask', 'Water Quality', 'পানির মান পরীক্ষার রিপোর্ট'],
  projects: ['project-diagram', 'Water Projects', 'চলমান পানি উন্নয়ন প্রকল্পসমূহ'],
  records: ['folder-open', 'Land Records', 'View and verify your land records'],
  mutation: ['file-signature', 'e-Mutation', 'নামজারি আবেদন করুন'],
  status: ['search-location', 'Application Status', 'Track your mutation application'],
  tax: ['coins', 'Land Development Tax', 'ভূমি উন্নয়ন কর'],
  tin: ['id-card', 'TIN Registration', 'Register your taxpayer identification number'],
  ereturn: ['file-invoice', 'e-Return Filing', 'Submit your income tax return'],
  calculator: ['calculator', 'Tax Calculator', 'Estimate your income tax'],
  payments: ['credit-card', 'Tax Payments', 'Review your tax payments'],
  challan: ['receipt', 'Treasury Challan', 'Manage treasury challans'],
  vat: ['building', 'VAT / BIN Registration', 'Register your business for VAT'],
  notices: ['bell', 'Notices', 'View tax notices and updates'],
  zones: ['map-location-dot', 'Tax Zones', 'Find your tax office'],
  results: ['poll', 'Exam Results', 'Check JSC, SSC and HSC results'],
  stipend: ['hand-holding-usd', 'Stipends & Grants', 'Apply for educational grants and stipends']
};

export function ministryService(section) {
  const id = typeof section === 'string' ? section : section.id;
  const [icon, label, description] = services[id] || ['circle', id, ''];
  return { id, icon, label, description };
}
