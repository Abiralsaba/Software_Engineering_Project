import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { EmptyRow, StatusBadge } from '../services/ServiceUi.jsx';

export const REPORT_SECTIONS = {
  overview: [['Summary', '/api/reports/summary'], ['Service pivot', '/api/reports/service-pivot'], ['Division performance', '/api/reports/division-performance']],
  users: [['Citizens', '/api/admin/users'], ['Engagement', '/api/reports/user-engagement-scores']],
  services: [['Service requests', '/api/admin/service-requests', { approve: '/api/admin/service-requests/:id/approve', reject: '/api/admin/service-requests/:id/reject' }]],
  land: [['Mutations', '/api/admin/land-mutations', { approve: '/api/admin/land-mutations/:id/approve', reject: '/api/admin/land-mutations/:id/reject' }], ['Land rollup', '/api/reports/land-rollup']],
  community: [['Groups', '/api/admin/community-groups', { approve: '/api/admin/community-groups/:id/approve', reject: '/api/admin/community-groups/:id/reject' }], ['Posts', '/api/admin/community-posts', { approve: '/api/admin/community-posts/:id/approve', reject: '/api/admin/community-posts/:id/reject' }]],
  shop: [['Products', '/api/admin/shop-items'], ['Orders', '/api/admin/orders', { status: '/api/admin/orders/:id/status', statuses: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] }]],
  market: [['Market prices', '/api/admin/market-prices'], ['Complaints', '/api/admin/complaints', { status: '/api/admin/complaints/:id', statuses: ['pending', 'investigating', 'resolved', 'dismissed'] }]],
  education: [['Education statistics', '/api/admin/education/stats'], ['SSC results', '/api/admin/education/results/ssc']],
  admissions: [['Admission statistics', '/api/admin/admission-stats'], ['Applications', '/api/admin/university-applications', { status: '/api/admin/university-applications/:id/verify', statuses: ['Verified', 'Rejected'] }]],
  stipends: [['Grants', '/api/admin/stipends'], ['Applications', '/api/admin/stipend-applications', { status: '/api/admin/stipend-applications/:id/status', statuses: ['Under Review', 'Approved', 'Rejected'] }]],
  notices: [['Notices', '/api/notices/admin/all']],
  agriculture: [['Statistics', '/api/agriculture/admin/stats'], ['Subsidies', '/api/agriculture/admin/subsidies', { status: '/api/agriculture/admin/subsidy/:id', statuses: ['Approved', 'Rejected'] }], ['Queries', '/api/agriculture/admin/queries']],
  tax: [['Tax statistics', '/api/admin/tax/stats'], ['Returns', '/api/admin/tax/returns', { status: '/api/admin/tax/returns/:id/status', statuses: ['Under Review', 'Assessed', 'Accepted', 'Rejected'] }]],
  audit: [['Audit log', '/api/reports/audit-log?limit=50']]
};

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.applications)) return data.applications;
  if (data && typeof data === 'object') {
    const firstArray = Object.values(data).find(Array.isArray);
    if (firstArray) return firstArray;
  }
  if (data && typeof data === 'object') return Object.entries(data).map(([metric, value]) => ({ metric, value: typeof value === 'object' ? JSON.stringify(value) : value }));
  return [];
}

const PAGE_SIZE = 15;

function ReportDataset({ dataset, onSelect }) {
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1);
  const statusKey = dataset.rows.some(row => row.status != null) ? 'status' : dataset.rows.some(row => row.application_status != null) ? 'application_status' : null;
  const statusValues = statusKey ? [...new Set(dataset.rows.map(row => row[statusKey]).filter(Boolean))] : [];
  const filtered = useMemo(() => dataset.rows.filter(row => {
    const matchesSearch = !search || Object.values(row).some(value => String(value ?? '').toLowerCase().includes(search.toLowerCase()));
    return matchesSearch && (!status || row[statusKey] === status);
  }), [dataset.rows, search, status, statusKey]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); const current = Math.min(page, pages); const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE); const columns = columnsFor(filtered.length ? filtered : dataset.rows);
  function reset(next) { next(); setPage(1); }
  return <section className="react-panel react-service-spaced"><div className="react-section-heading"><div><h2>{dataset.label}</h2><p>{filtered.length} of {dataset.rows.length} records</p></div></div>{dataset.rows.length > 0 && <form className="react-inline-form" onSubmit={event => event.preventDefault()}><input aria-label={`Search ${dataset.label}`} value={search} onChange={event => reset(() => setSearch(event.target.value))} placeholder="Filter records" />{statusKey && <select aria-label={`Filter ${dataset.label} status`} value={status} onChange={event => reset(() => setStatus(event.target.value))}><option value="">All statuses</option>{statusValues.map(value => <option key={value}>{value}</option>)}</select>}</form>}<div className="react-table-wrap"><table><thead><tr>{columns.map(column => <th key={column}>{column.replaceAll('_', ' ')}</th>)}{dataset.action && <th>Action</th>}</tr></thead><tbody>{visible.map((row, index) => <tr key={row.id ?? `${dataset.label}-${index}`}>{columns.map(column => <td key={column}>{['status', 'application_status', 'payment_status'].includes(column) ? <StatusBadge value={row[column]} /> : typeof row[column] === 'object' ? JSON.stringify(row[column]) : String(row[column] ?? '—')}</td>)}{dataset.action && <td><button type="button" onClick={() => onSelect({ dataset, row })}>Manage</button></td>}</tr>)}{!visible.length && <EmptyRow columns={columns.length + (dataset.action ? 1 : 0)}>No records available.</EmptyRow>}</tbody></table></div>{filtered.length > PAGE_SIZE && <div className="react-pagination"><button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</button><span>{current} / {pages}</span><button type="button" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</button></div>}</section>;
}

function columnsFor(rows) {
  return [...new Set(rows.flatMap(row => Object.keys(row)))].filter(key => !['password', 'password_hash'].includes(key)).slice(0, 8);
}

export default function AdminReportsPage() {
  const { clearAdminSession } = useAuth(); const navigate = useNavigate(); const [params, setParams] = useSearchParams();
  const initial = REPORT_SECTIONS[params.get('section')] ? params.get('section') : 'overview';
  const [section, setSection] = useState(initial); const [datasets, setDatasets] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [selected, setSelected] = useState(null); const { submitting, runLocked } = useSubmissionLock();
  async function load(next = section) { setLoading(true); setError(''); setSelected(null); try { const definitions = REPORT_SECTIONS[next]; const data = await Promise.all(definitions.map(([, path]) => apiRequest(path, { audience: 'admin' }))); setDatasets(definitions.map(([label, path, action], index) => ({ label, path, action, rows: rowsFrom(data[index]) }))); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  function choose(next) { setSection(next); setParams(next === 'overview' ? {} : { section: next }, { replace: true }); load(next); }
  async function simpleAction(kind) { await runLocked(async () => { const template = selected.dataset.action[kind]; const path = template.replace(':id', selected.row.id); const body = kind === 'reject' ? { reason: 'Rejected during synthetic teacher demonstration' } : undefined; try { const data = await apiRequest(path, { method: 'PUT', audience: 'admin', ...(body ? { body } : {}) }); await alerts.success('Admin action completed', data?.message || `${kind} completed`); await load(); } catch (e) { setError(e.message); await alerts.error(e.message); } }); }
  async function updateStatus(event) { event.preventDefault(); const status = new FormData(event.currentTarget).get('status'); await runLocked(async () => { const path = selected.dataset.action.status.replace(':id', selected.row.id); let body = { status }; if (selected.dataset.path.includes('university-applications')) body = { status, rejection_reason: status === 'Rejected' ? 'Synthetic teacher demonstration' : null }; else if (selected.dataset.path.includes('/complaints')) body = { status, admin_notes: 'Synthetic teacher demonstration' }; else if (selected.dataset.path.includes('/tax/returns')) body = { status, remarks: 'Synthetic teacher demonstration' }; try { const data = await apiRequest(path, { method: 'PUT', audience: 'admin', body }); await alerts.success('Status updated', data?.message || status); await load(); } catch (e) { setError(e.message); } }); }
  return <main className="react-public-service"><header className="react-public-header"><strong>NationX · Master Admin</strong><nav><a href="/admin-nid.html">NID</a><a href="/admin-passport.html">Passport</a><a href="/admin-health.html">Health</a><a href="/admin-water.html">Water</a><button onClick={() => { clearAdminSession(); navigate('/index.html#admin'); }}>Log out</button></nav></header><section className="react-public-content"><header className="react-page-header"><div><h1>Government services administration</h1><p>Real test/development database analytics and selected-record administration.</p></div></header><div className="react-service-tabs">{Object.keys(REPORT_SECTIONS).map(value => <button type="button" className={value === section ? 'active' : ''} onClick={() => choose(value)} key={value}>{value}</button>)}</div>{error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={() => load()}>Retry</button></div>}{loading ? <p className="react-empty-state">Loading {section} administration…</p> : datasets.map(dataset => <ReportDataset dataset={dataset} onSelect={setSelected} key={dataset.label} />)}{selected && <section className="react-panel react-service-spaced"><h2>Selected record #{selected.row.id}</h2><p>{selected.dataset.label}</p>{selected.dataset.action.approve && <div className="react-inline-form"><button type="button" disabled={submitting} onClick={() => simpleAction('approve')}>Approve selected</button><button type="button" disabled={submitting} onClick={() => simpleAction('reject')}>Reject selected</button></div>}{selected.dataset.action.status && <form className="react-inline-form" onSubmit={updateStatus}><select aria-label="Selected status" name="status" defaultValue={selected.row.status || selected.row.application_status}>{selected.dataset.action.statuses.map(value => <option key={value}>{value}</option>)}</select><button disabled={submitting}>Update selected status</button></form>}</section>}</section></main>;
}
