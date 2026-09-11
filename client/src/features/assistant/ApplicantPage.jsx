import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth, isApplicantToken } from '../../context/AuthContext.jsx';
import { apiRequest } from '../../services/api.js';
import AssistantPanel from './AssistantPanel.jsx';
import { useSpeech } from './useSpeech';
import './assistant.css';
const root = '/api/nid/first-time-applications';
export default function ApplicantPage() {
  const { citizenToken, clearCitizenSession } = useAuth();
  const location = useLocation();
  const [account, setAccount] = useState(null); const [application, setApplication] = useState(null);
  const [values, setValues] = useState({}); const [review, setReview] = useState(null);
  const [code, setCode] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [demoCode, setDemoCode] = useState(location.state?.demoVerificationCode || '');
  const speech = useSpeech('bn');
  function apply(value) { setApplication(value); setValues(value?.fields || {}); setReview(null); }
  useEffect(() => {
    if (!citizenToken || !isApplicantToken(citizenToken)) return;
    let active = true;
    Promise.all([apiRequest('/api/applicants/me'), apiRequest(`${root}/current`)]).then(([a, draft]) => { if (active) { setAccount(a); apply(draft); } }).catch(e => active && setError(e.message)).finally(() => active && setLoaded(true));
    return () => { active = false; };
  }, [citizenToken]);
  if (!citizenToken) return <Navigate to="/index.html#signin" replace />;
  if (!isApplicantToken(citizenToken)) return <Navigate to="/nid.html" replace />;
  async function run(task) { if (busy) return; setBusy(true); setError(''); try { await task(); } catch (e) { setError(e.data?.message || e.message); setReview(null); } finally { setBusy(false); } }
  async function verify(event) {
    event.preventDefault(); await run(async () => { await apiRequest('/api/applicants/verify-contact', { method: 'POST', body: { code } }); setAccount(await apiRequest('/api/applicants/me')); });
  }
  async function save(event) {
    event.preventDefault(); await run(async () => apply(await apiRequest(`${root}/${application.id}/draft`, { method: 'PATCH', body: { fields: Object.fromEntries(Object.entries(values).filter(([,v]) => v)), confirmed: true, version: application.version } })));
  }
  async function upload(event, kind) {
    const file = event.target.files[0]; if (!file) return;
    await run(async () => { const form = new FormData(); form.append('document',file); form.append('kind',kind); form.append('version',String(application.version)); apply(await apiRequest(`${root}/${application.id}/documents`, { method: 'POST', body: form })); });
    event.target.value = '';
  }
  async function prepareReview() {
    await run(async () => {
      const value = await apiRequest(`${root}/${application.id}/review`, { method: 'POST', body: { version: application.version } }); setReview(value);
      speech.speak('জমা দেওয়ার আগে সব তথ্য যাচাই করুন। এটি সরকারি NID প্রদান করে না।', 'Review all details. This does not issue a government NID.');
    });
  }
  async function submit() {
    await run(async () => {
      const value = await apiRequest(`${root}/${application.id}/submit`, { method: 'POST', body: { version: review.application.version, confirmation_token: review.confirmation_token, confirmed: true } });
      apply(value); speech.speak(`আপনার আবেদন জমা হয়েছে। ট্র্যাকিং নম্বর: ${value.tracking_number}`, `Application submitted. Tracking number: ${value.tracking_number}`);
    });
  }
  const editable = application && ['DRAFT','ADDITIONAL_INFORMATION_REQUIRED'].includes(application.status);
  return <main className="nx-applicant">
    <header className="nx-applicant-nav"><Link to="/index.html">NationX</Link><span>First-time NID applicant</span><button onClick={clearCitizenSession}>Logout</button></header>
    <div className="nx-applicant-content"><header><small>YOUR FIRST STEP</small><h1>আপনার পরিচয়ের যাত্রা</h1><p>Apply for an NID. Save your progress. Stay in control.</p></header>
      <aside className="nx-notice">Limited applicant account · No NID issued. Citizen-only services remain locked after submission and approval. NationX is a local demonstration, not an Election Commission issuing service.</aside>
      {new URLSearchParams(location.search).has('blocked') && <p role="alert" className="nx-notice">এই সেবার জন্য NID প্রয়োজন। You cannot access that citizen service with an applicant account. Continue your application below.</p>}
      {error && <p role="alert" className="nx-notice">{error}</p>}
      {!loaded && <p role="status">Loading your account…</p>}
      {account && !account.contact_verified_at && <section className="nx-assistant"><h2>Local demonstration contact check</h2><p>No email or SMS is sent. This checks the demo flow only, not ownership of a real contact number.</p>{demoCode && <p>Demo code: <strong>{demoCode}</strong></p>}<form onSubmit={verify}><label>Demo verification code<input value={code} onChange={e => setCode(e.target.value)} pattern="[0-9]{6}" required /></label><button disabled={busy}>Confirm demo code</button></form><button disabled={busy} onClick={() => run(async () => { const result = await apiRequest('/api/applicants/contact-code',{method:'POST',body:{}});setDemoCode(result.demoVerificationCode); })}>Get a new demo code</button></section>}
      {account && <AssistantPanel accountKey={account.id} application={application} onApplication={apply} />}
      <section className="nx-assistant"><header><div><h2>Your application</h2><p>The manual form works without the microphone or Gemini.</p></div><button disabled={busy} onClick={() => run(async () => apply(await apiRequest(`${root}/current`)))}>Refresh status</button></header>
        {!application && loaded && <button disabled={busy || !account} onClick={() => run(async () => apply(await apiRequest(root, { method: 'POST', body: {} })))}>Start first-time application</button>}
        {application && <><p className="nx-notice">{application.rules.notice}</p><p role="status">Status: <strong>{application.status}</strong> · Draft version {application.version}</p><progress max={application.rules.fields.length + application.rules.documents.length} value={application.rules.fields.length + application.rules.documents.length - application.missing_fields.length - application.missing_documents.length} aria-label="Application progress" />
          {application.tracking_number && <section className="nx-receipt"><h3>Stored NationX tracking number</h3><output>{application.tracking_number}</output><p>This is a genuine stored NationX demo application reference—not an NID number.</p><button onClick={() => speech.speak(`ট্র্যাকিং নম্বর ${application.tracking_number}`, `Tracking number ${application.tracking_number}`)}>Read tracking number</button><button onClick={speech.stop}>Stop speech</button></section>}
          {editable && <><form className="nx-field-grid" onSubmit={save}>{application.rules.fields.map(key => <label key={key}>{application.rules.labels[key][0]}<small>{application.rules.labels[key][1]}</small>{key === 'gender' ? <select required value={values[key] || ''} onChange={e => { setValues({ ...values,[key]:e.target.value }); setReview(null); }}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select> : <input type={key === 'date_of_birth' ? 'date' : 'text'} maxLength={200} value={values[key] || ''} onChange={e => { setValues({ ...values,[key]:e.target.value }); setReview(null); }} />}</label>)}<button disabled={busy}>Confirm and save entered fields</button></form>
            <p>Profile suggestions (not saved until you confirm): <button disabled={busy} onClick={() => { setValues(v => ({ ...v,name_en:account.name,mobile:account.mobile })); setReview(null); }}>Use my account name and mobile</button></p>
            <h3>Required demonstration documents</h3><p>Use synthetic PNG/JPEG images only, up to 5 MB. Files are private and never sent to Gemini.</p>
            <div className="nx-field-grid">{application.rules.documents.map(kind => <label key={kind}>{kind.replaceAll('_',' ')}{application.documents.some(d => d.kind === kind) ? ' — uploaded ✓' : ' — required'}<input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={e => upload(e,kind)} /></label>)}</div>
            {application.documents.map(doc => <button key={doc.id} disabled={busy} onClick={() => run(async () => apply(await apiRequest(`${root}/${application.id}/documents/${doc.id}`, { method:'DELETE',body:{version:application.version} })))}>Remove {doc.kind}</button>)}
            <p><button disabled={busy || application.missing_fields.length > 0 || application.missing_documents.length > 0} onClick={prepareReview}>Review application</button></p>
          </>}
          {review && <section className="nx-review" aria-label="Final application review"><h3>Review before submission</h3><dl>{Object.entries(review.application.fields).map(([key,value]) => <div key={key}><dt>{review.application.rules.labels[key][1]}</dt><dd>{value}</dd></div>)}</dl><p>{review.notice}</p><div className="nx-actions"><button disabled={busy || !account.contact_verified_at} onClick={submit}>Yes — submit my application</button><button disabled={busy} onClick={() => setReview(null)}>No — keep editing</button></div>{!account.contact_verified_at && <p>Complete the demo contact check above before submitting.</p>}</section>}
          <h3>Status history</h3><ol>{application.history.map((row,i) => <li key={i}>{row.to_status} · {new Date(row.created_at).toLocaleString()} {row.remarks && <p>{row.remarks}</p>}</li>)}</ol>
        </>}
      </section><footer>Need help? Use the text form or ask your demonstration facilitator. No real NID issuance or automatic citizen activation is implemented.</footer>
    </div>
  </main>;
}
