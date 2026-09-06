import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { alerts } from '../../utils/alerts.js';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { dateText, EmptyRow, StatusBadge } from '../services/ServiceUi.jsx';

const API = '/api/nid/admin';
const PAGE_SIZE = 20;
export const NID_STATUS_MAP = {
  nid_applications: ['Draft', 'Submitted', 'Under Review', 'Biometric Pending', 'Verified', 'Approved', 'Rejected', 'Card Printing', 'Ready for Collection', 'Delivered'],
  nid_correction_requests: ['Draft', 'Submitted', 'Under Review', 'Document Verification', 'Approved', 'Rejected', 'Completed'],
  nid_reissue_requests: ['Draft', 'Submitted', 'Payment Pending', 'Under Review', 'Verified', 'Card Printing', 'Ready for Collection', 'Delivered', 'Rejected'],
  nid_address_changes: ['Draft', 'Submitted', 'Under Review', 'Verified', 'Updated', 'Rejected'],
  nid_smart_card_applications: ['Draft', 'Submitted', 'Payment Pending', 'Biometric Appointment', 'Biometric Done', 'Card Production', 'Quality Check', 'Ready for Collection', 'Delivered', 'Rejected']
};

export function filterNidApplications(applications, { type, status, search }) {
  const needle = search.trim().toLowerCase();
  return applications.filter(row => (!type || row.type === type) && (!status || row.status === status) && (!needle || `${row.ref_no} ${row.name_en || ''} ${row.name_bn || ''} ${row.user_name || ''}`.toLowerCase().includes(needle)));
}

export default function AdminNidPage() {
  const { clearAdminSession } = useAuth(); const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [stats, setStats] = useState({});
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ type: params.get('type') || '', status: params.get('status') || '', search: params.get('search') || '' });
  const [page, setPage] = useState(Math.max(1, Number(params.get('page')) || 1));
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const { submitting, runLocked } = useSubmissionLock();
  const filtered = useMemo(() => filterNidApplications(applications, filters), [applications, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((Math.min(page, totalPages) - 1) * PAGE_SIZE, Math.min(page, totalPages) * PAGE_SIZE);

  async function loadAll() {
    setLoading(true); setError('');
    try {
      const [statsResponse, appsResponse] = await Promise.all([apiRequest(`${API}/stats`, { audience: 'admin' }), apiRequest(`${API}/applications`, { audience: 'admin' })]);
      setStats(statsResponse || {}); setApplications(Array.isArray(appsResponse) ? appsResponse : []);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  function changeFilters(next) {
    setFilters(next); setPage(1);
    const query = new URLSearchParams();
    if (next.type) query.set('type', next.type); if (next.status) query.set('status', next.status); if (next.search) query.set('search', next.search);
    setParams(query, { replace: true });
  }

  function changePage(next) {
    setPage(next); const query = new URLSearchParams(params); if (next > 1) query.set('page', String(next)); else query.delete('page'); setParams(query, { replace: true });
  }

  async function view(row) {
    setSelected(row); setDetails(null); setError('');
    try { setDetails(await apiRequest(`${API}/application/${encodeURIComponent(row.ref_no)}?table=${encodeURIComponent(row.source_table)}`, { audience: 'admin' })); }
    catch (requestError) { setError(requestError.message); }
  }

  async function updateStatus(event) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    await runLocked(async () => {
      try {
        const body = { refNo: selected.ref_no, sourceTable: selected.source_table, status: values.get('status'), remarks: values.get('remarks') };
        const response = await apiRequest(`${API}/update-status`, { method: 'POST', audience: 'admin', body });
        await alerts.success('Status updated', response.message); setSelected(null); setDetails(null); await loadAll();
      } catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
    });
  }

  function logout() { clearAdminSession(); navigate('/index.html#admin', { replace: true }); }

  return <main className="react-public-service"><header className="react-public-header"><strong className="react-brand-link">NationX Admin · NID</strong><nav><a href="/reports.html">Admin dashboard</a><button type="button" onClick={logout}>Log out</button></nav></header><section className="react-public-content">
    <header className="react-page-header"><div><h1>NID application administration</h1><p>Review and update one selected NID request at a time.</p></div></header>
    {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={loadAll}>Retry</button></div>}
    {loading ? <p className="react-empty-state">Loading NID admin records…</p> : <>
      <div className="react-service-stats">{[['Total', stats.total], ['Pending', stats.pending], ['Processing', stats.processing], ['Approved', stats.approved], ['Rejected', stats.rejected], ['Corrections', stats.corrections]].map(([label, value]) => <article className="react-panel" key={label}><strong>{value || 0}</strong><span>{label}</span></article>)}</div>
      <section className="react-panel"><div className="react-section-heading"><div><h2>Applications</h2><p>{filtered.length} filtered records · page {Math.min(page, totalPages)} of {totalPages}</p></div><div className="react-inline-form"><select aria-label="Filter type" value={filters.type} onChange={event => changeFilters({ ...filters, type: event.target.value })}><option value="">All types</option><option>New NID</option><option>Correction</option><option>Reissue</option></select><select aria-label="Filter status" value={filters.status} onChange={event => changeFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{[...new Set(applications.map(row => row.status))].map(value => <option key={value}>{value}</option>)}</select><input aria-label="Search NID applications" value={filters.search} onChange={event => changeFilters({ ...filters, search: event.target.value })} placeholder="Reference or citizen" /></div></div><div className="react-table-wrap"><table><thead><tr><th>Reference</th><th>Type</th><th>Citizen</th><th>Created</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map(row => <tr key={`${row.source_table}-${row.ref_no}`}><td>{row.ref_no}</td><td>{row.type}</td><td>{row.name_en || row.name_bn || row.user_name || 'N/A'}</td><td>{dateText(row.created_at)}</td><td><StatusBadge value={row.status} /></td><td><button type="button" onClick={() => view(row)}>Review</button></td></tr>)}{!visible.length && <EmptyRow columns={6}>No matching applications.</EmptyRow>}</tbody></table></div><div className="react-pagination"><button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button><span>{Math.min(page, totalPages)} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next</button></div></section>
      {selected && <section className="react-panel react-service-spaced"><div className="react-section-heading"><div><h2>Review {selected.ref_no}</h2><p>{selected.type}</p></div><button type="button" onClick={() => { setSelected(null); setDetails(null); }}>Close</button></div>{!details ? <p className="react-empty-state">Loading selected record…</p> : <><dl className="react-detail-grid">{Object.entries(details).filter(([, value]) => value !== null && value !== '' && typeof value !== 'object').map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{String(value)}</dd></div>)}</dl><form className="react-form-stack react-service-spaced" onSubmit={updateStatus}><label>Status<select name="status" defaultValue={details.status}>{(NID_STATUS_MAP[selected.source_table] || []).map(value => <option key={value}>{value}</option>)}</select></label><label>Remarks<textarea name="remarks" defaultValue={details.admin_remarks || details.rejection_reason || ''} /></label><button className="btn-primary" disabled={submitting}>Update selected record</button></form></>}</section>}
    </>}
  </section></main>;
}
