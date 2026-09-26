// Operates only on the rendered, validated citizen form. Never synthesizes a
// request payload, changes hidden fields, checks consent, or submits a form.
import { normalize } from './workflows.js';
const bnLabels={full_name:'পূর্ণ নাম',full_name_en:'ইংরেজিতে পূর্ণ নাম',name_en:'ইংরেজিতে নাম',name_bn:'বাংলায় নাম',father_name:'পিতার নাম',mother_name:'মাতার নাম',father_name_en:'ইংরেজিতে পিতার নাম',mother_name_en:'ইংরেজিতে মাতার নাম',father_name_bn:'বাংলায় পিতার নাম',mother_name_bn:'বাংলায় মাতার নাম',holder_name:'সংযোগগ্রহীতার নাম',farmer_name:'কৃষকের নাম',applicant_name:'আবেদনকারীর নাম',nid:'জাতীয় পরিচয়পত্র নম্বর',nid_number:'জাতীয় পরিচয়পত্র নম্বর',applicant_nid:'আবেদনকারীর জাতীয় পরিচয়পত্র নম্বর',date_of_birth:'জন্মতারিখ (বছর-মাস-দিন)',dob:'জন্মতারিখ (বছর-মাস-দিন)',gender:'লিঙ্গ',blood_group:'রক্তের গ্রুপ',mobile:'মোবাইল নম্বর',mobile_primary:'প্রধান মোবাইল নম্বর',mobile_number:'মোবাইল নম্বর',phone:'ফোন নম্বর',email:'ইমেইল',address:'ঠিকানা',present_address:'বর্তমান ঠিকানা',division:'বিভাগ',district:'জেলা',upazila:'উপজেলা',division_id:'বিভাগ',district_id:'জেলা',upazila_id:'উপজেলা',religion:'ধর্ম',occupation:'পেশা',nationality:'জাতীয়তা',marital_status:'বৈবাহিক অবস্থা',emergency_contact:'জরুরি যোগাযোগ',emergency_phone:'জরুরি ফোন নম্বর',allergies:'অ্যালার্জি',chronic_diseases:'দীর্ঘমেয়াদি রোগ',disability:'প্রতিবন্ধিতার তথ্য',reason:'কারণ',details:'বিস্তারিত',description:'বিবরণ',question:'আপনার প্রশ্ন',category:'বিভাগ বা ধরন',amount:'টাকার পরিমাণ',amount_requested:'চাওয়া অর্থের পরিমাণ',crop_name:'ফসলের নাম',crop_type:'ফসলের ধরন',subsidy_type:'ভর্তুকির ধরন',land_size_acres:'জমির পরিমাণ (একর)',land_ownership:'জমির মালিকানার ধরন',bank_name:'ব্যাংকের নাম',bank_branch:'ব্যাংকের শাখা',bank_account:'ব্যাংক হিসাব নম্বর',khatian_no:'খতিয়ান নম্বর',dag_no:'দাগ নম্বর',connection_type:'সংযোগের ধরন',pipe_size:'পাইপের আকার',wasa_region:'ওয়াসা অঞ্চল',examType:'পরীক্ষার ধরন',examYear:'পরীক্ষার বছর',rollNumber:'রোল নম্বর',photo:'ছবি',signature:'স্বাক্ষর',documents:'প্রয়োজনীয় নথি'};
const spokenNumbers = new Map(Object.entries({
  'শূন্য':0,'জিরো':0,'zero':0,'এক':1,'একটা':1,'one':1,'দুই':2,'two':2,'তিন':3,'three':3,'চার':4,'four':4,'পাঁচ':5,'five':5,
  'ছয়':6,'ছয়':6,'six':6,'সাত':7,'seven':7,'আট':8,'eight':8,'নয়':9,'নয়':9,'nine':9,'দশ':10,'ten':10,'এগারো':11,'eleven':11,
  'বারো':12,'twelve':12,'তেরো':13,'thirteen':13,'চৌদ্দ':14,'fourteen':14,'পনেরো':15,'fifteen':15,'ষোল':16,'sixteen':16,
  'সতেরো':17,'seventeen':17,'আঠারো':18,'eighteen':18,'উনিশ':19,'nineteen':19,'বিশ':20,'twenty':20,'ত্রিশ':30,'thirty':30,
  'চল্লিশ':40,'forty':40,'পঞ্চাশ':50,'fifty':50,'ষাট':60,'sixty':60,'সত্তর':70,'seventy':70,'আশি':80,'eighty':80,
  'নব্বই':90,'ninety':90,'একশ':100,'একশো':100,'hundred':100
}));
const optionAliases={aman:['আমন'],aus:['আউশ'],boro:['বোরো'],rainfed:['বৃষ্টিনির্ভর'],male:['পুরুষ'],female:['নারী','মহিলা'],other:['অন্যান্য']};
const numberUnits=/\s*(?:একর|একরের|acre|acres|টাকা|taka|টন|ton|tons|দিন|day|days|বার|times|টি|টা|জন|people|percent|শতাংশ)\s*$/i;
const spokenValue=answer=>normalize(answer).replace(/[।.!?,;:\s]+$/g,'').trim();

export function spokenNumber(answer) {
  const value=spokenValue(answer).replace(numberUnits,'').trim();
  if (/^\d+(?:[.,]\d+)?$/.test(value)) return value.replace(',','.');
  if (spokenNumbers.has(value)) return String(spokenNumbers.get(value));
  const [whole, fraction]=value.split(/\s+(?:দশমিক|point)\s+/);
  if (fraction && spokenNumbers.has(whole)) {
    const digits=fraction.split(/\s+/).map(word=>spokenNumbers.get(word));
    if(digits.length<=4 && digits.every(digit=>Number.isInteger(digit)&&digit>=0&&digit<=9)) return `${spokenNumbers.get(whole)}.${digits.join('')}`;
  }
  return null;
}

export function optionForAnswer(field, answer) {
  if(!field?.options?.length)return null;
  const value=spokenValue(answer).replace(/^(?:বিকল্প|option|number|নম্বর)\s+/i,'');
  const number=spokenNumber(value);
  const direct=field.options.find(option=>spokenValue(option.value)===value||spokenValue(option.label)===value);
  if(direct)return direct;
  const bilingual=field.options.filter(option=>option.label.split(/[()/]/).map(spokenValue).includes(value));
  if(bilingual.length===1)return bilingual[0];
  const alias=field.options.find(option=>(optionAliases[normalize(option.value)]||[]).some(word=>normalize(word)===value));
  if(alias)return alias;
  const index=number&&/^\d+$/.test(number)?Number(number)-1:-1;
  return index>=0&&index<field.options.length?field.options[index]:null;
}

export function plausibleTranscript(field, transcript) {
  const value=String(transcript||'').trim();
  if(!value)return false;
  if(field?.el?.tagName==='SELECT')return Boolean(optionForAnswer(field,value));
  if(field?.type==='number')return spokenNumber(value)!==null;
  if(field?.type==='date')return /^\d{4}-\d{2}-\d{2}$/.test(normalize(value));
  if(field && /nid|mobile|phone|roll|post.?code/i.test(field.key))return /^\+?\d(?:[\d\s-]*\d)?$/.test(normalize(value));
  if(field?.el?.tagName==='INPUT' && ['text','search'].includes(field.type) && !/description|details|question|reason|address/i.test(field.key)) {
    return value.split(/\s+/).length<=8 && value.length<=90;
  }
  return true;
}
export function formFields(form) {
  if (!form?.isConnected) return [];
  const controls=[...form.elements];
  // Keep disabled geography selects in the guide while their dependent choices
  // load. Otherwise choosing a division can look like the end of the form.
  const waitingLocation=el=>el.tagName==='SELECT'&&/division|district|upazila|^(?:div|dist|upa)id$/i.test(el.name);
  return controls.filter(el => ['INPUT','SELECT','TEXTAREA'].includes(el.tagName) && !['hidden','submit','button','reset','password'].includes(el.type) && (!el.disabled||waitingLocation(el)) && !el.closest('[hidden]') && el.getAttribute('aria-hidden') !== 'true' && (el.type!=='radio'||controls.find(other=>other.type==='radio'&&other.name===el.name)===el)).map((el,index) => {
    const label = el.labels?.[0];
    const name = label ? [...label.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join(' ').trim() : '';
    return {el,key:el.name || el.id || `field-${index}`,label:name || el.getAttribute('aria-label') || el.name || 'Field', bnLabel:bnLabels[el.name] || name || el.getAttribute('aria-label') || el.name, type:el.type, required:el.required,
      value: el.type==='file' ? [...el.files].map(f=>f.name).join(', ') : el.type==='radio' ? (controls.find(other=>other.type==='radio'&&other.name===el.name&&other.checked)?.value||'') : el.type==='checkbox' ? (el.checked?'Yes':'') : el.value,
      options:el.tagName==='SELECT' ? [...el.options].filter(o=>o.value&&!o.disabled).map(o=>({value:o.value,label:o.textContent.trim()})) : el.list ? [...el.list.options].filter(o=>o.value).map(o=>({value:o.value,label:o.label||o.value})) : []};
  });
}
export function writeField(field, answer) {
  const {el}=field;
  if (!el.isConnected || el.disabled || ['file','checkbox','radio','password','hidden'].includes(el.type)) throw new Error('Complete this field directly in the service form.');
  let value = String(answer).trim();
  if (el.tagName==='SELECT') {
    const match=optionForAnswer(field,value);
    if (!match) throw new Error('Choose one of the available options below, or say its number.');
    value=match.value;
  } else if (el.type==='number') {
    value=spokenNumber(value);
    if(value===null)throw new Error('Enter a number, such as 10, or say দশ. Nothing was filled.');
  } else if (['date','tel'].includes(el.type) || /nid|mobile|phone|roll|postcode/.test(el.name)) value=normalize(value);
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
