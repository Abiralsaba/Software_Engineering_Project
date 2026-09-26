import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api.js';
import { ministries, workflows, getWorkflow, understand } from './workflows.js';
import { findServiceForms, formFields, prefillProfile, writeField } from './formGuide.js';
import { useSpeech } from './useSpeech.js';
import { useVoiceInput } from './useVoiceInput.js';
import './citizen-guide.css';

export const GUIDE_ROUTE_KEY='nationx-guide-route';
function pendingRoute() {
  try { const value=JSON.parse(sessionStorage.getItem(GUIDE_ROUTE_KEY)); return value?.expires>Date.now()?getWorkflow(value.id):null; } catch { return null; }
}
const formTitle=form=>form.closest('section')?.querySelector('h2,h3')?.textContent || form.querySelector('button[type="submit"],button:not([type])')?.textContent || 'Service form';
const controlKinds=new Set(['file','checkbox','radio']);
function preferences(){try{return JSON.parse(sessionStorage.getItem('nationx-guide-preferences'))||{};}catch{return {};}}

export default function CitizenGuide({ visible=true, ministry, activeSection, onSectionChange, profile={}, profileReady=true, onClose }) {
  const navigate=useNavigate();
  const [language,setLanguage]=useState(()=>preferences().language==='en'?'en':'bn');
  const [spoken,setSpoken]=useState(()=>preferences().spoken!==false);
  const [selected,setSelected]=useState(pendingRoute);
  const [department,setDepartment]=useState(ministry || '');
  const [phase,setPhase]=useState(()=>{const pending=pendingRoute();return pending?(pending.kind==='form'?'prepare':'manual'):'choose';});
  const [text,setText]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState(null);
  const [forms,setForms]=useState([]);
  const [fields,setFields]=useState([]);
  const [skipped,setSkipped]=useState([]);
  const [editing,setEditing]=useState(null);
  const [autofilled,setAutofilled]=useState([]);
  const [records,setRecords]=useState([]);
  const [busy,setBusy]=useState(false);
  const [checkedAt,setCheckedAt]=useState(null);
  const formRef=useRef(null), request=useRef(null), statusGeneration=useRef(0), alive=useRef(true);
  const speech=useSpeech(language);
  const voice=useVoiceInput({language,onTranscript:value=>{setText(value);setMessage({bn:'শোনা কথাটি যাচাই করে পাঠান।',en:'Check the transcript, then send it.'});},onError:setError});
  const t=(bn,en)=>language==='bn'?bn:en;
  const label=value=>value?.[language] || value?.en || '';
  const available=workflows.filter(w=>!department || w.ministry===department);
  const missing=fields.filter(f=>!f.value&&!skipped.includes(f.key));
  const current=editing?fields.find(f=>f.key===editing):missing[0];
  const prompt=message || (phase==='collect' && current ? {bn:`${current.bnLabel} — এই তথ্যটি বলুন অথবা লিখুন।`,en:`What is your ${current.label.toLowerCase()}? Say it or type below.`} : phase==='review' ? {bn:'সব তথ্য যাচাই করুন। পরিবর্তন করতে সংশ্লিষ্ট তথ্যটি চাপুন।',en:'Check every detail. Select a field to correct it.'} : phase==='prepare' ? {bn:'সেবার ফর্ম প্রস্তুত হচ্ছে…',en:'Preparing the service form…'} : phase==='ready' ? {bn:'ধাপে ধাপে ফর্ম পূরণ অথবা আবেদনের অবস্থা দেখতে পারেন।',en:'I can guide the form or check your existing records.'} : phase==='status' ? {bn:'আপনার অ্যাকাউন্টের সর্বশেষ তথ্য।',en:'Latest records for your signed-in account.'} : phase==='manual' ? {bn:'সেবার পাতায় একটি বিকল্প বা ফাইল নির্বাচন করুন, তারপর এখানে ফিরে আসুন।',en:'Choose an option or upload a file on the service page, then return here.'} : {bn:'কোন সেবা দরকার? বলুন অথবা লিখুন।',en:'What can I help you with? Speak or type.'});

  useEffect(()=>{sessionStorage.removeItem(GUIDE_ROUTE_KEY);return()=>{alive.current=false;statusGeneration.current++;request.current?.abort();};},[]);
  useEffect(()=>{alive.current=true;},[]);
  useEffect(()=>{
    if(!visible)return;
    const close=event=>{if(event.key==='Escape'){voice.cancel();speech.stop();onClose?.();document.querySelector('.nx-assistant-launch')?.focus();}};
    window.addEventListener('keydown',close);
    return()=>window.removeEventListener('keydown',close);
  },[visible,onClose]);
  useEffect(()=>{if(!visible){voice.cancel();speech.stop();request.current?.abort();statusGeneration.current++;setBusy(false);}},[visible]);
  useEffect(()=>{sessionStorage.setItem('nationx-guide-preferences',JSON.stringify({language,spoken}));},[language,spoken]);
  // Speak only after an explicit user interaction has started a service. Field
  // contents are never read aloud automatically—only the next question.
  useEffect(()=>{
    if(visible && spoken && selected && !['choose','prepare','status'].includes(phase)) speech.speak(prompt.bn.slice(0,600),prompt.en.slice(0,600));
    return ()=>speech.stop();
  },[phase,current?.key,selected?.id,language,spoken,visible]);
  useEffect(()=>{
    if(phase!=='prepare'||!profileReady)return;
    let attempts=0;
    const timer=setInterval(()=>{
      if(selected?.ministry!==ministry || selected?.section!==activeSection)return;
      const found=findServiceForms();
      if(found.length){clearInterval(timer);setForms(found);setMessage(null);if(found.length===1)attach(found[0]);else setPhase('forms');}
      else if(++attempts>=30){clearInterval(timer);setPhase('manual');setMessage({bn:'এখন কোনো সম্পাদনাযোগ্য ফর্ম নেই। সেবার পাতায় প্রয়োজনীয় বিকল্প বা আপনার আগের আবেদনের অবস্থা দেখুন।',en:'No editable form is available yet. Check the service page for a required selection or an existing application, or check your status.'});}
    },200);
    return()=>clearInterval(timer);
  },[phase,selected?.id,ministry,activeSection,profileReady,profile]);
  useEffect(()=>{
    if(!['collect','review'].includes(phase)||!formRef.current)return;
    const form=formRef.current;
    const refresh=()=>{if(form.isConnected)setFields(formFields(form));else{formRef.current=null;setFields([]);setEditing(null);setPhase('ready');setMessage({bn:'সেবার ফর্ম পরিবর্তিত হয়েছে। নিশ্চিত ফলাফল সেবার পাতায় দেখুন অথবা অবস্থা যাচাই করুন।',en:'The service form changed. Check the service page for its confirmed result, or refresh your status.'});}};
    const observer=new MutationObserver(refresh);observer.observe(form.closest('main')||form,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','required','value']});
    const afterReset=()=>queueMicrotask(refresh);form.addEventListener('reset',afterReset);
    form.addEventListener('input',refresh);form.addEventListener('change',refresh);
    return()=>{observer.disconnect();form.removeEventListener('reset',afterReset);form.removeEventListener('input',refresh);form.removeEventListener('change',refresh);};
  },[phase,formRef.current]);
  useEffect(()=>{if(phase==='collect'&&!current&&fields.length){setPhase('review');setMessage(null);}},[phase,current?.key,fields.length]);
  // Moving to another section invalidates the old DOM form, not its saved data.
  useEffect(()=>{
    if(formRef.current && (!formRef.current.isConnected || selected?.ministry!==ministry || selected?.section!==activeSection)) {
      formRef.current=null;setFields([]);setEditing(null);setPhase('choose');setMessage(null);
    }
  },[ministry,activeSection]);

  function clearActivity() { voice.cancel();speech.stop();request.current?.abort();statusGeneration.current++;setBusy(false);setError('');setText('');setMessage(null); }
  function choose(workflow) {
    clearActivity();formRef.current=null;setFields([]);setSkipped([]);setEditing(null);setSelected(workflow);setDepartment(workflow.ministry);setPhase('ready');
  }
  function openService(workflow=selected) {
    if(!workflow)return;
    if(workflow.ministry===ministry && onSectionChange){onSectionChange(workflow.section);return;}
    // Only navigation metadata is persisted. No identity fields or voice audio.
    sessionStorage.setItem(GUIDE_ROUTE_KEY,JSON.stringify({id:workflow.id,expires:Date.now()+120000}));
    navigate(workflow.destination);
  }
  function begin() {
    clearActivity();
    if(selected.kind==='status') {loadStatus();return;}
    openService();
    if(selected.ministry!==ministry)return;
    setPhase(selected.kind==='form'?'prepare':'manual');
  }
  function attach(form) {
    formRef.current=form;const copied=prefillProfile(form,profile);setAutofilled(copied);setSkipped([]);setEditing(null);setFields(formFields(form));setPhase('collect');
  }
  function refresh() {
    setMessage(null);setError('');setText('');
    if(formRef.current?.isConnected){setFields(formFields(formRef.current));setPhase('collect');}
    else {setPhase('prepare');openService();}
  }
  function answer(event) {
    event?.preventDefault();if(!text.trim()||busy||voice.state!=='idle')return;
    speech.stop();setError('');setMessage(null);
    const control=understand(text,department||ministry).command;
    if(control==='cancel'){clearActivity();setPhase('choose');setSelected(null);formRef.current=null;setMessage({bn:'সহায়তা বন্ধ। ফর্মের তথ্য অপরিবর্তিত আছে।',en:'Guidance cancelled. Existing form values are unchanged.'});return;}
    if(control==='repeat'){speech.speak(prompt.bn,prompt.en);setText('');return;}
    if(control==='back'&&phase==='collect'){
      const previous=fields.slice(0,fields.findIndex(f=>f.key===current?.key)).filter(f=>f.value).at(-1);
      if(previous){setEditing(previous.key);setText(controlKinds.has(previous.type)?'':previous.el.value);}else{setPhase('review');setText('');}
      return;
    }
    if(phase==='collect'&&current){
      try{writeField(current,text);const nextFields=formFields(formRef.current);const nextSkipped=skipped.filter(key=>key!==current.key);setEditing(null);setSkipped(nextSkipped);setFields(nextFields);setText('');if(nextFields.every(f=>f.value||nextSkipped.includes(f.key)))setPhase('review');}
      catch(e){setError(e.message);}return;
    }
    const intent=understand(text,department||ministry);
    if(intent.command==='cancel'){clearActivity();setPhase('choose');setSelected(null);formRef.current=null;setMessage({bn:'সহায়তা বন্ধ। ফর্মে পূরণ করা তথ্য মুছে ফেলা হয়নি।',en:'Guidance stopped. Values already entered on the form are unchanged.'});return;}
    if(intent.command==='repeat'){speech.speak(prompt.bn,prompt.en);return;}
    if(intent.command==='back'){setPhase('choose');setMessage(null);return;}
    setText('');
    if(intent.workflow){choose(intent.workflow);if(intent.command==='status'&&intent.workflow.statusPath)loadStatus(intent.workflow);return;}
    if(intent.ministry){setDepartment(intent.ministry);setPhase('choose');setSelected(null);setMessage({bn:intent.command==='status'?'কোন সেবার অবস্থা দেখতে চান?':'নিচে সেবাটি নির্বাচন করুন।',en:intent.command==='status'?'Which service would you like to check?':'Choose the service below.'});}
    else{setDepartment('');setPhase('choose');setMessage({bn:'নিশ্চিত হতে সেবাটি নিচে নির্বাচন করুন।',en:'Please choose a ministry so I do not guess the wrong service.'});}
  }
  async function loadStatus(workflow=selected){
    if(!workflow?.statusPath)return;
    clearActivity();const generation=++statusGeneration.current;
    setSelected(workflow);setPhase('status');setRecords([]);setCheckedAt(null);setBusy(true);request.current=new AbortController();
    try{
      const data=await apiRequest(workflow.statusPath,{signal:request.current.signal});
      if(generation!==statusGeneration.current||!alive.current)return;
      const rows=Array.isArray(data)?data:data?[data]:[];
      setRecords(rows.map(row=>({reference:row.ref_no||row.application_number||row.application_no||row.request_no||row.appointment_ref||row.connection_number||row.receipt_no||row.tin_number||row.id,status:row.status||row.payment_status||null,date:row.created_at||row.submitted_at||null})));
      setCheckedAt(new Date().toLocaleTimeString());
      const firstStatus=String(rows[0]?.status||rows[0]?.payment_status||'').slice(0,100);
      if(spoken)speech.speak(rows.length?`${rows.length}টি রেকর্ড পাওয়া গেছে। ${firstStatus?`প্রথম রেকর্ডের অবস্থা: ${firstStatus}।`:''} নিচে বিস্তারিত দেখুন।`:'কোনো রেকর্ড পাওয়া যায়নি।',rows.length?`${rows.length} records found. ${firstStatus?`The first record is ${firstStatus}.`:''} See the details below.`:'No records found for this service.');
    }catch(e){if(generation===statusGeneration.current&&alive.current)setError(e.message);}
    finally{if(generation===statusGeneration.current&&alive.current)setBusy(false);}
  }
  function handoff(){
    const form=formRef.current;if(!form?.isConnected){setError('The form changed. Start guidance again.');return;}
    const invalid=[...form.elements].find(el=>el.willValidate&&!el.checkValidity());
    if(invalid){setPhase('collect');setEditing(formFields(form).find(f=>f.el===invalid)?.key||null);setError(invalid.validationMessage);return;}
    const button=form.querySelector('button[type="submit"],button:not([type]),input[type="submit"]');
    clearActivity();onClose?.();
    form.scrollIntoView({behavior:'smooth',block:'start'});button?.focus({preventScroll:true});
    // The user submits on the original form. Its validation, confirmation,
    // duplicate-submit lock and server response remain authoritative.
  }
  const inField=phase==='collect'&&current;
  return <section className="nx-assistant nx-guide" aria-label="NationX voice assistant">
    <header className="nx-guide-header"><div className={`nx-guide-orb ${voice.state==='listening'||speech.speaking?'is-active':''}`} aria-hidden="true"><i className="fas fa-wave-square" /></div><div><h2>NationX Assistant</h2><small>{t('আপনার সেবা, ধাপে ধাপে','Your services, step by step')}</small></div><button type="button" className="nx-guide-icon" onClick={()=>{voice.cancel();speech.stop();onClose?.();}} aria-label="Close assistant panel"><i className="fas fa-xmark" aria-hidden="true" /></button></header>
    <div className="nx-guide-toolbar"><label className="nx-guide-language"><span className="nx-visually-hidden">Assistant language</span><select value={language} onChange={e=>{voice.cancel();speech.stop();setLanguage(e.target.value);}}><option value="bn">বাংলা</option><option value="en">English</option></select></label><button type="button" className="nx-guide-quiet" aria-pressed={spoken} onClick={()=>{speech.stop();setSpoken(v=>!v);}}><i className={`fas fa-volume-${spoken?'high':'xmark'}`} aria-hidden="true" />{t(spoken?'কণ্ঠ চালু':'কণ্ঠ বন্ধ',spoken?'Voice on':'Voice off')}</button><button type="button" className="nx-guide-quiet" onClick={()=>{if(speech.speaking)speech.stop();else speech.speak(prompt.bn,prompt.en);}}>{t(speech.speaking?'থামুন':'আবার শুনুন',speech.speaking?'Stop speech':'Replay')}</button></div>
    <div className="nx-guide-body">
      {selected&&<div className="nx-guide-context"><span>{label(selected)}</span><button className="nx-guide-quiet" type="button" onClick={()=>{clearActivity();setPhase('choose');setSelected(null);formRef.current=null;}}>{t('বদলান','Change')}</button></div>}
      <p className="nx-guide-prompt" role="status" aria-live="polite">{voice.state==='listening'?t('শুনছি… শেষ হলে মাইক চাপুন।','Listening… tap the mic when finished.'):voice.state==='transcribing'?t('আপনার কথা লেখা হচ্ছে…','Transcribing your message…'):label(prompt)}</p>
      {error&&<p className="nx-guide-error" role="alert">{error}</p>}
      {spoken&&!speech.available&&<p className="nx-guide-hint">{t('এই কণ্ঠ পাওয়া যাচ্ছে না। লেখা দিয়ে চালিয়ে যেতে পারেন।','This voice is unavailable. You can continue using text.')}</p>}
      {speech.error&&<p className="nx-guide-hint">{t('কণ্ঠ এখন পাওয়া যাচ্ছে না। লেখা দিয়ে চালিয়ে যান।','Audio is unavailable. You can continue using text.')}</p>}
      {phase==='choose'&&<><label className="nx-guide-filter">{t('মন্ত্রণালয়','Ministry')}<select value={department} onChange={e=>{setDepartment(e.target.value);setMessage(null);}}><option value="">{t('সব মন্ত্রণালয়','All ministries')}</option>{ministries.map(m=><option key={m.id} value={m.id}>{label(m)}</option>)}</select></label><div className="nx-guide-services">{(department?available:ministries).map(item=><button type="button" key={item.id} onClick={()=>item.services?setDepartment(item.id):choose(item)}><i className={`fas fa-${item.icon||ministries.find(m=>m.id===item.ministry)?.icon}`} aria-hidden="true" /><span>{label(item)}</span><i className="fas fa-chevron-right" aria-hidden="true" /></button>)}</div>{ministry&&getWorkflow(`${ministry}:${activeSection}`)&&<button type="button" className="nx-guide-primary" onClick={()=>choose(getWorkflow(`${ministry}:${activeSection}`))}>{t('এই সেবায় সাহায্য করুন','Help with this service')}</button>}</>}
      {phase==='ready'&&<div className="nx-guide-actions"><button className="nx-guide-primary" type="button" onClick={begin}>{t(selected.kind==='form'?'ধাপে ধাপে শুরু করুন':'সেবাটি খুলুন',selected.kind==='form'?'Guide me step by step':'Open service')}</button>{selected.statusPath&&<button type="button" onClick={()=>loadStatus()}>{t('আমার আবেদনের অবস্থা','Check my status')}</button>}<small>{t('খালি ঘরে প্রোফাইলের মিল থাকা তথ্য ব্যবহার করা হবে। জমা দেওয়ার আগে আপনি যাচাই করবেন।','Matching profile data fills blank fields only. You review everything before submitting.')}</small></div>}
      {phase==='forms'&&<div className="nx-guide-services">{forms.map((form,index)=><button type="button" key={index} onClick={()=>attach(form)}>{formTitle(form)}</button>)}</div>}
      {phase==='collect'&&current&&<><div className="nx-guide-progress"><span>{fields.length-missing.length} / {fields.length} {t('তথ্য পূরণ','fields ready')}</span><progress max={Math.max(1,fields.length)} value={fields.length-missing.length} /></div>{autofilled.length>0&&<small className="nx-guide-hint">{t(`প্রোফাইল থেকে ${autofilled.length}টি তথ্য পূরণ করা হয়েছে।`,`${autofilled.length} fields filled from your profile.`)}</small>}<strong className="nx-guide-field-label">{t(current.bnLabel,current.label)} <small>{t(current.required?'প্রয়োজনীয়':'ঐচ্ছিক',current.required?'Required':'Optional')}</small></strong>{controlKinds.has(current.type)&&<div className="nx-guide-actions"><p>{t('ফাইল বা সম্মতির ঘর নিজে সেবার ফর্মে পূরণ করুন।','Choose files and consent options yourself on the service form.')}</p><button type="button" onClick={()=>{current.el.scrollIntoView({block:'center'});current.el.focus();onClose?.();}}>{t('ফর্মে পূরণ করুন','Complete on form')}</button><button type="button" onClick={refresh}>{t('পূরণ করেছি','I have completed it')}</button></div>}<div className="nx-guide-actions nx-guide-secondary">{!current.required&&<button type="button" onClick={()=>{setSkipped(v=>[...v,current.key]);setEditing(null);setText('');setMessage(null);}}>{t('এখন বাদ দিন','Skip optional field')}</button>}<button type="button" onClick={()=>{setPhase('review');setMessage(null);}}>{t('তথ্য দেখুন','Review details')}</button></div></>}
      {phase==='review'&&<><dl className="nx-guide-review">{fields.map(f=><div key={f.key}><dt>{t(f.bnLabel,f.label)}</dt><dd><button type="button" onClick={()=>{setEditing(f.key);setText(controlKinds.has(f.type)?'':f.el.value);setPhase('collect');setMessage(null);}}>{f.options.find(o=>o.value===f.value)?.label||f.value||t('পূরণ হয়নি','Not provided')}</button></dd></div>)}</dl><p className="nx-guide-hint">{t('এখনও কিছু জমা দেওয়া হয়নি। মূল ফর্মে চূড়ান্ত যাচাই ও জমা দিন।','Nothing has been submitted. Finish with the original form’s validation and submit button.')}</p><button type="button" className="nx-guide-primary" onClick={handoff}>{t('মূল ফর্মে যাচাই ও জমা দিন','Review and submit on the form')}</button></>}
      {phase==='manual'&&<div className="nx-guide-actions"><button type="button" className="nx-guide-primary" onClick={()=>{openService();onClose?.();}}>{t('সেবার পাতা দেখুন','View service page')}</button><button type="button" onClick={()=>{setMessage(null);setPhase('prepare');}}>{t('ফর্ম নিয়ে চালিয়ে যান','Continue with form')}</button>{selected?.statusPath&&<button type="button" onClick={()=>loadStatus()}>{t('আমার অবস্থা দেখুন','Check my status')}</button>}</div>}
      {phase==='status'&&<div className="nx-guide-status">{busy?<p>{t('সর্বশেষ তথ্য আনা হচ্ছে…','Checking your latest records…')}</p>:<>{checkedAt&&<small>{t('সর্বশেষ দেখা','Checked at')} {checkedAt}</small>}{!error&&checkedAt&&!records.length&&<p>{t('এই সেবায় আপনার কোনো রেকর্ড পাওয়া যায়নি।','No records found for this service.')}</p>}{records.slice(0,20).map((row,i)=><article key={`${row.reference}-${i}`}><strong>{row.reference||t('রেফারেন্স দেওয়া নেই','No reference supplied')}</strong><span>{row.status||t('অবস্থা দেওয়া নেই','Status not supplied')}</span>{row.date&&<small>{String(row.date).slice(0,10)}</small>}</article>)}{records.length>20&&<p>{t('আরও রেকর্ড সেবার পাতায় দেখুন।','See the service page for the remaining records.')}</p>}<button type="button" onClick={()=>loadStatus()}>{t('আবার দেখুন','Refresh status')}</button><button type="button" onClick={()=>{openService();onClose?.();}}>{t('বিস্তারিত দেখুন','View full details')}</button></>}</div>}
    </div>
    {!['prepare','review','forms','status'].includes(phase)&&!(inField&&controlKinds.has(current.type))&&<form className="nx-guide-composer" onSubmit={answer}><label htmlFor="citizen-guide-answer" className="nx-visually-hidden">{inField?current.label:'Message to assistant'}</label>{inField&&current.options.length?<select id="citizen-guide-answer" value={text} onChange={e=>setText(e.target.value)}><option value="">{t('নির্বাচন করুন','Choose an option')}</option>{current.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<textarea id="citizen-guide-answer" rows={2} maxLength={1000} value={text} onChange={e=>setText(e.target.value)} placeholder={t('বলুন অথবা লিখুন…','Speak or type…')} lang={language==='bn'?'bn-BD':'en'} />}
      {inField && current.options.length>0 && text && <small className="nx-guide-hint">{t('আপনার উত্তর','Your answer')}: {current.options.find(o=>o.value===text)?.label||text}</small>}<div className="nx-guide-compose-actions"><button type="button" className={`nx-guide-mic ${voice.state==='listening'?'is-listening':''}`} onClick={()=>{speech.stop();setError('');voice.toggle();}} disabled={busy||['permission','transcribing'].includes(voice.state)} aria-label={voice.state==='listening'?'Stop recording':'Speak your answer'}><i className={`fas fa-${voice.state==='listening'?'stop':'microphone'}`} aria-hidden="true" /></button><small>{t('শোনা কথা যাচাই করে পাঠান','Review your words before sending')}</small><button type="submit" className="nx-guide-primary" disabled={!text.trim()||busy||voice.state!=='idle'}>{t('পাঠান','Send')}<i className="fas fa-arrow-up" aria-hidden="true" /></button></div>
    </form>}
    <footer className="nx-guide-footer"><span>{t('তথ্য নিজে থেকে জমা দেওয়া হয় না','Never submits without your review')}</span><button type="button" className="nx-guide-quiet" onClick={()=>{clearActivity();formRef.current=null;setSelected(null);setPhase('choose');setFields([]);setMessage({bn:'সহায়তা বন্ধ। ফর্মের তথ্য অপরিবর্তিত আছে।',en:'Guidance cancelled. Existing form values are unchanged.'});}}>{t('বাতিল','Cancel guidance')}</button></footer>
  </section>;
}
