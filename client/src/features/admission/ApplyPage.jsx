import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { dateText, StatusBadge } from '../services/ServiceUi.jsx';
import DemoPaymentPanel from '../../components/DemoPaymentPanel.jsx';

const API = '/api/university';

export function universityApplicationPayload(admissionId, hscData, form) {
  const values = Object.fromEntries(new FormData(form).entries());
  return { admissionPostId: admissionId, hscRoll: hscData.roll_number, hscYear: hscData.exam_year, mobile: values.mobile, email: values.email, presentAddress: values.presentAddress };
}

export default function ApplyPage() {
  const [params] = useSearchParams();
  const admissionId = params.get('id');
  const continuedId = params.get('continue') || params.get('applicationId');
  const [admission, setAdmission] = useState(null);
  const [hsc, setHsc] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { submitting, runLocked } = useSubmissionLock();
  const returnFlags = ['success', 'error', 'cancelled'].filter(key => params.has(key));

  useEffect(() => {
    let active = true;
    const jobs = [];
    if (admissionId) jobs.push(apiRequest(`${API}/admissions/${admissionId}`, { auth: false }).then(value => { if (active) setAdmission(value); }));
    if (continuedId) jobs.push(apiRequest(`${API}/application/${encodeURIComponent(continuedId)}`, { auth: false }).then(value => { if (active) setApplication(value); }));
    if (!jobs.length) { setError('Admission id is required.'); setLoading(false); return () => {}; }
    Promise.all(jobs).catch(requestError => { if (active) setError(requestError.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admissionId, continuedId]);

  async function verify(event) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    try {
      const response = await apiRequest(`${API}/verify-hsc/${encodeURIComponent(values.get('roll'))}/${values.get('year')}?admissionId=${admissionId}`, { auth: false });
      setEligibility(response); setHsc(response.hscData || null);
    } catch (requestError) { setError(requestError.message); }
  }

  async function apply(event) {
    event.preventDefault(); const form = event.currentTarget;
    await runLocked(async () => {
      try {
        const response = await apiRequest(`${API}/apply`, { method: 'POST', auth: false, body: universityApplicationPayload(admission.id, hsc, form) });
        setApplication({ application_id: response.applicationId, payment_status: 'Pending', application_status: 'Draft', payment_amount: response.paymentAmount });
        await alerts.success('Draft application created', `${response.applicationId}. Payment has not been verified.`);
      } catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
    });
  }

  return <main className="react-public-service"><header className="react-public-header"><Link to="/admission.html" className="react-brand-link">NationX Admissions</Link><Link to="/admission.html">Back to notices</Link></header><section className="react-public-content">
    {(returnFlags.length > 0 || params.has('applicationId')) && <div className="react-notice warning" role="status"><strong>Unverified payment return.</strong> URL parameters are not proof of payment. Only the server-owned status below is displayed, and the active callback still lacks gateway validation.</div>}
    {error && <div className="react-dashboard-error" role="alert">{error}</div>}
    {loading ? <p className="react-empty-state">Loading admission application…</p> : <>
      {admission && <section className="react-panel"><div className="react-section-heading"><div><h1>{admission.university_name}</h1><p>{admission.unit_code} — {admission.unit_name}</p></div><StatusBadge value={admission.status} /></div><p>Minimum GPA {admission.min_gpa} · Required group {admission.required_group || 'Any'}</p><p>Deadline {dateText(admission.end_date)} · Fee ৳{Number(admission.application_fee || 0).toLocaleString()}</p></section>}
      {application && <section className="react-panel react-service-spaced"><h2>Server-owned application status</h2><h3>{application.application_id}</h3><p>Payment: <StatusBadge value={application.payment_status} /> · Application: <StatusBadge value={application.application_status} /></p></section>}
      {admission && !application && <><section className="react-panel react-service-spaced"><h2>1. Verify HSC eligibility</h2><p className="react-notice warning">The underlying public result API exposes student and parent identity fields; this remains under privacy review.</p><form className="react-inline-form" onSubmit={verify}><input name="roll" required placeholder="HSC roll" /><select name="year" defaultValue="2024">{[2026, 2025, 2024, 2023, 2022, 2021].map(year => <option key={year}>{year}</option>)}</select><button className="btn-primary">Verify</button></form>{eligibility && <div className="react-result-card"><h3>{eligibility.eligible ? 'Eligible' : 'Not eligible'}</h3><p>{eligibility.reason || `${hsc.student_name} · GPA ${hsc.gpa} · ${hsc.exam_group}`}</p>{eligibility.alreadyApplied && <p>Existing application: {eligibility.applicationId} · {eligibility.paymentStatus}</p>}</div>}</section>{eligibility?.eligible && !eligibility.alreadyApplied && <section className="react-panel react-service-spaced"><h2>2. Create Draft application</h2><form className="react-form-stack" onSubmit={apply}><label>Mobile<input name="mobile" pattern="01[3-9][0-9]{8}" required /></label><label>Email<input name="email" type="email" /></label><label>Present address<textarea name="presentAddress" /></label><button className="btn-primary" disabled={submitting}>Create Draft application</button></form></section>}</>}
      <DemoPaymentPanel service="Admission fee" amount={application?.payment_amount || admission?.application_fee} note="The draft application's server-owned payment status remains Pending after this simulation." />
    </>}
  </section></main>;
}
