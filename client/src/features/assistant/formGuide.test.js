import { beforeEach, describe, expect, it } from 'vitest';
import { formFields, prefillProfile, writeField } from './formGuide.js';
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
});
