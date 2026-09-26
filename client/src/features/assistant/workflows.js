// Only these existing citizen routes can be opened. No model-generated URLs,
// database mutations, or eligibility decisions are accepted by this catalogue.
const definitions = {
  health: ['Health', 'স্বাস্থ্য', 'heart-pulse', 'health hospital medical vaccine vaccination স্বাস্থ্য হাসপাতাল চিকিৎসা টিকা', [
    ['health-card','Health card','স্বাস্থ্য কার্ড','form','/api/health/health-card/my'], ['vaccination','Vaccination','টিকা','form','/api/health/vaccination/my'],
    ['hospitals','Find hospitals','হাসপাতাল খুঁজুন','browse'], ['appointments','Doctor appointment','ডাক্তারের অ্যাপয়েন্টমেন্ট','form','/api/health/appointment/my'],
    ['ambulance','Ambulance','অ্যাম্বুলেন্স','form','/api/health/ambulance/my'], ['complaints','Health complaint','স্বাস্থ্য অভিযোগ','form','/api/health/complaint/my'], ['medicine-identifier','Medicine identifier','ওষুধ শনাক্তকরণ','manual']]],
  agriculture: ['Agriculture','কৃষি','leaf','agriculture farmer crop কৃষি কৃষক ফসল', [
    ['subsidies','Farm subsidy','কৃষি ভর্তুকি','form','/api/agriculture/subsidy/my-history'], ['crop-reports','Crop report','ফসলের প্রতিবেদন','form','/api/agriculture/crop-report/my-reports'],
    ['expert','Ask an expert','কৃষি বিশেষজ্ঞের পরামর্শ','form','/api/agriculture/expert/my-queries'], ['market','Farmer market','কৃষি বাজার','manual','/api/agriculture/market/my-listings'], ['training','Training','কৃষি প্রশিক্ষণ','manual','/api/agriculture/training/my-registrations']]],
  nid: ['National identity','জাতীয় পরিচয়পত্র','id-card','nid national identity এনআইডি পরিচয়পত্র', [
    ['profile','NID profile','এনআইডি প্রোফাইল','form'], ['correction','NID correction','এনআইডি সংশোধন','form','/api/nid/corrections'], ['reissue','Replace lost NID','হারানো এনআইডি','form','/api/nid/reissue'],
    ['smart-card','Smart card','স্মার্ট কার্ড','form','/api/nid/smart-card'], ['address','Change NID address','এনআইডির ঠিকানা পরিবর্তন','form','/api/nid/address-change'],
    ['verification','Verify NID','এনআইডি যাচাই','manual'], ['appointments','Biometric appointment','বায়োমেট্রিক অ্যাপয়েন্টমেন্ট','form','/api/nid/appointments'],
    ['family','Family member','পরিবারের সদস্য','form','/api/nid/family'], ['applications','NID application status','এনআইডি আবেদনের অবস্থা','status','/api/nid/all-applications'], ['information','NID information','এনআইডি তথ্য','browse']]],
  passport: ['Passport','পাসপোর্ট','passport','passport পাসপোর্ট', [
    ['apply','Passport application','পাসপোর্ট আবেদন','form','/api/passport/my-applications'], ['documents','Passport documents','পাসপোর্টের নথি','form'], ['applications','My passports','আমার পাসপোর্ট আবেদন','status','/api/passport/my-applications'],
    ['track','Track passport','পাসপোর্টের অবস্থা','form'], ['fees','Passport fee calculator','পাসপোর্ট ফি হিসাব','form'], ['offices','Passport offices','পাসপোর্ট অফিস','browse'], ['payment','Passport payment demo','পাসপোর্ট পেমেন্ট ডেমো','manual']]],
  water: ['Water','পানি','droplet','water wasa পানি পানির ওয়াসা', [
    ['connection','Water connection','পানির সংযোগ','form','/api/water/connection/my-connections'], ['bill','Water bills','পানির বিল','manual','/api/water/bill/my-bills'],
    ['quality','Water quality','পানির মান','form','/api/water/quality/my-reports'], ['complaints','Water complaint','পানির অভিযোগ','form','/api/water/complaint/my-complaints'], ['projects','Water projects','পানি প্রকল্প','browse']]],
  land: ['Land','ভূমি','map-location-dot','land mutation ভূমি জমি জমির নামজারি', [
    ['records','Land records','জমির রেকর্ড','form','/api/departments/land/records'], ['mutation','Land mutation','নামজারি আবেদন','form','/api/departments/land/applications'],
    ['status','Land application status','নামজারির অবস্থা','status','/api/departments/land/applications'], ['tax','Land tax payment demo','ভূমি কর পেমেন্ট ডেমো','manual']]],
  tax: ['Tax / NBR','কর / এনবিআর','landmark','tax nbr tin vat কর আয়কর টিন ভ্যাট', [
    ['tin','TIN registration','টিন নিবন্ধন','form','/api/tax/tin/status'], ['ereturn','Tax return','আয়কর রিটার্ন','form','/api/tax/returns'], ['calculator','Tax calculator','আয়কর হিসাব','form'],
    ['payments','Tax payments','কর পরিশোধ','manual','/api/tax/payments'], ['challan','Treasury challan','ট্রেজারি চালান','form','/api/tax/challan'], ['vat','VAT registration','ভ্যাট নিবন্ধন','form','/api/tax/vat/status'], ['notices','Tax notices','করের নোটিশ','browse','/api/tax/notices'], ['zones','Tax offices','কর অফিস','browse']]],
  education: ['Education','শিক্ষা','graduation-cap','education exam result stipend শিক্ষা পরীক্ষা ফলাফল উপবৃত্তি', [
    ['results','Exam results','পরীক্ষার ফলাফল','form'], ['stipend','Stipends and grants','উপবৃত্তি ও অনুদান','manual','/api/stipends/my-applications']]]
};
export const ministries = Object.entries(definitions).map(([id,[en,bn,icon,keywords,rows]]) => ({id,en,bn,icon,keywords,services: rows.map(([section,en,bn,kind,statusPath]) => ({ id: `${id}:${section}`, ministry:id, section,en,bn,kind,statusPath, destination:`/${id}.html?section=${section}` }))}));
export const workflows = ministries.flatMap(m => m.services);
export const getWorkflow = id => workflows.find(w => w.id === id);
export const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[০-৯]/g, digit => String('০১২৩৪৫৬৭৮৯'.indexOf(digit))).trim();
export function understand(text, currentMinistry) {
  const q = normalize(text).replace(/এন\s+আই\s+ডি/g,'এনআইডি');
  if (/^(cancel|stop|বাতিল|বন্ধ)( assistant)?$/.test(q)) return { command: 'cancel' };
  if (/^(back|পেছনে|আগের)$/.test(q)) return { command:'back' };
  if (/^(repeat|আবার|আবার বলুন)$/.test(q)) return { command:'repeat' };
  const status = /status|progress|track|অবস্থা|কোথায়|কোথায়|কতদূর/.test(q);
  const named = ministries.filter(m => m.keywords.split(' ').some(word => word.length > 1 && (/[a-z]/.test(word) ? new RegExp(`\\b${word}\\b`).test(q) : word==='কর' ? /(^|\s)কর(ের)?($|\s)/.test(q) : q.includes(word))));
  // "Land tax" belongs to land, not income tax. Ambiguous requests stay choices.
  const ministry = named.some(m=>m.id==='land') && named.every(m=>['land','tax'].includes(m.id)) ? 'land' : named.length === 1 ? named[0].id : named.length ? null : currentMinistry;
  const candidates = workflows.filter(w => !ministry || w.ministry===ministry);
  const matches = candidates.filter(w => q.includes(normalize(w.en)) || q.includes(normalize(w.bn)) || (w.section.length > 3 && new RegExp(`\\b${w.section}\\b`).test(q)));
  return { command:status?'status':'choose', ministry, workflow:matches.length===1?matches[0]:null };
}
