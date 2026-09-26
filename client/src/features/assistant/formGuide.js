// Operates only on the rendered, validated citizen form. Never synthesizes a
// request payload, changes hidden fields, checks consent, or submits a form.
import { normalize } from './workflows.js';
const bnLabels={full_name:'পূর্ণ নাম',full_name_en:'ইংরেজিতে পূর্ণ নাম',name_en:'ইংরেজিতে নাম',name_bn:'বাংলায় নাম',father_name:'পিতার নাম',mother_name:'মাতার নাম',father_name_en:'ইংরেজিতে পিতার নাম',mother_name_en:'ইংরেজিতে মাতার নাম',father_name_bn:'বাংলায় পিতার নাম',mother_name_bn:'বাংলায় মাতার নাম',holder_name:'সংযোগগ্রহীতার নাম',farmer_name:'কৃষকের নাম',applicant_name:'আবেদনকারীর নাম',nid:'জাতীয় পরিচয়পত্র নম্বর',nid_number:'জাতীয় পরিচয়পত্র নম্বর',applicant_nid:'আবেদনকারীর জাতীয় পরিচয়পত্র নম্বর',date_of_birth:'জন্মতারিখ (বছর-মাস-দিন)',dob:'জন্মতারিখ (বছর-মাস-দিন)',gender:'লিঙ্গ',blood_group:'রক্তের গ্রুপ',mobile:'মোবাইল নম্বর',mobile_primary:'প্রধান মোবাইল নম্বর',mobile_number:'মোবাইল নম্বর',phone:'ফোন নম্বর',email:'ইমেইল',address:'ঠিকানা',present_address:'বর্তমান ঠিকানা',division:'বিভাগ',district:'জেলা',upazila:'উপজেলা',division_id:'বিভাগ',district_id:'জেলা',upazila_id:'উপজেলা',religion:'ধর্ম',occupation:'পেশা',nationality:'জাতীয়তা',marital_status:'বৈবাহিক অবস্থা',emergency_contact:'জরুরি যোগাযোগ',emergency_phone:'জরুরি ফোন নম্বর',allergies:'অ্যালার্জি',chronic_diseases:'দীর্ঘমেয়াদি রোগ',disability:'প্রতিবন্ধিতার তথ্য',reason:'কারণ',details:'বিস্তারিত',description:'বিবরণ',question:'আপনার প্রশ্ন',category:'বিভাগ বা ধরন',amount:'টাকার পরিমাণ',amount_requested:'চাওয়া অর্থের পরিমাণ',crop_name:'ফসলের নাম',crop_type:'ফসলের ধরন',subsidy_type:'ভর্তুকির ধরন',land_size_acres:'জমির পরিমাণ (একর)',land_ownership:'জমির মালিকানার ধরন',bank_name:'ব্যাংকের নাম',bank_branch:'ব্যাংকের শাখা',bank_account:'ব্যাংক হিসাব নম্বর',khatian_no:'খতিয়ান নম্বর',dag_no:'দাগ নম্বর',connection_type:'সংযোগের ধরন',pipe_size:'পাইপের আকার',wasa_region:'ওয়াসা অঞ্চল',examType:'পরীক্ষার ধরন',examYear:'পরীক্ষার বছর',rollNumber:'রোল নম্বর',photo:'ছবি',signature:'স্বাক্ষর',documents:'প্রয়োজনীয় নথি'};
export function formFields(form) {
  if (!form?.isConnected) return [];
  const controls=[...form.elements];
  return controls.filter(el => ['INPUT','SELECT','TEXTAREA'].includes(el.tagName) && !['hidden','submit','button','reset','password'].includes(el.type) && !el.disabled && !el.closest('[hidden]') && el.getAttribute('aria-hidden') !== 'true' && (el.type!=='radio'||controls.find(other=>other.type==='radio'&&other.name===el.name)===el)).map((el,index) => {
    const label = el.labels?.[0];
    const name = label ? [...label.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join(' ').trim() : '';
    return {el,key:el.name || el.id || `field-${index}`,label:name || el.getAttribute('aria-label') || el.name || 'Field', bnLabel:bnLabels[el.name] || name || el.getAttribute('aria-label') || el.name, type:el.type, required:el.required,
      value: el.type==='file' ? [...el.files].map(f=>f.name).join(', ') : el.type==='radio' ? (controls.find(other=>other.type==='radio'&&other.name===el.name&&other.checked)?.value||'') : el.type==='checkbox' ? (el.checked?'Yes':'') : el.value,
      options:el.tagName==='SELECT' ? [...el.options].filter(o=>o.value&&!o.disabled).map(o=>({value:o.value,label:o.textContent})) : []};
  });
}
export function writeField(field, answer) {
  const {el}=field;
  if (!el.isConnected || el.disabled || ['file','checkbox','radio','password','hidden'].includes(el.type)) throw new Error('Complete this field directly in the service form.');
  let value = String(answer).trim();
  if (el.tagName==='SELECT') {
    const aliases={'পুরুষ':'male','নারী':'female','মহিলা':'female','অন্যান্য':'other'};
    const candidate=aliases[normalize(value)]||normalize(value);
    const match=field.options.find(o=>normalize(o.value)===candidate||normalize(o.label)===candidate);
    if (!match) throw new Error('Choose one of the available options.');
    value=match.value;
  } else if (['number','date','tel'].includes(el.type) || /nid|mobile|phone|roll|postcode/.test(el.name)) value=normalize(value);
  const previous=el.value;
  const prototype=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,value);
  if ((value && !el.value) || (el.maxLength>=0&&value.length>el.maxLength) || (el.minLength>0&&value.length>0&&value.length<el.minLength)) {
    Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,previous);
    throw new Error(el.type==='date'?'Use a valid date in YYYY-MM-DD format.':'Please check the value and its length.');
  }
  if (!el.checkValidity()) { const message=el.validationMessage; Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,previous); throw new Error(message); }
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
}
export function prefillProfile(form, profile={}) {
  const map={ full_name:'name', full_name_en:'name', name_en:'name', holder_name:'name', farmer_name:'name', applicant_name:'name', nid:'nid', nid_number:'nid', applicant_nid:'nid', mobile:'mobile', mobile_primary:'mobile', mobile_number:'mobile', phone:'mobile', email:'email', date_of_birth:'dob', dob:'dob', gender:'gender', address:'address', present_address:'address' };
  const filled=[];
  for(const field of formFields(form)) {
    const key=map[field.el.name];
    if(field.value || !key || !profile[key] || ['file','checkbox','radio'].includes(field.type)) continue;
    let value=String(profile[key]);
    if(key==='dob') value=value.slice(0,10);
    // Do not put a Bangla name in an explicitly English-name field.
    if(field.el.name.endsWith('_en') && /[\u0980-\u09ff]/.test(value)) continue;
    try { writeField(field,value); filled.push(field.key); } catch { /* Ask rather than guess. */ }
  }
  return filled;
}
export function findServiceForms() {
  return [...document.querySelectorAll('main form')].filter(form => !form.closest('.nx-assistant,.nx-demo-payment') && form.getClientRects().length);
}
