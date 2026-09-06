import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import DemoPaymentPanel from '../../components/DemoPaymentPanel.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { dateText, formPayload, LocationIdFields, StatusBadge } from './ServiceUi.jsx';

const API = '/api/departments';
const sections = ['overview', 'records', 'mutation', 'status', 'tax'];

export function landPayload(kind, form) {
  const values = formPayload(form);
  if (kind === 'record') return values;
  return {
    divId: values.divId, distId: values.distId, upaId: values.upaId,
    appNid: values.appNid, khatian: values.khatian, dag: values.dag,
    amount: values.amount, price: values.price, deed: values.deed,
    ownType: values.ownType, buyerNid: values.buyerNid
  };
}

export default function LandPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const [section, setSectionState] = useState(sections.includes(requested) ? requested : 'overview');
  const [records, setRecords] = useState([]);
  const [applications, setApplications] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [tracked, setTracked] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [error, setError] = useState('');
  const { submitting, runLocked } = useSubmissionLock();

  async function loadAll() {
    setLoading(true); setError('');
    try {
      const [recordRows, applicationRows, divisionRows] = await Promise.all([
        apiRequest(`${API}/land/records`), apiRequest(`${API}/land/applications`), apiRequest(`${API}/locations/divisions`)
      ]);
      setRecords(recordRows || []); setApplications(applicationRows || []); setDivisions(divisionRows || []);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  function setSection(next) {
    setSectionState(next);
    const nextParams = new URLSearchParams(params);
    if (next === 'overview') nextParams.delete('section'); else nextParams.set('section', next);
    setParams(nextParams, { replace: true });
  }

  async function submit(event, kind, path) {
    event.preventDefault(); const form = event.currentTarget;
    await runLocked(async () => {
      try {
        const response = await apiRequest(`${API}${path}`, { method: 'POST', body: landPayload(kind, form) });
        form.reset(); setSelectedRecord(null);
        await alerts.success('Submitted', response.trackingNumber ? `Tracking number: ${response.trackingNumber}` : response.message);
        await loadAll();
      } catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
    });
  }

  async function track(event) {
    event.preventDefault(); const values = formPayload(event.currentTarget);
    setTrackingLoading(true); setTracked(null); setError('');
    try { setTracked(await apiRequest(`${API}/land/mutation/status/${encodeURIComponent(values.tracking_number)}`)); }
    catch (requestError) { setError(requestError.message); }
    finally { setTrackingLoading(false); }
  }

  const approved = records.filter(row => row.status === 'Approved');
  const returnStatus = params.get('status');
  const returnTransaction = params.get('tid');

  return <CitizenShell>
    <header className="react-page-header"><div><h1>Land Services</h1><p>Owned records, mutation applications, and status tracking.</p></div></header>
    {(returnStatus || returnTransaction) && <div className="react-payment-warning" role="status"><i className="fas fa-shield-halved" /><span>Payment return parameters are unverified and are not proof of land-tax payment. Status: {returnStatus || 'unknown'}{returnTransaction ? ` · Transaction ${returnTransaction}` : ''}</span></div>}
    <nav className="react-service-tabs" aria-label="Land sections">{sections.map(value => <button type="button" className={section === value ? 'active' : ''} onClick={() => setSection(value)} key={value}>{value}</button>)}</nav>
    {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={loadAll}>Retry</button></div>}
    {loading ? <p className="react-empty-state">Loading land services…</p> : <>
      {section === 'overview' && <><div className="react-service-stats"><article className="react-panel"><strong>{records.length}</strong><span>My records</span></article><article className="react-panel"><strong>{approved.length}</strong><span>Verified records</span></article><article className="react-panel"><strong>{applications.length}</strong><span>Recent mutations</span></article></div><section className="react-panel"><h2>Recent mutation applications</h2><div className="react-card-list">{applications.map(row => <article key={row.id}><div><h3>Khatian {row.khatian_no}</h3><p>{dateText(row.created_at)}</p></div><StatusBadge value={row.status} /></article>)}{!applications.length && <p className="react-empty-state">No mutation applications.</p>}</div></section></>}

      {section === 'records' && <div className="react-two-column"><section className="react-panel"><h2>Add land record</h2><form className="react-form-stack" onSubmit={event => submit(event, 'record', '/land/records')}><div className="react-form-grid"><LocationIdFields apiBase={API} divisions={divisions} /><label>Mouza<input name="mouza" required /></label><label>Owner NID<input name="nid" required /></label><label>Khatian number<input name="khatian" required /></label><label>Dag number<input name="dag" required /></label><label>Deed number<input name="deed_no" required /></label><label>Land size<input name="land_size" type="number" min="0" step="0.0001" required /></label><label>Estimated price<input name="land_price" type="number" min="0" /></label><label>Description<input name="description" defaultValue="My Own Land" /></label></div><button className="btn-primary" disabled={submitting} type="submit">Verify and save record</button></form></section><section className="react-panel"><h2>My land records</h2><div className="react-card-list">{records.map((row, index) => <article key={`${row.source}-${row.id}-${index}`}><div><h3>Khatian {row.khatian_no} · Dag {row.dag_no}</h3><p>{row.mouza} · {row.land_size} decimals/acres</p><p>{row.upazila}, {row.district}, {row.division} · {row.source}</p></div><StatusBadge value={row.status} /></article>)}{!records.length && <p className="react-empty-state">No land records.</p>}</div></section></div>}

      {section === 'mutation' && <section className="react-panel react-narrow-panel"><h2>New mutation application</h2><label className="react-form-stack">Select verified land to prefill details<select value={selectedRecord ? `${selectedRecord.source}-${selectedRecord.id}` : ''} onChange={event => { const row = approved.find(item => `${item.source}-${item.id}` === event.target.value); setSelectedRecord(row || null); }}><option value="">Manual entry</option>{approved.map((row, index) => <option value={`${row.source}-${row.id}`} key={`${row.source}-${row.id}-${index}`}>Khatian {row.khatian_no} · Dag {row.dag_no} · {row.land_size}</option>)}</select></label><form className="react-form-stack react-service-spaced" key={selectedRecord ? `${selectedRecord.source}-${selectedRecord.id}` : 'manual'} onSubmit={event => submit(event, 'mutation', '/land/mutation_v2')}><div className="react-form-grid"><LocationIdFields apiBase={API} divisions={divisions} names={{ division: 'divId', district: 'distId', upazila: 'upaId' }} /><label>Applicant/current owner NID<input name="appNid" defaultValue={selectedRecord?.nid || ''} required /></label><label>Khatian<input name="khatian" defaultValue={selectedRecord?.khatian_no || ''} required /></label><label>Dag<input name="dag" defaultValue={selectedRecord?.dag_no || ''} required /></label><label>Transfer amount<input name="amount" type="number" min="0.0001" step="0.0001" max={selectedRecord?.land_size || undefined} required /></label><label>Estimated price<input name="price" type="number" min="0" defaultValue={selectedRecord?.land_price || ''} required /></label><label>Deed number<input name="deed" defaultValue={selectedRecord?.deed_no || ''} required /></label><label>Ownership type<select name="ownType" defaultValue="Own"><option>Own</option><option>Other</option></select></label><label>Buyer NID<input name="buyerNid" required /></label></div><button className="btn-primary" disabled={submitting} type="submit">Submit mutation</button></form></section>}

      {section === 'status' && <section className="react-panel react-narrow-panel"><h2>Track mutation</h2><form className="react-form-stack" onSubmit={track}><label>Tracking number<input name="tracking_number" required /></label><button className="btn-primary" disabled={trackingLoading} type="submit">{trackingLoading ? 'Checking…' : 'Check status'}</button></form>{tracked && <div className="react-card-list react-service-spaced"><article><div><h3>{tracked.tracking_number}</h3><p>Khatian {tracked.khatian_no} · Dag {tracked.dag_no}</p><p>Submitted {dateText(tracked.created_at)}</p></div><StatusBadge value={tracked.status} /></article></div>}</section>}

      {section === 'tax' && <><section className="react-panel react-narrow-panel"><h2>Land development tax</h2><p>Residential: 10 BDT/decimal; commercial: 20 BDT/decimal; the legacy page describes agricultural holdings up to 825 decimals as tax free.</p></section><DemoPaymentPanel service="Land-tax" note="This isolated fallback is for presentation continuity only and does not create a land-tax receipt in the database." /></>}
    </>}
  </CitizenShell>;
}
