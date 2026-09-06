import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { dateText, EmptyRow, StatusBadge } from '../services/ServiceUi.jsx';

const API = '/api/passport';
const PAGE_SIZE = 20;

export const PASSPORT_STATUSES = [
  'Submitted', 'Payment Verified', 'Under Review', 'Biometric Scheduled',
  'Biometric Enrolled', 'Police Verification', 'Police Verification Completed',
  'Approved', 'Printing', 'Dispatched', 'Ready for Delivery', 'Delivered',
  'Rejected', 'On Hold', 'Cancelled'
];

export const PASSPORT_DATE_FIELDS = {
  'Biometric Scheduled': 'biometric_date',
  'Biometric Enrolled': 'biometric_date',
  'Police Verification': 'police_verification_date',
  'Police Verification Completed': 'police_verification_date',
  Approved: 'approved_at',
  Printing: 'printed_at',
  Dispatched: 'dispatched_at',
  Delivered: 'delivered_at'
};

const FILTER_KEYS = ['status', 'office', 'date_from', 'date_to', 'search'];

export function passportAdminQuery(filters) {
  const query = new URLSearchParams();
  FILTER_KEYS.forEach(key => {
    const value = String(filters[key] || '').trim();
    if (value) query.set(key, value);
  });
  return query;
}

function initialFilters(params) {
  return Object.fromEntries(FILTER_KEYS.map(key => [key, params.get(key) || '']));
}

function moneyText(value) {
  return Number(value || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminPassportPage() {
  const { clearAdminSession } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(() => initialFilters(params));
  const [stats, setStats] = useState({});
  const [offices, setOffices] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(Math.max(1, Number(params.get('page')) || 1));
  const [selected, setSelected] = useState(null);
  const [nextStatus, setNextStatus] = useState('Submitted');
  const { submitting, runLocked } = useSubmissionLock();
  const totalPages = Math.max(1, Math.ceil(applications.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = useMemo(() => applications.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [applications, currentPage]);

  async function loadApplications(nextFilters = filters) {
    const query = passportAdminQuery(nextFilters);
    const rows = await apiRequest(`${API}/admin/applications${query.size ? `?${query}` : ''}`, { audience: 'admin' });
    setApplications(Array.isArray(rows) ? rows : []);
  }

  async function loadAll() {
    setLoading(true); setError('');
    try {
      const query = passportAdminQuery(filters);
      const [statsResponse, officeResponse, applicationResponse] = await Promise.all([
        apiRequest(`${API}/admin/stats`, { audience: 'admin' }),
        apiRequest(`${API}/offices`, { audience: 'admin' }),
        apiRequest(`${API}/admin/applications${query.size ? `?${query}` : ''}`, { audience: 'admin' })
      ]);
      setStats(statsResponse || {});
      setOffices(Array.isArray(officeResponse) ? officeResponse : []);
      setApplications(Array.isArray(applicationResponse) ? applicationResponse : []);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  async function applyFilters(event) {
    event.preventDefault();
    setLoading(true); setError(''); setPage(1); setSelected(null);
    const query = passportAdminQuery(filters);
    setParams(query, { replace: true });
    try { await loadApplications(filters); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  async function clearFilters() {
    const empty = initialFilters(new URLSearchParams());
    setFilters(empty); setPage(1); setSelected(null); setLoading(true); setError('');
    setParams(new URLSearchParams(), { replace: true });
    try { await loadApplications(empty); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  function changePage(next) {
    setPage(next);
    const query = passportAdminQuery(filters);
    if (next > 1) query.set('page', String(next));
    setParams(query, { replace: true });
  }

  async function viewApplication(row) {
    setError(''); setSelected({ row, loading: true });
    try {
      const detail = await apiRequest(`${API}/admin/application/${row.id}`, { audience: 'admin' });
      setSelected({ row, ...detail, loading: false });
      setNextStatus(detail.application?.status || row.status || 'Submitted');
    } catch (requestError) { setSelected(null); setError(requestError.message); }
  }

  async function updateStatus(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await runLocked(async () => {
      const body = { status: values.get('status') };
      const remarks = String(values.get('remarks') || '').trim();
      const rejectionReason = String(values.get('rejection_reason') || '').trim();
      const customDate = String(values.get('custom_date') || '').trim();
      if (remarks) body.remarks = remarks;
      if (body.status === 'Rejected' && rejectionReason) body.rejection_reason = rejectionReason;
      if (customDate && PASSPORT_DATE_FIELDS[body.status]) body[PASSPORT_DATE_FIELDS[body.status]] = customDate;
      try {
        const response = await apiRequest(`${API}/admin/application/${selected.application.id}/status`, { method: 'PUT', audience: 'admin', body });
        await alerts.success('Status updated', response.message);
        setSelected(null); await loadApplications(filters);
      } catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
    });
  }

  function logout() { clearAdminSession(); navigate('/index.html#admin', { replace: true }); }

  return <main className="react-public-service"><header className="react-public-header"><strong className="react-brand-link">NationX Admin · Passport</strong><nav><a href="/reports.html">Admin dashboard</a><button type="button" onClick={logout}>Log out</button></nav></header><section className="react-public-content">
    <header className="react-page-header"><div><h1>Passport administration</h1><p>Filter the queue, inspect its audit history, and update one application at a time.</p></div></header>
    {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={loadAll}>Retry</button></div>}
    <div className="react-service-stats">{[['Total', stats.total], ['Pending', stats.pending], ['Processing', stats.processing], ['Delivered', stats.delivered], ['Rejected', stats.rejected], ['Revenue (৳)', moneyText(stats.revenue)], ['Today', stats.today]].map(([label, value]) => <article className="react-panel" key={label}><strong>{value || 0}</strong><span>{label}</span></article>)}</div>
    <section className="react-panel"><form className="react-form-grid" onSubmit={applyFilters}><label>Status<select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{PASSPORT_STATUSES.map(value => <option key={value}>{value}</option>)}</select></label><label>Office<select value={filters.office} onChange={event => setFilters({ ...filters, office: event.target.value })}><option value="">All offices</option>{offices.map(office => <option value={office.office_code} key={office.office_code}>{office.office_name}</option>)}</select></label><label>From date<input type="date" value={filters.date_from} onChange={event => setFilters({ ...filters, date_from: event.target.value })} /></label><label>To date<input type="date" value={filters.date_to} onChange={event => setFilters({ ...filters, date_to: event.target.value })} /></label><label>Search<input aria-label="Search passport applications" value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder="Application, name or NID" /></label><div className="react-inline-form"><button className="btn-primary" type="submit">Apply filters</button><button type="button" onClick={clearFilters}>Clear</button></div></form></section>
    <section className="react-panel react-service-spaced"><div className="react-section-heading"><div><h2>Applications</h2><p>{applications.length} records · page {currentPage} of {totalPages}</p></div></div>{loading ? <p className="react-empty-state">Loading passport applications…</p> : <><div className="react-table-wrap"><table><thead><tr><th>Application</th><th>Applicant</th><th>NID</th><th>Type</th><th>Status</th><th>Office</th><th>Payment</th><th>Action</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><td>{row.application_number}</td><td>{row.full_name_en || row.user_name || '—'}</td><td>{row.nid_number || '—'}</td><td>{row.passport_type}</td><td><StatusBadge value={row.status} /></td><td>{row.office_name || '—'}</td><td><StatusBadge value={row.payment_status || 'Unpaid'} /></td><td><button type="button" onClick={() => viewApplication(row)}>Review</button></td></tr>)}{!visible.length && <EmptyRow columns={8}>No passport applications match these filters.</EmptyRow>}</tbody></table></div><div className="react-pagination"><button type="button" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>Previous</button><span>{currentPage} / {totalPages}</span><button type="button" disabled={currentPage >= totalPages} onClick={() => changePage(currentPage + 1)}>Next</button></div></>}</section>
    {selected && <section className="react-panel react-service-spaced"><div className="react-section-heading"><div><h2>Review {selected.row.application_number}</h2><p>Only this selected numeric application id will be updated.</p></div><button type="button" onClick={() => setSelected(null)}>Close</button></div>{selected.loading ? <p className="react-empty-state">Loading selected application…</p> : <><dl className="react-detail-grid">{Object.entries(selected.application || {}).filter(([, value]) => value !== null && value !== '' && typeof value !== 'object').map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{String(value)}</dd></div>)}</dl><h3>Status history</h3><div className="react-service-card-grid">{(selected.status_history || []).map(entry => <article key={entry.id}><strong>{entry.old_status || 'Created'} → {entry.new_status}</strong><p>{entry.remarks || 'No remarks'}</p><small>{entry.changed_by || 'System'} · {dateText(entry.created_at)}</small></article>)}{!selected.status_history?.length && <p className="react-empty-state">No status history recorded.</p>}</div><form className="react-form-stack react-service-spaced" onSubmit={updateStatus}><label>New status<select name="status" value={nextStatus} onChange={event => setNextStatus(event.target.value)}>{PASSPORT_STATUSES.map(value => <option key={value}>{value}</option>)}</select></label>{PASSPORT_DATE_FIELDS[nextStatus] && <label>Workflow date<input name="custom_date" type="datetime-local" /></label>}{nextStatus === 'Rejected' && <label>Rejection reason<textarea name="rejection_reason" /></label>}<label>Remarks<textarea name="remarks" defaultValue={selected.application?.admin_remarks || ''} /></label><button className="btn-primary" disabled={submitting}>Update selected application</button></form></>}</section>}
  </section></main>;
}
