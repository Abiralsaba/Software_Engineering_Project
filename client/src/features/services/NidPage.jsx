import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { dateText, LocationIdFields, StatusBadge } from './ServiceUi.jsx';

const API = '/api/nid';
const sections = ['overview', 'profile', 'correction', 'reissue', 'smart-card', 'address', 'verification', 'appointments', 'family', 'applications', 'information'];
const emptyData = { dashboard: {}, profile: {}, fees: [], centers: [], corrections: [], reissues: [], smartCards: [], addresses: [], verifications: [], appointments: [], family: [], applications: [], divisions: [] };

const profileTextFields = [
  ['name_bn', 'Name (Bangla)'], ['name_en', 'Name (English)'], ['father_name_bn', 'Father name (Bangla)'], ['father_name_en', 'Father name (English)'],
  ['mother_name_bn', 'Mother name (Bangla)'], ['mother_name_en', 'Mother name (English)'], ['spouse_name_bn', 'Spouse name (Bangla)'], ['spouse_name_en', 'Spouse name (English)'],
  ['birth_place_bn', 'Birth place (Bangla)'], ['birth_place_en', 'Birth place (English)'], ['birth_certificate_no', 'Birth certificate number'],
  ['mobile_primary', 'Primary mobile'], ['mobile_secondary', 'Secondary mobile'], ['email', 'Email'], ['present_post_office', 'Present post office'],
  ['present_post_code', 'Present post code'], ['present_ward_no', 'Present ward'], ['present_village_bn', 'Present village (Bangla)'], ['present_village_en', 'Present village (English)'],
  ['present_road_no', 'Present road'], ['present_house_no', 'Present house'], ['permanent_post_office', 'Permanent post office'], ['permanent_post_code', 'Permanent post code'],
  ['permanent_ward_no', 'Permanent ward'], ['permanent_village_bn', 'Permanent village (Bangla)'], ['permanent_village_en', 'Permanent village (English)'],
  ['permanent_road_no', 'Permanent road'], ['permanent_house_no', 'Permanent house'], ['educational_qualification', 'Education'], ['occupation', 'Occupation (English)'], ['occupation_bn', 'Occupation (Bangla)']
];

function rows(value) { return Array.isArray(value) ? value : []; }
function profileSeed(response) { return response?.exists ? response.profile : (response?.based_on_registration || {}); }

function HistoryCards({ items, empty, title = row => row.request_no || row.application_no || row.appointment_ref || row.member_name }) {
  return <div className="react-card-list">{items.map((row, index) => <article key={row.id || `${title(row)}-${index}`}><div><h3>{title(row)}</h3><p>{dateText(row.created_at || row.appointment_date)}{row.fee_amount ? ` · ৳${Number(row.fee_amount).toLocaleString()}` : ''}</p></div>{row.status && <StatusBadge value={row.status} />}</article>)}{!items.length && <p className="react-empty-state">{empty}</p>}</div>;
}

export function correctionFormData(form) {
  return new FormData(form);
}

export function addressFormData(form) {
  const data = new FormData(form);
  for (const [current, legacy] of [['new_division_id', 'new_division'], ['new_district_id', 'new_district'], ['new_upazila_id', 'new_upazila'], ['new_ward', 'new_ward_no'], ['new_house', 'new_house_no'], ['change_reason', 'reason']]) {
    if (data.get(current) && !data.has(legacy)) data.append(legacy, data.get(current));
  }
  return data;
}

export default function NidPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const [section, setSectionState] = useState(sections.includes(requested) ? requested : 'overview');
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [slots, setSlots] = useState([]);
  const [trackRef, setTrackRef] = useState(params.get('ref') || '');
  const { submitting, runLocked } = useSubmissionLock();
  const seed = useMemo(() => profileSeed(data.profile), [data.profile]);
  const nid = data.dashboard?.profile?.nid_number || seed.nid_number || '';

  async function loadAll() {
    setLoading(true); setError('');
    try {
      const [dashboard, profile, fees, centers, corrections, reissues, smartCards, addresses, verifications, appointments, family, applications, divisions] = await Promise.all([
        apiRequest(`${API}/dashboard`), apiRequest(`${API}/profile`), apiRequest(`${API}/fees`, { auth: false }), apiRequest(`${API}/centers`, { auth: false }),
        apiRequest(`${API}/corrections`), apiRequest(`${API}/reissue`), apiRequest(`${API}/smart-card`), apiRequest(`${API}/address-change`),
        apiRequest(`${API}/verifications`), apiRequest(`${API}/appointments`), apiRequest(`${API}/family`), apiRequest(`${API}/all-applications`), apiRequest(`${API}/locations/divisions`)
      ]);
      setData({ dashboard: dashboard || {}, profile: profile || {}, fees: rows(fees), centers: rows(centers), corrections: rows(corrections), reissues: rows(reissues), smartCards: rows(smartCards), addresses: rows(addresses), verifications: rows(verifications), appointments: rows(appointments), family: rows(family), applications: rows(applications), divisions: rows(divisions) });
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  function setSection(next) {
    setSectionState(next); setResult(null);
    const nextParams = new URLSearchParams(params);
    if (next === 'overview') nextParams.delete('section'); else nextParams.set('section', next);
    setParams(nextParams, { replace: true });
  }

  async function submit(event, path, bodyFactory = form => Object.fromEntries(new FormData(form).entries())) {
    event.preventDefault(); const form = event.currentTarget;
    await runLocked(async () => {
      try {
        const response = await apiRequest(`${API}${path}`, { method: 'POST', body: bodyFactory(form) });
        setResult(response); await alerts.success('Submitted', response.message || 'Request submitted.'); form.reset(); await loadAll();
      } catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
    });
  }

  async function loadSlots(form) {
    const center = form.elements.center_id.value; const date = form.elements.appointment_date.value;
    if (!center || !date) return setSlots([]);
    try { setSlots(rows(await apiRequest(`${API}/appointments/slots/${center}/${date}`))); }
    catch (requestError) { setError(requestError.message); }
  }

  async function track(event) {
    event.preventDefault();
    try {
      const response = await apiRequest(`${API}/track/${encodeURIComponent(trackRef.trim())}`);
      setResult(response); const next = new URLSearchParams(params); next.set('section', 'applications'); next.set('ref', trackRef.trim()); setParams(next, { replace: true });
    } catch (requestError) { setResult(null); setError(requestError.message); }
  }

  async function removeFamily(id) {
    try { await apiRequest(`${API}/family/${id}`, { method: 'DELETE' }); await loadAll(); }
    catch (requestError) { setError(requestError.message); }
  }

  return <CitizenShell>
    <header className="react-page-header"><div><h1>National Identity Services</h1><p>NID profile, corrections, reissue, smart card, verification, appointments, and family records.</p></div></header>
    <nav className="react-service-tabs" aria-label="NID sections">{sections.map(value => <button type="button" className={section === value ? 'active' : ''} onClick={() => setSection(value)} key={value}>{value.replace('-', ' ')}</button>)}</nav>
    {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={loadAll}>Retry</button></div>}
    {result?.referenceNumber && <div className="react-notice success">Reference: <strong>{result.referenceNumber}</strong></div>}
    {loading ? <p className="react-empty-state">Loading NID services…</p> : <>
      {section === 'overview' && <><div className="react-service-stats">{[['Corrections', data.dashboard.stats?.corrections], ['Reissues', data.dashboard.stats?.reissues], ['Smart cards', data.dashboard.stats?.smart_cards], ['Address changes', data.dashboard.stats?.address_changes], ['Verifications', data.dashboard.stats?.verifications]].map(([label, value]) => <article className="react-panel" key={label}><strong>{value || 0}</strong><span>{label}</span></article>)}</div><section className="react-panel"><h2>{data.dashboard.profile?.name_en || 'Citizen NID profile'}</h2><p>NID: {nid || 'Not linked'} · Status: <StatusBadge value={data.dashboard.profile?.profile_status} /></p><HistoryCards items={rows(data.dashboard.recentApplications)} empty="No recent NID applications." title={row => `${row.type}: ${row.ref_no}`} /></section></>}

      {section === 'profile' && <section className="react-panel"><h2>Create or update NID profile</h2><form className="react-form-stack" encType="multipart/form-data" onSubmit={event => submit(event, '/profile', form => new FormData(form))}><div className="react-form-grid">{profileTextFields.map(([name, label]) => <label key={name}>{label}<input name={name} defaultValue={seed[name] || ''} type={name === 'email' ? 'email' : 'text'} /></label>)}<label>Date of birth<input name="date_of_birth" type="date" defaultValue={seed.date_of_birth ? String(seed.date_of_birth).slice(0, 10) : ''} required /></label><label>Gender<select name="gender" defaultValue={seed.gender || 'Male'}><option>Male</option><option>Female</option><option>Other</option></select></label><label>Blood group<select name="blood_group" defaultValue={seed.blood_group || ''}><option value="">Select</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(value => <option key={value}>{value}</option>)}</select></label><label>Religion<input name="religion" defaultValue={seed.religion || ''} /></label><LocationIdFields apiBase={API} divisions={data.divisions} names={{ division: 'present_division_id', district: 'present_district_id', upazila: 'present_upazila_id' }} required={false} /><LocationIdFields apiBase={API} divisions={data.divisions} names={{ division: 'permanent_division_id', district: 'permanent_district_id', upazila: 'permanent_upazila_id' }} required={false} /><label>Photo<input name="photo" type="file" accept=".jpg,.jpeg,.png" /></label><label>Signature<input name="signature" type="file" accept=".jpg,.jpeg,.png" /></label></div><p className="react-notice warning">The current backend accepts these upload fields but does not return proof that profile photo/signature paths were stored.</p><button className="btn-primary" disabled={submitting}>Save profile</button></form></section>}

      {section === 'correction' && <div className="react-two-column"><section className="react-panel"><h2>Submit correction</h2><form className="react-form-stack" encType="multipart/form-data" onSubmit={event => submit(event, '/corrections', correctionFormData)}><label>NID number<input name="nid_number" defaultValue={nid} required /></label><label>Correction type<select name="correction_type" defaultValue="Name" required>{['Name', 'Father Name', 'Mother Name', 'Spouse Name', 'Date of Birth', 'Blood Group', 'Present Address', 'Permanent Address', 'Photo', 'Signature', 'Educational Qualification', 'Occupation', 'Multiple Fields'].map(value => <option key={value}>{value}</option>)}</select></label><label>Current value<textarea name="current_value" required /></label><label>Corrected value<textarea name="corrected_value" required /></label><label>Supporting documents (maximum 3)<input name="documents" type="file" multiple accept=".jpg,.jpeg,.png,.pdf" /></label><label>Document description<textarea name="document_description" /></label><button className="btn-primary" disabled={submitting}>Submit correction</button></form></section><section className="react-panel"><h2>Correction history</h2><HistoryCards items={data.corrections} empty="No correction requests." /></section></div>}

      {section === 'reissue' && <div className="react-two-column"><section className="react-panel"><h2>Request NID reissue</h2><form className="react-form-stack" encType="multipart/form-data" onSubmit={event => submit(event, '/reissue', form => new FormData(form))}><label>NID number<input name="nid_number" defaultValue={nid} required /></label><label>Reason<select name="reason" defaultValue="Lost">{['Lost', 'Stolen', 'Damaged', 'Expired', 'Upgrade to Smart Card', 'Name Change After Marriage'].map(value => <option key={value}>{value}</option>)}</select></label><label>Details<textarea name="details" /></label><label>GD number<input name="gd_number" /></label><label>GD date<input name="gd_date" type="date" /></label><label>Police station<input name="police_station" /></label><label>GD document<input name="gd_document" type="file" accept=".jpg,.jpeg,.png,.pdf" /></label><label>Damaged-card photo<input name="damaged_photo" type="file" accept=".jpg,.jpeg,.png" /></label><label>Delivery type<select name="delivery_type" defaultValue="Collection Center"><option>Collection Center</option><option>Post Office</option><option>Home Delivery</option></select></label><label>Collection center<select name="collection_center_id" defaultValue=""><option value="">Select</option>{data.centers.map(row => <option value={row.id} key={row.id}>{row.center_name}</option>)}</select></label><label>Delivery address<textarea name="delivery_address" /></label><button className="btn-primary" disabled={submitting}>Submit reissue</button></form></section><section className="react-panel"><h2>Reissue history</h2><HistoryCards items={data.reissues} empty="No reissue requests." /></section></div>}

      {section === 'smart-card' && <div className="react-two-column"><section className="react-panel"><h2>Apply for smart card</h2><form className="react-form-stack" onSubmit={event => submit(event, '/smart-card')}><label>NID number<input name="nid_number" defaultValue={nid} required /></label><label>Current card type<select name="current_card_type" defaultValue="Standard"><option>Standard</option><option>Old Laminated</option><option>None</option></select></label>{[['include_driving_license', 'Driving licence'], ['include_passport_info', 'Passport information'], ['include_health_id', 'Health ID'], ['include_bank_account', 'Bank account']].map(([name, label]) => <label className="react-check" key={name}><input type="checkbox" name={name} /> Include {label}</label>)}<label>Collection center<select name="collection_center_id" required defaultValue=""><option value="">Select</option>{data.centers.map(row => <option value={row.id} key={row.id}>{row.center_name}</option>)}</select></label><label>Biometric appointment<input name="biometric_appointment" type="date" /></label><button className="btn-primary" disabled={submitting}>Submit smart-card request</button></form></section><section className="react-panel"><h2>Smart-card history</h2><HistoryCards items={data.smartCards} empty="No smart-card applications." /></section></div>}

      {section === 'address' && <div className="react-two-column"><section className="react-panel"><h2>Change NID address</h2><form className="react-form-stack" encType="multipart/form-data" onSubmit={event => submit(event, '/address-change', addressFormData)}><label>NID number<input name="nid_number" defaultValue={nid} required /></label><label>Address type<select name="address_type" defaultValue="Present"><option>Present</option><option>Permanent</option><option>Both</option></select></label><label>Old address<textarea name="old_address" /></label><LocationIdFields apiBase={API} divisions={data.divisions} names={{ division: 'new_division_id', district: 'new_district_id', upazila: 'new_upazila_id' }} /><label>Post office<input name="new_post_office" /></label><label>Post code<input name="new_post_code" /></label><label>Ward<input name="new_ward" /></label><label>Village<input name="new_village" /></label><label>Road<input name="new_road" /></label><label>House<input name="new_house" /></label><label>Reason<textarea name="change_reason" /></label><label>Proof document<input name="proof_document" type="file" accept=".jpg,.jpeg,.png,.pdf" /></label><label>Document type<select name="document_type" defaultValue="Utility Bill"><option>Utility Bill</option><option>Holding Tax Receipt</option><option>Rental Agreement</option><option>Other</option></select></label><button className="btn-primary" disabled={submitting}>Submit address change</button></form></section><section className="react-panel"><h2>Address-change history</h2><HistoryCards items={data.addresses} empty="No address changes." /></section></div>}

      {section === 'verification' && <div className="react-two-column"><section className="react-panel"><h2>Verify NID details</h2><p className="react-notice warning">This endpoint can return identity fields for a supplied NID. Its access policy remains under security review.</p><form className="react-form-stack" onSubmit={event => submit(event, '/verify')}><label>Verification type<select name="verification_type" defaultValue="Self"><option>Self</option><option>Family Member</option><option>Employee</option><option>Customer</option></select></label><label>Purpose<input name="purpose" /></label><label>NID to verify<input name="verify_nid_number" required /></label><label>Expected name<input name="verify_name" /></label><label>Expected date of birth<input name="verify_dob" type="date" /></label><button className="btn-primary" disabled={submitting}>Verify</button></form>{result?.verification_status && <div className="react-result-card"><h3>{result.verification_status}</h3><p>{result.message}</p>{result.verified_data && <p>{result.verified_data.name_en} · {dateText(result.verified_data.date_of_birth)}</p>}</div>}</section><section className="react-panel"><h2>Verification history</h2><HistoryCards items={data.verifications} empty="No verifications." title={row => `${row.verification_type}: ${row.verify_nid_number}`} /></section></div>}

      {section === 'appointments' && <div className="react-two-column"><section className="react-panel"><h2>Book biometric appointment</h2><form className="react-form-stack" onSubmit={event => submit(event, '/appointments')} onChange={event => { if (['center_id', 'appointment_date'].includes(event.target.name)) loadSlots(event.currentTarget); }}><label>Application type<select name="application_type" defaultValue="New NID"><option>New NID</option><option>Smart Card</option><option>Biometric Update</option><option>Correction</option></select></label><label>Related application ID<input name="related_application_id" /></label><label>Center<select name="center_id" defaultValue="" required><option value="">Select</option>{data.centers.map(row => <option value={row.id} key={row.id}>{row.center_name}</option>)}</select></label><label>Date<input name="appointment_date" type="date" required /></label><label>Time slot<select name="time_slot" defaultValue="" required><option value="">Select</option>{slots.map(row => <option value={row.slot} disabled={row.full} key={row.slot}>{row.slot} ({row.available} available)</option>)}</select></label><button className="btn-primary" disabled={submitting}>Book appointment</button></form></section><section className="react-panel"><h2>Appointments</h2><HistoryCards items={data.appointments} empty="No biometric appointments." /></section></div>}

      {section === 'family' && <div className="react-two-column"><section className="react-panel"><h2>Add family member</h2><form className="react-form-stack" onSubmit={event => submit(event, '/family')}><label>Relation<select name="relation" defaultValue="Father">{['Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><label>Name<input name="member_name" required /></label><label>NID<input name="member_nid" /></label><label>Date of birth<input name="member_dob" type="date" /></label><label>Occupation<input name="member_occupation" /></label><label className="react-check"><input name="is_dependent" type="checkbox" /> Dependent</label><button className="btn-primary" disabled={submitting}>Add member</button></form></section><section className="react-panel"><h2>Family members</h2><div className="react-card-list">{data.family.map(row => <article key={row.id}><div><h3>{row.member_name}</h3><p>{row.relation} · {row.member_nid || 'No NID'}</p></div><button className="btn-danger" type="button" onClick={() => removeFamily(row.id)}>Remove</button></article>)}{!data.family.length && <p className="react-empty-state">No family members.</p>}</div></section></div>}

      {section === 'applications' && <><section className="react-panel"><h2>Track an application</h2><form className="react-inline-form" onSubmit={track}><input aria-label="Reference number" value={trackRef} onChange={event => setTrackRef(event.target.value)} placeholder="COR-2026-123456" required /><button className="btn-primary">Track</button></form>{result?.reference_number && <div className="react-result-card"><h3>{result.type}: {result.reference_number}</h3><StatusBadge value={result.status} /></div>}</section><section className="react-panel react-service-spaced"><h2>All applications</h2><HistoryCards items={data.applications} empty="No NID applications." title={row => `${row.type}: ${row.ref_no}`} /></section></>}

      {section === 'information' && <div className="react-two-column"><section className="react-panel"><h2>Collection centers</h2><div className="react-card-list">{data.centers.map(row => <article key={row.id}><div><h3>{row.center_name}</h3><p>{row.address}</p><p>{row.opening_time}–{row.closing_time} · {row.phone || 'No phone'}</p></div></article>)}{!data.centers.length && <p className="react-empty-state">No active centers.</p>}</div></section><section className="react-panel"><h2>Fee schedule</h2><div className="react-card-list">{data.fees.map(row => <article key={row.id}><div><h3>{row.service_name || row.service_code}</h3><p>Normal ৳{Number(row.normal_fee || 0).toLocaleString()}</p></div></article>)}{!data.fees.length && <p className="react-empty-state">No active fee records.</p>}</div></section></div>}
    </>}
  </CitizenShell>;
}
