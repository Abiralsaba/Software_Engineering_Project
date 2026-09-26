import { beforeEach, describe, expect, it } from 'vitest';
import { formFields, optionForAnswer, plausibleTranscript, prefillProfile, spokenNumber, writeField } from './formGuide.js';
import { ministries, workflows, understand } from './workflows.js';
let form;
beforeEach(()=>{document.body.innerHTML='<form><label>Name<input name="full_name" required></label><label>NID<input name="nid_number"></label><label>Father<input name="father_name"></label><label>Gender<select name="gender"><option value="">Choose</option><option>Male</option><option>Female</option></select></label><label>Amount<input type="number" name="amount" min="1"></label><label>Photo<input type="file" name="photo"></label><label>Consent<input type="checkbox" name="consent"></label><input name="secret" type="hidden" value="unchanged"></form>';form=document.querySelector('form');});
describe('citizen workflow boundaries',()=>{
  it('covers all eight ministries with only allowlisted relative routes',()=>{
    expect(ministries).toHaveLength(8);
    expect(new Set(workflows.map(w=>w.id)).size).toBe(workflows.length);
    expect(workflows.every(w=>/^\/[a-z]+\.html\?section=[a-z-]+$/.test(w.destination))).toBe(true);
  });
  it('understands bilingual routes and asks rather than guessing an ambiguous ministry',()=>{
    expect(understand('water connection').workflow.id).toBe('water:connection');
    expect(understand('পানির সংযোগ চাই').workflow.id).toBe('water:connection');
    expect(understand('passport status').command).toBe('status');
    expect(understand('পাসপোর্ট করতে চাই').ministry).toBe('passport');
    expect(understand('land tax').ministry).toBe('land');
    expect(understand('water and passport').ministry).toBeNull();
    expect(understand('cancel').command).toBe('cancel');
  });
  it('prefills only blank, explicitly mapped fields and leaves consent and relatives untouched',()=>{
    form.elements.full_name.value='Already entered';
    prefillProfile(form,{name:'Preview Citizen',nid:'0123456789',gender:'Female'});
    expect(form.elements.full_name.value).toBe('Already entered');
    expect(form.elements.nid_number.value).toBe('0123456789');
    expect(form.elements.gender.value).toBe('Female');
    expect(form.elements.father_name.value).toBe('');
    expect(form.elements.consent.checked).toBe(false);
    expect(formFields(form).some(f=>f.key==='secret')).toBe(false);
  });
  it('normalizes Bangla digits without losing leading zeros and validates options',()=>{
    writeField(formFields(form).find(f=>f.key==='nid_number'),'০১২৩৪৫৬৭৮৯');
    expect(form.elements.nid_number.value).toBe('0123456789');
    writeField(formFields(form).find(f=>f.key==='gender'),'নারী');
    expect(form.elements.gender.value).toBe('Female');
    expect(()=>writeField(formFields(form).find(f=>f.key==='gender'),'invented')).toThrow();
  });
  it('does not silently accept invalid numbers, check consent or select uploads',()=>{
    expect(()=>writeField(formFields(form).find(f=>f.key==='amount'),'not a number')).toThrow();
    expect(()=>writeField(formFields(form).find(f=>f.key==='amount'),'0')).toThrow();
    for(const key of ['photo','consent'])expect(()=>writeField(formFields(form).find(f=>f.key===key),'yes')).toThrow();
    expect(form.elements.amount.value).toBe('');
  });
  it('turns clear Bangla spoken numbers into validated numeric form values',()=>{
    const amount=formFields(form).find(f=>f.key==='amount');
    expect(spokenNumber('দশ।')).toBe('10');
    expect(spokenNumber('১০ acres')).toBe('10');
    expect(plausibleTranscript(amount,'নিজের স্ত্রীর স্বাস্থ্যের সাথে সংযোগ')).toBe(false);
    writeField(amount,'দশ');
    expect(form.elements.amount.value).toBe('10');
    expect(()=>writeField(amount,'random words')).toThrow(/number/);
    expect(form.elements.amount.value).toBe('10');
  });
  it('rejects a rambling hallucinated answer for a short field before it reaches the form',()=>{
    const crop=document.createElement('input');crop.name='crop_name';form.append(crop);
    const field=formFields(form).find(f=>f.key==='crop_name');
    expect(plausibleTranscript(field,'নিজের স্ত্রীর নিজের স্বাস্থ্যের সাথে স্বাস্থ্যের সাথে সংযোগ প্রদান করি')).toBe(false);
    expect(crop.value).toBe('');
    const nid=formFields(form).find(f=>f.key==='nid_number');
    expect(plausibleTranscript(nid,'আপনার নাম কি')).toBe(false);
    expect(plausibleTranscript(nid,'১২৩৪৫৬৭৮৯০')).toBe(true);
  });
  it('offers live select options and accepts a clicked option or a spoken option number',()=>{
    const season=document.createElement('select');season.name='season';season.innerHTML='<option value="">Select</option><option>Aman</option><option>Aus</option><option>Boro</option>';form.append(season);
    const field=formFields(form).find(f=>f.key==='season');
    expect(field.options.map(o=>o.label)).toEqual(['Aman','Aus','Boro']);
    expect(optionForAnswer(field,'আমন।')?.value).toBe('Aman');
    expect(optionForAnswer(field,'option two')?.value).toBe('Aus');
    expect(plausibleTranscript(field,'completely unrelated sentence')).toBe(false);
    writeField(field,'দুই');expect(season.value).toBe('Aus');
    writeField(formFields(form).find(f=>f.key==='season'),'আমন');expect(season.value).toBe('Aman');
  });
  it('uses the same live choice logic for a second ministry’s geographic select',()=>{
    const district=document.createElement('select');district.name='district_id';district.innerHTML='<option value="">Select district</option><option value="13">Dhaka / ঢাকা</option><option value="23">Cumilla / কুমিল্লা</option>';form.append(district);
    const field=formFields(form).find(f=>f.key==='district_id');
    expect(field.options).toHaveLength(2);
    writeField(field,'কুমিল্লা');
    expect(district.value).toBe('23');
  });
  it('keeps dependent location selects in the guide while their options load',()=>{
    const district=document.createElement('select');district.name='district_id';district.disabled=true;district.innerHTML='<option value="">Loading districts…</option>';form.append(district);
    const fields=formFields(form);
    expect(fields.find(f=>f.key==='district_id')?.options).toEqual([]);
    expect(()=>writeField(fields.find(f=>f.key==='district_id'),'ঢাকা')).toThrow(/service form/);
  });
});
