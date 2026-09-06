import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import DemoPaymentPanel from '../../components/DemoPaymentPanel.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { dateText, EmptyRow, formPayload, LocationFields, StatusBadge } from './ServiceUi.jsx';

const API = '/api/water';
const sections = ['overview', 'connection', 'bill', 'quality', 'complaints', 'projects'];

export function waterPayload(kind, form) {
  const values = formPayload(form);
  if (kind === 'connection') return {
    holder_name: values.holder_name, nid_number: values.nid_number, phone: values.phone,
    connection_type: values.connection_type, pipe_size: values.pipe_size,
    wasa_region: values.wasa_region, division: values.division, district: values.district,
    upazila: values.upazila, ward_no: values.ward_no, address: values.address
  };
  if (kind === 'quality') return {
    source_type: values.source_type, issue_type: values.issue_type, severity: values.severity,
    affected_people: Number.parseInt(values.affected_people, 10) || 0,
    division: values.division, district: values.district, upazila: values.upazila,
    location_details: values.location_details, description: values.description
  };
  return {
    complaint_type: values.complaint_type, priority: values.priority,
    division: values.division, district: values.district, upazila: values.upazila,
    contact_phone: values.contact_phone, address: values.address, description: values.description
  };
}

export default function WaterPage() {
  const [params, setParams] = useSearchParams();
  const requestedSection = params.get('section');
  const [section, setSectionState] = useState(sections.includes(requestedSection) ? requestedSection : 'overview');
  const [data, setData] = useState({ stats: {}, activity: [], divisions: [], connections: [], bills: [], quality: [], complaints: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectDivision, setProjectDivision] = useState('');
  const [projectType, setProjectType] = useState('');
  const { submitting, runLocked } = useSubmissionLock();

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [stats, activity, divisions, connections, bills, quality, complaints, projects] = await Promise.all([
        apiRequest(`${API}/my-stats`), apiRequest(`${API}/my-activity`), apiRequest(`${API}/locations/divisions`),
        apiRequest(`${API}/connection/my-connections`), apiRequest(`${API}/bill/my-bills`),
        apiRequest(`${API}/quality/my-reports`), apiRequest(`${API}/complaint/my-complaints`),
        apiRequest(`${API}/projects/list`)
      ]);
      setData({ stats: stats || {}, activity: activity || [], divisions: divisions || [], connections: connections || [], bills: bills || [], quality: quality || [], complaints: complaints || [], projects: projects || [] });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  function setSection(next) {
    setSectionState(next);
    const nextParams = new URLSearchParams(params);
    if (next === 'overview') nextParams.delete('section'); else nextParams.set('section', next);
    setParams(nextParams, { replace: true });
  }

  async function submit(event, kind, path) {
    event.preventDefault();
    const form = event.currentTarget;
    await runLocked(async () => {
      setError('');
      try {
        const response = await apiRequest(`${API}${path}`, { method: 'POST', body: waterPayload(kind, form) });
        form.reset();
        await alerts.success('Submitted', response.message || 'Request submitted successfully.');
        await loadAll();
      } catch (requestError) {
        setError(requestError.message);
        await alerts.error(requestError.message);
      }
    });
  }

  const projects = useMemo(() => data.projects.filter(row => (!projectDivision || row.division === projectDivision) && (!projectType || row.project_type === projectType)), [data.projects, projectDivision, projectType]);

  return (
    <CitizenShell>
      <header className="react-page-header"><div><h1>Water Services</h1><p>Connections, service records, quality reports, complaints, and projects.</p></div></header>
      <nav className="react-service-tabs" aria-label="Water sections">{sections.map(value => <button type="button" className={section === value ? 'active' : ''} onClick={() => setSection(value)} key={value}>{value}</button>)}</nav>
      {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={loadAll}>Retry</button></div>}
      {loading ? <p className="react-empty-state">Loading water services…</p> : <>
        {section === 'overview' && <><div className="react-service-stats">{[['Connections', data.stats.total_connections], ['Active', data.stats.active_connections], ['Bill records', data.stats.total_bills], ['Pending bills', data.stats.pending_bills], ['Complaints', data.stats.total_complaints], ['Quality reports', data.stats.total_quality_reports]].map(([label, value]) => <article className="react-panel" key={label}><strong>{value || 0}</strong><span>{label}</span></article>)}</div><section className="react-panel"><h2>Recent activity</h2><div className="react-card-list">{data.activity.map((row, index) => <article key={`${row.type}-${row.created_at}-${index}`}><div><h3>{row.type} — {row.title || '—'}</h3><p>{dateText(row.created_at)}</p></div><StatusBadge value={row.status} /></article>)}{!data.activity.length && <p className="react-empty-state">No recent activity.</p>}</div></section></>}

        {section === 'connection' && <div className="react-two-column"><section className="react-panel"><h2>Apply for water connection</h2><form className="react-form-stack" onSubmit={event => submit(event, 'connection', '/connection/apply')}><div className="react-form-grid"><label>Holder name<input name="holder_name" required /></label><label>NID number<input name="nid_number" required /></label><label>Phone<input name="phone" required /></label><label>Connection type<select name="connection_type" required defaultValue=""><option value="">Select</option>{['Residential', 'Commercial', 'Industrial', 'Agricultural', 'Institutional'].map(value => <option key={value}>{value}</option>)}</select></label><label>Pipe size<select name="pipe_size" defaultValue="0.5 inch">{['0.5 inch', '0.75 inch', '1 inch', '1.5 inch', '2 inch'].map(value => <option key={value}>{value}</option>)}</select></label><label>WASA region<select name="wasa_region" defaultValue="DPHE Regional">{['Dhaka WASA', 'Chittagong WASA', 'Khulna WASA', 'Rajshahi WASA', 'DPHE Regional'].map(value => <option key={value}>{value}</option>)}</select></label><LocationFields apiBase={API} divisions={data.divisions} /><label>Ward number<input name="ward_no" /></label></div><label>Address<textarea name="address" rows="2" required /></label><button className="btn-primary" disabled={submitting} type="submit">{submitting ? 'Submitting…' : 'Submit application'}</button></form></section><section className="react-panel"><h2>My connections</h2><div className="react-card-list">{data.connections.map(row => <article key={row.id}><div><h3>{row.connection_number || 'Pending number'}</h3><p>{row.connection_type} · {row.wasa_region || 'DPHE Regional'}</p><p>{row.district} · {dateText(row.created_at)}</p></div><StatusBadge value={row.status} /></article>)}{!data.connections.length && <p className="react-empty-state">No water connections.</p>}</div></section></div>}

        {section === 'bill' && <><DemoPaymentPanel service="Water bill" note="The real backend records below remain authoritative; the simulation does not mark any bill Paid." /><section className="react-panel"><h2>My bill records</h2><div className="react-table-wrap"><table><thead><tr><th>Connection</th><th>Month</th><th>Units</th><th>Total</th><th>Method</th><th>Status</th><th>Date</th></tr></thead><tbody>{data.bills.map(row => <tr key={row.id}><td>{row.connection_number || '—'}</td><td>{row.billing_month}</td><td>{row.units_consumed || 0}</td><td>৳{Number(row.total_amount || 0).toFixed(2)}</td><td>{row.payment_method || '—'}</td><td><StatusBadge value={row.status} /></td><td>{dateText(row.created_at)}</td></tr>)}{!data.bills.length && <EmptyRow columns={7}>No bill records.</EmptyRow>}</tbody></table></div></section></>}

        {section === 'quality' && <div className="react-two-column"><section className="react-panel"><h2>Report water quality</h2><form className="react-form-stack" onSubmit={event => submit(event, 'quality', '/quality/report')}><label>Source type<select name="source_type" required defaultValue=""><option value="">Select</option>{['Tube Well', 'Deep Tube Well', 'WASA Pipeline', 'Pond', 'River', 'Reservoir', 'Rain Water', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><label>Issue type<select name="issue_type" required defaultValue=""><option value="">Select</option>{['Arsenic Contamination', 'Iron Content', 'Salinity', 'Color/Odor', 'Bacterial', 'Chemical', 'Turbidity', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><label>Severity<select name="severity" defaultValue="Medium"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label>Affected people<input name="affected_people" type="number" min="0" defaultValue="0" /></label><LocationFields apiBase={API} divisions={data.divisions} requireUpazila={false} /><label>Upazila (optional)<input name="upazila" /></label><label>Location details<input name="location_details" /></label><label>Description<textarea name="description" rows="3" required /></label><button className="btn-primary" disabled={submitting} type="submit">Submit report</button></form></section><section className="react-panel"><h2>My quality reports</h2><div className="react-card-list">{data.quality.map(row => <article key={row.id}><div><h3>{row.source_type} — {row.issue_type}</h3><p>{row.district} · {row.severity} · {dateText(row.created_at)}</p></div><StatusBadge value={row.status} /></article>)}{!data.quality.length && <p className="react-empty-state">No quality reports.</p>}</div></section></div>}

        {section === 'complaints' && <div className="react-two-column"><section className="react-panel"><h2>File water complaint</h2><form className="react-form-stack" onSubmit={event => submit(event, 'complaint', '/complaint/submit')}><label>Complaint type<select name="complaint_type" required defaultValue=""><option value="">Select</option>{['No Water Supply', 'Low Pressure', 'Pipeline Leakage', 'Contaminated Water', 'Meter Fault', 'Billing Error', 'Sewage Overflow', 'Illegal Connection', 'Pump Failure', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><label>Priority<select name="priority" defaultValue="Normal"><option>Low</option><option>Normal</option><option>High</option><option>Emergency</option></select></label><LocationFields apiBase={API} divisions={data.divisions} requireUpazila={false} /><label>Upazila (optional)<input name="upazila" /></label><label>Contact phone<input name="contact_phone" /></label><label>Address<input name="address" required /></label><label>Description<textarea name="description" rows="3" required /></label><button className="btn-primary" disabled={submitting} type="submit">Submit complaint</button></form></section><section className="react-panel"><h2>My complaints</h2><div className="react-card-list">{data.complaints.map(row => <article key={row.id}><div><h3>{row.complaint_type}</h3><p>{row.priority} · {row.district} · {dateText(row.created_at)}</p>{row.assigned_to && <p>Assigned to {row.assigned_to}</p>}</div><StatusBadge value={row.status} /></article>)}{!data.complaints.length && <p className="react-empty-state">No complaints.</p>}</div></section></div>}

        {section === 'projects' && <section className="react-panel"><div className="react-section-heading"><div><h2>Water projects</h2><p>Active public projects</p></div></div><div className="react-filter-grid"><label>Division<select value={projectDivision} onChange={event => setProjectDivision(event.target.value)}><option value="">All divisions</option>{data.divisions.map(row => <option value={row.name} key={row.id}>{row.name}</option>)}</select></label><label>Type<select value={projectType} onChange={event => setProjectType(event.target.value)}><option value="">All types</option>{[...new Set(data.projects.map(row => row.project_type))].map(value => <option key={value}>{value}</option>)}</select></label></div><div className="react-service-card-grid">{projects.map(row => <article key={row.id}><h3>{row.project_name}</h3>{row.project_name_bn && <p>{row.project_name_bn}</p>}<p>{row.project_type} · {row.division}{row.district ? `, ${row.district}` : ''}</p><p>{row.description}</p><div className="react-progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(row.progress_percent) || 0))}%` }} /></div><footer><StatusBadge value={row.status} /><span>{row.progress_percent || 0}%</span></footer></article>)}{!projects.length && <p className="react-empty-state">No projects found.</p>}</div></section>}
      </>}
    </CitizenShell>
  );
}
