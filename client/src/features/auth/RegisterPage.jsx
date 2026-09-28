import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell, { AuthHeader, FormField } from '../../layouts/AuthShell.jsx';
import { authApi, apiRequest } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { alerts } from '../../utils/alerts.js';

const initialForm = { username: '', nid: '', mobile: '', dob: '', gender: '', address: '', email: '', password: '', confirmPassword: '' };
const initialProfile = {
  name_bn: '', name_en: '', father_name_bn: '', father_nid: '', father_death_year: '', mother_name_bn: '', mother_nid: '', mother_death_year: '',
  spouse_name_bn: '', spouse_nid: '', spouse_death_year: '', birth_registration_number: '', date_of_birth: '', birth_place: '', gender: '',
  marital_status: '', education: '', occupation: '', disability: 'None', identification_mark: '', blood_group: 'Unknown', mobile: '',
  present_division_id: '', present_district_id: '', present_upazila_id: '', present_address: '', present_post_office: '', present_post_code: '',
  present_ward: '', present_village: '', present_road: '', present_house: '', permanent_division_id: '', permanent_district_id: '',
  permanent_upazila_id: '', permanent_address: '', permanent_post_office: '', permanent_post_code: '', permanent_ward: '', permanent_village: '',
  permanent_road: '', permanent_house: ''
};
const steps = ['Account', 'Personal details', 'Family details', 'Addresses', 'Review'];
const choices = {
  gender: ['Male', 'Female', 'Hijra', 'Other'], marital_status: ['Unmarried', 'Married', 'Divorced', 'Widow', 'Widower'],
  education: ['No formal education', 'Primary', 'JSC or equivalent', 'SSC or equivalent', 'HSC or equivalent', 'Diploma', 'Graduate', 'Postgraduate', 'Other'],
  occupation: ['Student', 'Agriculture', 'Service', 'Business', 'Homemaker', 'Day labourer', 'Retired', 'Unemployed', 'Other'],
  disability: ['None', 'Visual', 'Physical', 'Hearing', 'Speech', 'Other'], blood_group: ['Unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
};
const addressKeys = ['division_id', 'district_id', 'upazila_id', 'address', 'post_office', 'post_code', 'ward', 'village', 'road', 'house'];

function OptionField({ id, name, label, icon, value, update, required = false, values }) {
  return <FormField id={id} name={name} as="select" label={label} icon={icon} value={value} onChange={update} required={required}>
    <option value="">Select {label.toLowerCase()}</option>{values.map(item => <option key={item}>{item}</option>)}
  </FormField>;
}

function AddressFields({ prefix, title, values, update, divisions, required = true }) {
  const [districts, setDistricts] = useState([]); const [upazilas, setUpazilas] = useState([]);
  const divisionId = values[`${prefix}_division_id`]; const districtId = values[`${prefix}_district_id`];
  useEffect(() => {
    let active = true; setDistricts([]); setUpazilas([]);
    if (divisionId) apiRequest(`/api/applicants/locations/districts/${divisionId}`, { auth: false }).then(rows => active && setDistricts(rows)).catch(() => active && setDistricts([]));
    return () => { active = false; };
  }, [divisionId]);
  useEffect(() => {
    let active = true; setUpazilas([]);
    if (districtId) apiRequest(`/api/applicants/locations/upazilas/${districtId}`, { auth: false }).then(rows => active && setUpazilas(rows)).catch(() => active && setUpazilas([]));
    return () => { active = false; };
  }, [districtId]);
  return <fieldset className="registration-section"><legend>{title}</legend><div className="react-form-grid">
    <FormField id={`${prefix}-division`} name={`${prefix}_division_id`} as="select" label="Division" icon="map" value={divisionId} onChange={update} required={required}><option value="">Select division</option>{divisions.map(row => <option value={row.id} key={row.id}>{row.name_bn ? `${row.name_bn} · ${row.name}` : row.name}</option>)}</FormField>
    <FormField id={`${prefix}-district`} name={`${prefix}_district_id`} as="select" label="District" icon="location-dot" value={districtId} onChange={update} required={required} disabled={!divisionId}><option value="">Select district</option>{districts.map(row => <option value={row.id} key={row.id}>{row.name_bn ? `${row.name_bn} · ${row.name}` : row.name}</option>)}</FormField>
    <FormField id={`${prefix}-upazila`} name={`${prefix}_upazila_id`} as="select" label="Upazila / Thana" icon="building" value={values[`${prefix}_upazila_id`]} onChange={update} required={required} disabled={!districtId}><option value="">Select upazila / thana</option>{upazilas.map(row => <option value={row.id} key={row.id}>{row.name_bn ? `${row.name_bn} · ${row.name}` : row.name}</option>)}</FormField>
    <FormField id={`${prefix}-post-office`} name={`${prefix}_post_office`} label="Post office" icon="envelope" value={values[`${prefix}_post_office`]} onChange={update} required={required} />
    <FormField id={`${prefix}-post-code`} name={`${prefix}_post_code`} inputMode="numeric" pattern="[0-9]{4}" maxLength="4" label="Post code" icon="hashtag" value={values[`${prefix}_post_code`]} onChange={update} required={required} />
    <FormField id={`${prefix}-ward`} name={`${prefix}_ward`} label="Ward (optional)" icon="border-all" value={values[`${prefix}_ward`]} onChange={update} />
    <FormField id={`${prefix}-village`} name={`${prefix}_village`} label="Village / Mohalla (optional)" icon="house-chimney" value={values[`${prefix}_village`]} onChange={update} />
    <FormField id={`${prefix}-road`} name={`${prefix}_road`} label="Road (optional)" icon="road" value={values[`${prefix}_road`]} onChange={update} />
    <FormField id={`${prefix}-house`} name={`${prefix}_house`} label="House (optional)" icon="house" value={values[`${prefix}_house`]} onChange={update} />
  </div><FormField id={`${prefix}-address`} name={`${prefix}_address`} as="textarea" rows="2" label="Address details" icon="location-crosshairs" value={values[`${prefix}_address`]} onChange={update} required={required} /></fieldset>;
}

function Review({ form, profile }) {
  const rows = [
    ['Applicant', `${profile.name_bn} · ${profile.name_en}`], ['Birth details', `${profile.date_of_birth} · ${profile.birth_place} · ${profile.birth_registration_number}`],
    ['Parents', `${profile.father_name_bn} · ${profile.mother_name_bn}`], ['Contact', `${profile.mobile} · ${form.email}`],
    ['Present address', profile.present_address], ['Permanent address', profile.permanent_address]
  ];
  return <section className="registration-review"><div className="registration-review-heading"><i className="fas fa-clipboard-check" /><div><h2>Review your self-declared profile</h2><p>This information will prefill your NID application draft. You can correct it before final submission.</p></div></div><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl><aside><i className="fas fa-shield-halved" /><span>Creating this account does not verify your identity or issue an NID. Supporting documents and final confirmation are completed after sign-in.</span></aside></section>;
}

export default function RegisterPage() {
  const navigate = useNavigate(); const { setCitizenSession } = useAuth();
  const [form, setForm] = useState(initialForm); const [profile, setProfile] = useState(initialProfile);
  const [acceptedTerms, setAcceptedTerms] = useState(false); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  const [applicant, setApplicant] = useState(false); const [step, setStep] = useState(0); const [divisions, setDivisions] = useState([]); const [sameAddress, setSameAddress] = useState(false);
  useEffect(() => {
    if (!applicant || divisions.length) return;
    apiRequest('/api/applicants/locations/divisions', { auth: false }).then(setDivisions).catch(error => setError(error.message));
  }, [applicant, divisions.length]);
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const updateProfile = event => {
    const { name, value } = event.target;
    setProfile(current => {
      const next = { ...current, [name]: value };
      if (name === 'name_en') setForm(account => ({ ...account, username: value }));
      if (name === 'mobile') setForm(account => ({ ...account, mobile: value }));
      if (name === 'present_division_id') { next.present_district_id = ''; next.present_upazila_id = ''; }
      if (name === 'present_district_id') next.present_upazila_id = '';
      if (name === 'permanent_division_id') { next.permanent_district_id = ''; next.permanent_upazila_id = ''; }
      if (name === 'permanent_district_id') next.permanent_upazila_id = '';
      return next;
    });
  };
  function copyPresent(checked) {
    setSameAddress(checked);
    if (checked) setProfile(current => {
      const next = { ...current };
      addressKeys.forEach(key => { next[`permanent_${key}`] = current[`present_${key}`]; });
      return next;
    });
  }
  function chooseApplicant(value) { setApplicant(value); setStep(0); setError(''); setAcceptedTerms(false); }
  function cleanProfile() { return Object.fromEntries(Object.entries(profile).filter(([, value]) => value !== '')); }
  async function submit(event) {
    event.preventDefault(); setError('');
    if (applicant && step < steps.length - 1) { setStep(current => current + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); await alerts.error('Passwords do not match'); return; }
    if (!acceptedTerms) return;
    setSubmitting(true);
    try {
      const { confirmPassword, ...payload } = form;
      const data = applicant
        ? await apiRequest('/api/applicants/register', { method: 'POST', auth: false, body: { username: profile.name_en, email: form.email, password: form.password, mobile: profile.mobile, profile: cleanProfile() } })
        : await authApi.citizenRegister(payload);
      if (data.token) setCitizenSession(data.token);
      if (applicant) { navigate('/nid-applicant.html', { replace: true, state: { demoVerificationCode: data.demoVerificationCode } }); return; }
      await alerts.success('Welcome, Citizen!', 'Registration successful. You are being logged in.'); navigate('/dashboard.html', { replace: true });
    } catch (requestError) { setError(requestError.data?.message || requestError.message); await alerts.error(requestError.data?.message || requestError.message, 'Registration Failed'); }
    finally { setSubmitting(false); }
  }
  return <AuthShell wide icons={['passport', 'id-card', 'user-shield', 'file-signature']}>
    <AuthHeader title="Citizen Registration" subtitle={applicant ? 'Create an applicant account and reusable NID draft' : 'Create your secure NationX identity'} />
    <fieldset className="identity-choice"><legend>Choose how you want to register</legend><p className="identity-choice-intro">Select the option that matches your current identity status.</p><div className="identity-choice-grid">
      <label className={!applicant ? 'identity-option selected' : 'identity-option'}><input type="radio" name="identity-choice" checked={!applicant} onChange={() => chooseApplicant(false)} /><span className="identity-option-icon"><i className="fas fa-id-card" /></span><span><strong>I already have an NID</strong><small>Link an existing National ID to a citizen account.</small></span><i className="fas fa-circle-check identity-option-check" aria-hidden="true" /></label>
      <label className={applicant ? 'identity-option selected' : 'identity-option'}><input type="radio" name="identity-choice" checked={applicant} onChange={() => chooseApplicant(true)} /><span className="identity-option-icon"><i className="fas fa-file-circle-plus" /></span><span><strong>I don’t have an NID</strong><small>Create an applicant account and prefill a first-time application.</small></span><i className="fas fa-circle-check identity-option-check" aria-hidden="true" /></label>
    </div>{applicant && <div className="identity-applicant-note"><i className="fas fa-circle-info" /><p><strong>Self-declared draft</strong><span>Your registration details will be saved as an editable application draft. Registration never creates or verifies a government NID.</span></p></div>}</fieldset>
    {applicant && <nav className="registration-progress" aria-label="Registration progress">{steps.map((label, index) => <button type="button" key={label} className={index === step ? 'current' : index < step ? 'complete' : ''} disabled={index > step} onClick={() => index < step && setStep(index)}><span>{index < step ? <i className="fas fa-check" /> : index + 1}</span><small>{label}</small></button>)}</nav>}
    {error && <div className="react-auth-error" role="alert">{error}</div>}
    <form className="auth-form" onSubmit={submit}>
      {!applicant && <><div className="react-form-grid"><FormField id="register-name" name="username" label="Full Name" icon="user" value={form.username} onChange={update} required /><FormField id="register-nid" name="nid" label="NID Number" icon="id-card" inputMode="numeric" value={form.nid} onChange={update} required /><FormField id="register-mobile" name="mobile" type="tel" label="Mobile Number" icon="phone" value={form.mobile} onChange={update} required /><FormField id="register-dob" name="dob" type="date" label="Date of Birth" icon="calendar" value={form.dob} onChange={update} required /><OptionField id="register-gender" name="gender" label="Gender" icon="venus-mars" value={form.gender} update={update} values={['Male', 'Female', 'Other']} required /><FormField id="register-email" name="email" type="email" label="Email Address" icon="envelope" value={form.email} onChange={update} required /></div><FormField id="register-address" name="address" as="textarea" rows="3" label="Address" icon="location-dot" value={form.address} onChange={update} required /></>}
      {applicant && step === 0 && <fieldset className="registration-section"><legend>Secure account</legend><p>Use an email and mobile number you can access. Your password is never stored in the application draft.</p><div className="react-form-grid"><FormField id="applicant-name-en" name="name_en" label="Full name (English)" icon="user" value={profile.name_en} onChange={updateProfile} required /><FormField id="applicant-mobile" name="mobile" type="tel" pattern="(?:\+?88)?01[0-9]{9}" label="Bangladesh mobile number" icon="phone" value={profile.mobile} onChange={updateProfile} required /><FormField id="register-email" name="email" type="email" label="Email Address" icon="envelope" value={form.email} onChange={update} required /><FormField id="register-password" name="password" type="password" minLength="8" maxLength="72" label="Password" icon="lock" value={form.password} onChange={update} required /><FormField id="register-confirm" name="confirmPassword" type="password" label="Confirm Password" icon="check-circle" value={form.confirmPassword} onChange={update} required /></div></fieldset>}
      {applicant && step === 1 && <fieldset className="registration-section"><legend>Personal information</legend><p>Enter details exactly as they appear on your supporting records.</p><div className="react-form-grid"><FormField id="applicant-name-bn" name="name_bn" label="নাম (বাংলা)" icon="language" value={profile.name_bn} onChange={updateProfile} required /><FormField id="applicant-birth-reg" name="birth_registration_number" inputMode="numeric" pattern="[0-9]{17}" maxLength="17" label="Birth registration number" icon="certificate" value={profile.birth_registration_number} onChange={updateProfile} required /><FormField id="applicant-dob" name="date_of_birth" type="date" label="Date of birth" icon="calendar" value={profile.date_of_birth} onChange={updateProfile} required /><FormField id="applicant-birth-place" name="birth_place" label="Birthplace district" icon="location-dot" value={profile.birth_place} onChange={updateProfile} required /><OptionField id="applicant-gender" name="gender" label="Gender" icon="venus-mars" value={profile.gender} update={updateProfile} values={choices.gender} required /><OptionField id="applicant-marital" name="marital_status" label="Marital status" icon="ring" value={profile.marital_status} update={updateProfile} values={choices.marital_status} required /><OptionField id="applicant-education" name="education" label="Education" icon="graduation-cap" value={profile.education} update={updateProfile} values={choices.education} required /><OptionField id="applicant-occupation" name="occupation" label="Occupation" icon="briefcase" value={profile.occupation} update={updateProfile} values={choices.occupation} required /><OptionField id="applicant-disability" name="disability" label="Disability" icon="universal-access" value={profile.disability} update={updateProfile} values={choices.disability} /><OptionField id="applicant-blood" name="blood_group" label="Blood group" icon="droplet" value={profile.blood_group} update={updateProfile} values={choices.blood_group} /><FormField id="applicant-mark" name="identification_mark" label="Visible identification mark (optional)" icon="fingerprint" value={profile.identification_mark} onChange={updateProfile} /></div></fieldset>}
      {applicant && step === 2 && <fieldset className="registration-section"><legend>Family information</legend><p>NID numbers and death years are optional when they do not apply.</p><div className="react-form-grid"><FormField id="applicant-father" name="father_name_bn" label="পিতার নাম (বাংলা)" icon="person" value={profile.father_name_bn} onChange={updateProfile} required /><FormField id="applicant-father-nid" name="father_nid" inputMode="numeric" pattern="[0-9]{10}|[0-9]{13}|[0-9]{17}" label="Father’s NID (optional)" icon="id-card" value={profile.father_nid} onChange={updateProfile} /><FormField id="applicant-father-death" name="father_death_year" type="number" min="1900" max={new Date().getFullYear()} label="Father’s death year (optional)" icon="calendar" value={profile.father_death_year} onChange={updateProfile} /><FormField id="applicant-mother" name="mother_name_bn" label="মাতার নাম (বাংলা)" icon="person-dress" value={profile.mother_name_bn} onChange={updateProfile} required /><FormField id="applicant-mother-nid" name="mother_nid" inputMode="numeric" pattern="[0-9]{10}|[0-9]{13}|[0-9]{17}" label="Mother’s NID (optional)" icon="id-card" value={profile.mother_nid} onChange={updateProfile} /><FormField id="applicant-mother-death" name="mother_death_year" type="number" min="1900" max={new Date().getFullYear()} label="Mother’s death year (optional)" icon="calendar" value={profile.mother_death_year} onChange={updateProfile} /><FormField id="applicant-spouse" name="spouse_name_bn" label="Spouse name (if applicable)" icon="people-arrows" value={profile.spouse_name_bn} onChange={updateProfile} /><FormField id="applicant-spouse-nid" name="spouse_nid" inputMode="numeric" pattern="[0-9]{10}|[0-9]{13}|[0-9]{17}" label="Spouse NID (optional)" icon="id-card" value={profile.spouse_nid} onChange={updateProfile} /><FormField id="applicant-spouse-death" name="spouse_death_year" type="number" min="1900" max={new Date().getFullYear()} label="Spouse death year (optional)" icon="calendar" value={profile.spouse_death_year} onChange={updateProfile} /></div></fieldset>}
      {applicant && step === 3 && <><AddressFields prefix="present" title="Present address" values={profile} update={updateProfile} divisions={divisions} /><label className="terms-checkbox address-copy"><input type="checkbox" checked={sameAddress} onChange={event => copyPresent(event.target.checked)} /><span>Permanent address is the same as present address</span></label><AddressFields prefix="permanent" title="Permanent address" values={profile} update={updateProfile} divisions={divisions} /></>}
      {applicant && step === 4 && <Review form={form} profile={profile} />}
      {!applicant && <div className="react-form-grid"><FormField id="register-password" name="password" type="password" minLength="8" maxLength="72" label="Password" icon="lock" value={form.password} onChange={update} required /><FormField id="register-confirm" name="confirmPassword" type="password" label="Confirm Password" icon="check-circle" value={form.confirmPassword} onChange={update} required /></div>}
      {(!applicant || step === 4) && <label className="terms-checkbox"><input type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} required /><span>I confirm that the supplied identity information is accurate and understand that it remains unverified until reviewed by the responsible authority.</span></label>}
      <div className="registration-actions">{applicant && step > 0 && <button className="btn-secondary" type="button" disabled={submitting} onClick={() => setStep(current => current - 1)}><i className="fas fa-arrow-left" /> Back</button>}<button className="btn-submit" disabled={submitting || (applicant && step === 3 && !divisions.length)} type="submit"><span>{submitting ? 'Creating secure draft…' : applicant && step < 4 ? 'Continue' : applicant ? 'Create account and save draft' : 'Create Citizen Account'}</span><i className={`fas ${applicant && step < 4 ? 'fa-arrow-right' : 'fa-user-plus'}`} /></button></div>
    </form><div className="auth-links"><span>Already registered?</span><Link to="/index.html">Back to Login</Link></div>
  </AuthShell>;
}
