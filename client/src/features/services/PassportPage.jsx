import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import DemoPaymentPanel from '../../components/DemoPaymentPanel.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { dateText, LocationFields, StatusBadge } from './ServiceUi.jsx';

const API = '/api/passport';
const sections = ['overview', 'apply', 'documents', 'applications', 'track', 'fees', 'offices', 'payment'];
const optionalFields = [
  ['full_name_bn', 'Full name (Bangla)'], ['father_name_bn', 'Father name (Bangla)'], ['mother_name_bn', 'Mother name (Bangla)'],
  ['spouse_name_en', 'Spouse name (English)'], ['spouse_name_bn', 'Spouse name (Bangla)'], ['birth_certificate_no', 'Birth certificate number'],
  ['tin_number', 'TIN'], ['profession', 'Profession'], ['distinguishing_mark', 'Distinguishing mark'], ['present_care_of', 'Present care of'],
  ['present_village_road', 'Present village/road/house'], ['present_post_office', 'Present post office'], ['present_postal_code', 'Present postal code'],
  ['permanent_care_of', 'Permanent care of'], ['permanent_village_road', 'Permanent village/road/house'], ['permanent_post_office', 'Permanent post office'],
  ['permanent_postal_code', 'Permanent postal code'], ['email', 'Email'], ['emergency_contact_name', 'Emergency contact'],
  ['emergency_contact_phone', 'Emergency phone'], ['old_passport_number', 'Old passport number'], ['old_passport_issue_place', 'Old passport issue place']
];

function rows(value) { return Array.isArray(value) ? value : []; }

export function passportApplicationPayload(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  return { ...values, same_as_present: Boolean(form.elements.same_as_present.checked) };
}

export function passportDocuments(form) {
  return new FormData(form);
}

export default function PassportPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const [section, setSectionState] = useState(sections.includes(requested) ? requested : 'overview');
  const [data, setData] = useState({ stats: {}, activity: [], applications: [], offices: [], fees: [], divisions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [details, setDetails] = useState(null);
  const [trackNumber, setTrackNumber] = useState(params.get('application') || '');
  const [fee, setFee] = useState(null);
  const { submitting, runLocked } = useSubmissionLock();
  const returnStatus = params.get('status');
  const returnTransaction = params.get('tid');

  async function loadAll() {
    setLoading(true); setError('');
    try {
      const [stats, activity, applications, offices, fees, divisions] = await Promise.all([
        apiRequest(`${API}/stats`), apiRequest(`${API}/recent-activity`), apiRequest(`${API}/my-applications`),
        apiRequest(`${API}/offices`, { auth: false }), apiRequest(`${API}/fees`, { auth: false }), apiRequest(`${API}/locations/divisions`)
      ]);
      setData({ stats: stats || {}, activity: rows(activity), applications: rows(applications), offices: rows(offices), fees: rows(fees), divisions: rows(divisions) });
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  function setSection(next) {
    setSectionState(next); setResult(null); setDetails(null);
    const nextParams = new URLSearchParams(params);
    if (next === 'overview') nextParams.delete('section'); else nextParams.set('section', next);
    setParams(nextParams, { replace: true });
  }

  async function submitApplication(event) {
    event.preventDefault(); const form = event.currentTarget;
    await runLocked(async () => {
      try {
        const response = await apiRequest(`${API}/apply`, { method: 'POST', body: passportApplicationPayload(form) });
        setResult(response); await alerts.success('Application submitted', `${response.applicationNumber} · Fee ৳${Number(response.total_fee || 0).toLocaleString()}`); await loadAll(); setSection('documents');
      } catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
    });
  }

  async function uploadDocuments(event) {
    event.preventDefault(); const form = event.currentTarget; const appId = form.elements.application_id.value;
    await runLocked(async () => {
      try {
        const body = passportDocuments(form); body.delete('application_id');
        const response = await apiRequest(`${API}/upload-documents/${appId}`, { method: 'POST', body });
        setResult(response); await alerts.success('Documents uploaded', response.message); form.reset(); await loadAll();
      } catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
    });
  }

  async function calculateFee(event) {
    event.preventDefault(); const values = new URLSearchParams(new FormData(event.currentTarget));
    try { setFee(await apiRequest(`${API}/fee/calculate?${values.toString()}`, { auth: false })); }
    catch (requestError) { setError(requestError.message); }
  }

  async function track(event) {
    event.preventDefault();
    try {
      const response = await apiRequest(`${API}/track/${encodeURIComponent(trackNumber.trim())}`); setResult(response);
      const next = new URLSearchParams(params); next.set('section', 'track'); next.set('application', trackNumber.trim()); setParams(next, { replace: true });
    } catch (requestError) { setResult(null); setError(requestError.message); }
  }

  async function viewApplication(id) {
    try { setDetails(await apiRequest(`${API}/application/${id}`)); }
    catch (requestError) { setError(requestError.message); }
  }

  async function cancelApplication(id) {
    try { await apiRequest(`${API}/application/${id}/cancel`, { method: 'PUT' }); await loadAll(); }
    catch (requestError) { setError(requestError.message); }
  }

  return <CitizenShell>
    <header className="react-page-header"><div><h1>Bangladesh e-Passport</h1><p>Applications, document uploads, status tracking, offices, and official fee schedules.</p></div></header>
    <nav className="react-service-tabs" aria-label="Passport sections">{sections.map(value => <button type="button" className={section === value ? 'active' : ''} onClick={() => setSection(value)} key={value}>{value}</button>)}</nav>
    {(returnStatus || returnTransaction) && <div className="react-notice warning" role="status"><strong>Unverified payment return.</strong> URL values ({returnStatus || 'no status'}{returnTransaction ? `, ${returnTransaction}` : ''}) are not proof of payment. Check the server-owned application status after verified gateway processing.</div>}
    {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={loadAll}>Retry</button></div>}
    {result?.applicationNumber && <div className="react-notice success">Application: <strong>{result.applicationNumber}</strong></div>}
    {loading ? <p className="react-empty-state">Loading passport services…</p> : <>
      {section === 'overview' && <><div className="react-service-stats">{[['Total', data.stats.total], ['Active', data.stats.active], ['Pending', data.stats.pending], ['Delivered', data.stats.delivered], ['Fees paid', `৳${Number(data.stats.total_fees_paid || 0).toLocaleString()}`]].map(([label, value]) => <article className="react-panel" key={label}><strong>{value || 0}</strong><span>{label}</span></article>)}</div><section className="react-panel"><h2>Recent activity</h2><div className="react-card-list">{data.activity.map(row => <article key={row.id}><div><h3>{row.application_number}</h3><p>{row.service_type} · {dateText(row.updated_at)}</p></div><StatusBadge value={row.status} /></article>)}{!data.activity.length && <p className="react-empty-state">No passport activity.</p>}</div></section></>}

      {section === 'apply' && <section className="react-panel"><h2>Passport application</h2><form className="react-form-stack" onSubmit={submitApplication}><h3>Service</h3><div className="react-form-grid"><label>Service type<select name="service_type" defaultValue="New">{['New', 'Renewal', 'Lost Replacement', 'Damaged Replacement', 'Correction', 'Duplicate'].map(value => <option key={value}>{value}</option>)}</select></label><label>Passport type<select name="passport_type" defaultValue="Ordinary"><option>Ordinary</option><option>Official</option><option>Diplomatic</option></select></label><label>Page count<select name="page_count" defaultValue="48"><option value="48">48</option><option value="64">64</option></select></label><label>Validity<select name="validity_years" defaultValue="5"><option value="5">5 years</option><option value="10">10 years</option></select></label><label>Delivery<select name="delivery_type" defaultValue="Regular"><option>Regular</option><option>Express</option><option>Super Express</option></select></label><label>Preferred office<select name="preferred_office" defaultValue=""><option value="">Select</option>{data.offices.map(row => <option value={row.office_code} key={row.id || row.office_code}>{row.office_name}</option>)}</select></label></div><h3>Personal information</h3><div className="react-form-grid"><label>Full name (English)<input name="full_name_en" required /></label><label>Father name (English)<input name="father_name_en" required /></label><label>Mother name (English)<input name="mother_name_en" required /></label><label>Date of birth<input name="date_of_birth" type="date" required /></label><label>Gender<select name="gender" defaultValue="" required><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></label><label>Religion<select name="religion" defaultValue="Islam"><option>Islam</option><option>Hinduism</option><option>Buddhism</option><option>Christianity</option><option>Other</option></select></label><label>Marital status<select name="marital_status" defaultValue="Single"><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option></select></label><label>Nationality<input name="nationality" defaultValue="Bangladeshi" /></label><label>NID number<input name="nid_number" maxLength="17" /></label><label>Blood group<select name="blood_group" defaultValue=""><option value="">Select</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(value => <option key={value}>{value}</option>)}</select></label><label>Education<select name="education" defaultValue="SSC">{['No Formal Education', 'PSC', 'JSC', 'SSC', 'HSC', 'Diploma', 'Graduate', 'Post Graduate', 'PhD', 'Others'].map(value => <option key={value}>{value}</option>)}</select></label><label>Height feet<input name="height_ft" type="number" min="1" max="8" /></label><label>Height inches<input name="height_in" type="number" min="0" max="11" /></label>{optionalFields.slice(0, 9).map(([name, label]) => <label key={name}>{label}<input name={name} type={name === 'email' ? 'email' : 'text'} /></label>)}</div><h3>Present address</h3><div className="react-form-grid"><LocationFields apiBase={API} divisions={data.divisions} names={{ division: 'present_division', district: 'present_district', upazila: 'present_upazila' }} /><label>Mobile number<input name="mobile_number" required /></label>{optionalFields.slice(9, 13).map(([name, label]) => <label key={name}>{label}<input name={name} /></label>)}</div><h3>Permanent address</h3><label className="react-check"><input name="same_as_present" type="checkbox" /> Same as present address</label><div className="react-form-grid"><LocationFields apiBase={API} divisions={data.divisions} names={{ division: 'permanent_division', district: 'permanent_district', upazila: 'permanent_upazila' }} required={false} />{optionalFields.slice(13, 17).map(([name, label]) => <label key={name}>{label}<input name={name} /></label>)}</div><h3>Contact and previous passport</h3><div className="react-form-grid">{optionalFields.slice(17).map(([name, label]) => <label key={name}>{label}<input name={name} type={name.includes('_date') ? 'date' : (name === 'email' ? 'email' : 'text')} /></label>)}<label>Emergency relation<select name="emergency_contact_relation" defaultValue=""><option value="">Select</option>{['Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Son', 'Daughter', 'Friend', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><label>Old passport issue date<input name="old_passport_issue_date" type="date" /></label><label>Old passport expiry date<input name="old_passport_expiry_date" type="date" /></label><label>Reason for reissue<select name="reason_for_reissue" defaultValue=""><option value="">Select</option>{['Expired', 'Lost', 'Damaged', 'Pages Exhausted', 'Name Change', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label></div><button className="btn-primary" disabled={submitting}>Submit application</button></form></section>}

      {section === 'documents' && <section className="react-panel"><h2>Upload application documents</h2><form className="react-form-stack" encType="multipart/form-data" onSubmit={uploadDocuments}><label>Application<select name="application_id" defaultValue="" required><option value="">Select</option>{data.applications.map(row => <option value={row.id} key={row.id}>{row.application_number}</option>)}</select></label><div className="react-form-grid">{[['photo', 'Photo', '.jpg,.jpeg,.png'], ['nid_scan', 'NID scan', '.jpg,.jpeg,.png,.pdf'], ['birth_cert', 'Birth certificate', '.jpg,.jpeg,.png,.pdf'], ['old_passport_scan', 'Old passport', '.jpg,.jpeg,.png,.pdf'], ['noc', 'NOC', '.jpg,.jpeg,.png,.pdf'], ['affidavit', 'Affidavit', '.jpg,.jpeg,.png,.pdf'], ['additional_doc', 'Additional document', '.jpg,.jpeg,.png,.pdf']].map(([name, label, accept]) => <label key={name}>{label}<input name={name} type="file" accept={accept} /></label>)}</div><button className="btn-primary" disabled={submitting}>Upload selected files</button></form>{result?.uploaded && <p className="react-notice success">Stored fields: {result.uploaded.join(', ')}</p>}</section>}

      {section === 'applications' && <section className="react-panel"><h2>My passport applications</h2><div className="react-card-list">{data.applications.map(row => <article key={row.id}><div><h3>{row.application_number}</h3><p>{row.service_type} · {row.passport_type} · ৳{Number(row.total_fee || 0).toLocaleString()}</p><p>Payment: {row.payment_status || 'Pending'} · {dateText(row.submitted_at)}</p></div><StatusBadge value={row.status} /><div className="react-card-actions"><button type="button" onClick={() => viewApplication(row.id)}>View</button>{['Submitted', 'Payment Verified'].includes(row.status) && <button className="btn-danger" type="button" onClick={() => cancelApplication(row.id)}>Cancel</button>}</div></article>)}{!data.applications.length && <p className="react-empty-state">No passport applications.</p>}</div>{details && <div className="react-result-card"><h3>{details.application.application_number}</h3><p>{details.application.full_name_en} · {details.application.office_name || 'Office pending'}</p><p>{details.application.present_district}, {details.application.present_division}</p><StatusBadge value={details.application.status} /><h4>Status history</h4>{rows(details.status_history).map((row, index) => <p key={row.id || index}>{row.old_status || 'Start'} → {row.new_status} · {dateText(row.created_at)}</p>)}</div>}</section>}

      {section === 'track' && <section className="react-panel"><h2>Track application</h2><form className="react-inline-form" onSubmit={track}><input aria-label="Passport application number" value={trackNumber} onChange={event => setTrackNumber(event.target.value)} required placeholder="EP2026082912345" /><button className="btn-primary">Track</button></form>{result?.application && <div className="react-result-card"><h3>{result.application.application_number}</h3><p>{result.application.full_name_en} · {result.application.office_name || 'Office pending'}</p><p>Payment: {result.application.payment_status}</p><StatusBadge value={result.application.status} />{rows(result.status_history).map((row, index) => <p key={row.id || index}>{row.new_status} · {dateText(row.created_at)}</p>)}</div>}</section>}

      {section === 'fees' && <div className="react-two-column"><section className="react-panel"><h2>Fee calculator</h2><form className="react-form-stack" onSubmit={calculateFee}><label>Passport type<select name="passport_type" defaultValue="Ordinary"><option>Ordinary</option><option>Official</option><option>Diplomatic</option></select></label><label>Pages<select name="page_count" defaultValue="48"><option value="48">48</option><option value="64">64</option></select></label><label>Validity<select name="validity_years" defaultValue="5"><option value="5">5 years</option><option value="10">10 years</option></select></label><label>Delivery<select name="delivery_type" defaultValue="Regular"><option>Regular</option><option>Express</option><option>Super Express</option></select></label><label>Service type<select name="service_type" defaultValue="New"><option>New</option><option>Lost Replacement</option><option>Damaged Replacement</option></select></label><button className="btn-primary">Calculate</button></form>{fee && <div className="react-result-card"><p>Base ৳{Number(fee.base_fee).toLocaleString()}</p><p>Penalty ৳{Number(fee.penalty).toLocaleString()}</p><h3>Total ৳{Number(fee.total_fee).toLocaleString()}</h3></div>}</section><section className="react-panel"><h2>Official schedule</h2><div className="react-card-list">{data.fees.map(row => <article key={row.id}><div><h3>{row.passport_type} · {row.page_count} pages</h3><p>{row.validity_years} years · {row.delivery_type}</p></div><strong>৳{Number(row.fee_bdt || 0).toLocaleString()}</strong></article>)}{!data.fees.length && <p className="react-empty-state">No active fee rows.</p>}</div></section></div>}

      {section === 'offices' && <section className="react-panel"><h2>Passport offices</h2><div className="react-service-card-grid">{data.offices.map(row => <article key={row.id || row.office_code}><h3>{row.office_name}</h3><p>{row.office_name_bn}</p><p>{row.address}</p><p>{row.phone || 'No phone'} · {row.email || 'No email'}</p></article>)}{!data.offices.length && <p className="react-empty-state">No active offices.</p>}</div></section>}

      {section === 'payment' && <DemoPaymentPanel service="Passport" note="Use this only if the authorized sandbox is unavailable during the presentation. The real application remains unpaid until a verified backend payment flow changes it." />}
    </>}
  </CitizenShell>;
}
