import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { dateText, EmptyRow, formPayload, StatusBadge } from './ServiceUi.jsx';

const sections = ['results', 'stipend'];

export function stipendPayload(stipendId, form) {
  const values = formPayload(form);
  return {
    stipendId: String(stipendId),
    studentDetails: { gpa: values.gpa, institution: values.institution },
    financialInfo: { monthlyIncome: values.monthlyIncome, members: values.members, land: values.land },
    guardianInfo: {},
    bankDetails: { method: values.method, accountNo: values.accountNo }
  };
}

export default function EducationPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const [section, setSectionState] = useState(sections.includes(requested) ? requested : 'results');
  const [years, setYears] = useState([]);
  const [boards, setBoards] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [stipends, setStipends] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedGrant, setSelectedGrant] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resultLoading, setResultLoading] = useState(false);
  const [error, setError] = useState('');
  const { submitting, runLocked } = useSubmissionLock();

  async function loadAll() {
    setLoading(true); setError('');
    try {
      const [yearRows, boardRows, institutionRows, stipendRows, applicationRows] = await Promise.all([
        apiRequest('/api/education/years'), apiRequest('/api/education/boards'), apiRequest('/api/education/institutions'),
        apiRequest('/api/stipends'), apiRequest('/api/stipends/my-applications')
      ]);
      setYears(yearRows || []); setBoards(boardRows || []); setInstitutions(institutionRows || []);
      setStipends(stipendRows || []); setApplications(applicationRows || []);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  function setSection(next) {
    setSectionState(next);
    const nextParams = new URLSearchParams(params);
    if (next === 'results') nextParams.delete('section'); else nextParams.set('section', next);
    setParams(nextParams, { replace: true });
  }

  async function checkResult(event) {
    event.preventDefault(); const values = formPayload(event.currentTarget);
    setResultLoading(true); setError(''); setResult(null);
    try {
      const response = await apiRequest(`/api/education/results/${encodeURIComponent(values.examType)}/${encodeURIComponent(values.examYear)}/${encodeURIComponent(values.rollNumber)}`);
      setResult(response);
    } catch (requestError) { setError(requestError.data?.message || requestError.message); }
    finally { setResultLoading(false); }
  }

  async function apply(event) {
    event.preventDefault(); const form = event.currentTarget;
    await runLocked(async () => {
      try {
        const response = await apiRequest('/api/stipends/apply', { method: 'POST', body: stipendPayload(selectedGrant.id, form) });
        await alerts.success('Application submitted', response.applicationNo || response.message);
        setSelectedGrant(null); await loadAll();
      } catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
    });
  }

  return <CitizenShell>
    <header className="react-page-header"><div><h1>Education Services</h1><p>Public examination results and authenticated stipend applications.</p></div><Link className="btn-secondary react-auto-width" to="/admission.html">University admission</Link></header>
    <nav className="react-service-tabs" aria-label="Education sections">{sections.map(value => <button type="button" className={section === value ? 'active' : ''} onClick={() => setSection(value)} key={value}>{value}</button>)}</nav>
    {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={loadAll}>Retry lists</button></div>}
    {loading ? <p className="react-empty-state">Loading education services…</p> : <>
      {section === 'results' && <><section className="react-panel react-narrow-panel"><h2>Check examination result</h2><form className="react-form-stack" onSubmit={checkResult}><label>Exam type<select name="examType" required defaultValue=""><option value="">Select exam</option><option value="jsc">JSC</option><option value="ssc">SSC</option><option value="hsc">HSC</option></select></label><label>Exam year<select name="examYear" required defaultValue=""><option value="">Select year</option>{years.map(value => <option key={value}>{value}</option>)}</select></label><label>Roll number<input name="rollNumber" required /></label><button className="btn-primary" disabled={resultLoading} type="submit">{resultLoading ? 'Checking…' : 'Check result'}</button></form><p>{boards.length} education boards and {institutions.length} institutions are available in the directory data.</p></section>{result && <section className="react-panel react-service-spaced" aria-label="Exam result"><header className="react-result-header"><div><h2>{result.examType} Examination Result {result.examYear}</h2><p>{result.student.name} · Roll {result.student.rollNumber}</p></div><div><strong>{result.result.gpa}</strong><StatusBadge value={result.result.status} /></div></header><div className="react-detail-grid"><p><strong>Registration</strong>{result.student.registrationNumber || '—'}</p><p><strong>Institution</strong>{result.student.institution || '—'}</p><p><strong>Board</strong>{result.student.board || '—'}</p><p><strong>Group</strong>{result.student.group || 'General'}</p><p><strong>Father</strong>{result.student.fatherName || '—'}</p><p><strong>Mother</strong>{result.student.motherName || '—'}</p></div><div className="react-table-wrap"><table><thead><tr><th>#</th><th>Subject</th><th>Grade</th></tr></thead><tbody>{result.subjects.map((subject, index) => <tr key={`${subject.name}-${index}`}><td>{index + 1}</td><td>{subject.name}</td><td><strong>{subject.grade}</strong></td></tr>)}</tbody></table></div><button className="btn-secondary react-service-action" type="button" onClick={() => window.print()}>Print result</button></section>}</>}

      {section === 'stipend' && !selectedGrant && <><div className="react-service-stats"><article className="react-panel"><strong>{stipends.length}</strong><span>Active grants</span></article><article className="react-panel"><strong>{applications.length}</strong><span>My applications</span></article></div><section className="react-panel"><h2>Available stipends</h2><div className="react-service-card-grid">{stipends.map(row => <article key={row.id}><h3>{row.title}</h3><p>{row.description}</p><p>BDT {Number(row.amount || 0).toLocaleString()} · Deadline {dateText(row.deadline)}</p>{row.min_gpa && <p>Minimum GPA: {row.min_gpa}</p>}{row.max_income && <p>Maximum monthly income: BDT {Number(row.max_income).toLocaleString()}</p>}<button className="btn-primary" type="button" onClick={() => setSelectedGrant(row)}>Apply now</button></article>)}{!stipends.length && <p className="react-empty-state">No active grants.</p>}</div></section><section className="react-panel react-service-spaced"><h2>My stipend applications</h2><div className="react-table-wrap"><table><thead><tr><th>Application</th><th>Stipend</th><th>Amount</th><th>Submitted</th><th>Status</th></tr></thead><tbody>{applications.map(row => <tr key={row.id}><td>{row.application_no}</td><td>{row.stipend_title}</td><td>BDT {Number(row.stipend_amount || 0).toLocaleString()}</td><td>{dateText(row.submitted_at)}</td><td><StatusBadge value={row.status} /></td></tr>)}{!applications.length && <EmptyRow columns={5}>No stipend applications.</EmptyRow>}</tbody></table></div></section></>}

      {section === 'stipend' && selectedGrant && <section className="react-panel react-narrow-panel"><div className="react-section-heading"><div><h2>Apply: {selectedGrant.title}</h2><p>Eligibility is checked by the existing backend.</p></div><button className="btn-secondary" type="button" onClick={() => setSelectedGrant(null)}>Back</button></div><form className="react-form-stack" onSubmit={apply}><label>GPA<input name="gpa" type="number" min="0" max="5" step="0.01" required /></label><label>Institution<input name="institution" /></label><label>Monthly family income<input name="monthlyIncome" type="number" min="0" required /></label><label>Family members<input name="members" type="number" min="0" /></label><label>Land owned<input name="land" type="number" min="0" step="0.01" /></label><label>Payment method<select name="method" defaultValue="Mobile Banking"><option>Mobile Banking</option><option>Bank Account</option></select></label><label>Account number<input name="accountNo" /></label><button className="btn-primary" disabled={submitting} type="submit">{submitting ? 'Submitting…' : 'Submit application'}</button></form></section>}
    </>}
  </CitizenShell>;
}
