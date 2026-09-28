import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { EmptyRow, StatusBadge } from '../services/ServiceUi.jsx';

export const REPORT_SECTIONS = {
  overview: [['Summary', '/api/reports/summary'], ['Service pivot', '/api/reports/service-pivot'], ['Division performance', '/api/reports/division-performance']],
  users: [['Citizens', '/api/admin/users'], ['Engagement', '/api/reports/user-engagement-scores']],
  services: [['Service requests', '/api/admin/service-requests']],
  land: [['Mutations', '/api/admin/land-mutations'], ['Land rollup', '/api/reports/land-rollup']],
  community: [['Groups', '/api/admin/community-groups'], ['Posts', '/api/admin/community-posts']],
  shop: [['Products', '/api/admin/shop-items'], ['Orders', '/api/admin/orders']],
  market: [['Market prices', '/api/admin/market-prices'], ['Complaints', '/api/admin/complaints', { statuses: ['pending', 'investigating', 'resolved', 'dismissed'] }]],
  education: [['Education statistics', '/api/admin/education/stats'], ['SSC results', '/api/admin/education/results/ssc']],
  admissions: [['Admission statistics', '/api/admin/admission-stats'], ['Applications', '/api/admin/university-applications']],
  stipends: [['Grants', '/api/admin/stipends'], ['Applications', '/api/admin/stipend-applications']],
  notices: [['Notices', '/api/notices/admin/all']],
  agriculture: [['Statistics', '/api/agriculture/admin/stats'], ['Subsidies', '/api/agriculture/admin/subsidies']],
  tax: [['Tax statistics', '/api/admin/tax/stats'], ['Returns', '/api/admin/tax/returns', { statuses: ['Under Review', 'Assessed', 'Accepted', 'Rejected'] }]],
  audit: [['System audit log', '/api/reports/audit-log?limit=50']]
};

const PAGE_LINKS = {
  nid: '/admin-nid.html', passport: '/admin-passport.html',
  health: '/admin-health.html', water: '/admin-water.html'
};

const roleLabel = role => ({
  SUPER_ADMIN: 'Platform super administrator',
  DOMAIN_ADMIN: 'Central service administrator',
  DIVISION_ADMIN: 'Divisional service administrator'
}[role] || 'Administrator');

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.applications)) return data.applications;
  if (data && typeof data === 'object') {
    const firstArray = Object.values(data).find(Array.isArray);
    if (firstArray) return firstArray;
    return Object.entries(data).map(([metric, value]) => ({ metric, value: typeof value === 'object' ? JSON.stringify(value) : value }));
  }
  return [];
}

function columnsFor(rows) {
  return [...new Set(rows.flatMap(row => Object.keys(row)))]
    .filter(key => !['password', 'password_hash'].includes(key)).slice(0, 8);
}

function DataTable({ label, rows, actions }) {
  const [search, setSearch] = useState('');
  const visible = useMemo(() => rows.filter(row => !search || Object.values(row)
    .some(value => String(value ?? '').toLowerCase().includes(search.toLowerCase()))), [rows, search]);
  const columns = columnsFor(visible.length ? visible : rows);
  return <section className="admin-card admin-data-card">
    <div className="admin-card-heading"><div><h2>{label}</h2><p>{visible.length} records</p></div>{rows.length > 5 && <input aria-label={`Search ${label}`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records" />}</div>
    <div className="react-table-wrap"><table><thead><tr>{columns.map(column => <th key={column}>{column.replaceAll('_', ' ')}</th>)}{actions && <th>Workflow</th>}</tr></thead><tbody>
      {visible.slice(0, 100).map((row, index) => <tr key={row.id ?? `${label}-${index}`}>{columns.map(column => <td key={column}>{column.includes('status') ? <StatusBadge value={row[column]} /> : typeof row[column] === 'object' ? JSON.stringify(row[column]) : String(row[column] ?? '—')}</td>)}{actions && <td>{actions(row)}</td>}</tr>)}
      {!visible.length && <EmptyRow columns={columns.length + (actions ? 1 : 0)}>No records in this scope.</EmptyRow>}
    </tbody></table></div>
  </section>;
}

function ScopeBanner({ admin }) {
  const access = admin.assignment;
  return <section className="admin-scope-banner">
    <div className="admin-scope-icon"><i className={access.role === 'SUPER_ADMIN' ? 'fas fa-shield-halved' : 'fas fa-building-columns'} /></div>
    <div><span>Signed in responsibility</span><h1>{roleLabel(access.role)}</h1><p>{access.role === 'SUPER_ADMIN' ? 'All NationX administrative services and access governance' : `${access.domainName} · ${access.parentAuthority}`}</p></div>
    <div className="admin-scope-badges"><strong>{access.role === 'DIVISION_ADMIN' ? access.divisionName : 'Nationwide'}</strong><small>{access.role.replaceAll('_', ' ')}</small></div>
  </section>;
}

function WorkQueue({ domain, domainLabel, admin }) {
  const [data, setData] = useState(null);
  const [resource, setResource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextResource = resource) {
    if (!domain) return;
    setLoading(true); setError('');
    try {
      const query = nextResource ? `?resource=${encodeURIComponent(nextResource)}` : '';
      const result = await apiRequest(`/api/admin/work/${domain}${query}`, { audience: 'admin' });
      setData(result); setResource(result.selectedResource);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { setResource(''); load(''); }, [domain]);

  async function update(item, status) {
    try {
      await apiRequest(`/api/admin/work/${domain}/${data.selectedResource}/${item.id}/status`, { method: 'PUT', audience: 'admin', body: { status } });
      await alerts.success('Workflow updated', `Status changed to ${status}.`);
      await load(data.selectedResource);
    } catch (requestError) { setError(requestError.message); }
  }

  if (loading) return <section className="admin-card admin-loading"><i className="fas fa-spinner fa-spin" /> Loading the authorised work queue…</section>;
  if (error) return <section className="admin-card admin-error" role="alert"><p>{error}</p><button type="button" onClick={() => load()}>Try again</button></section>;
  const selected = data?.resources.find(item => item.key === data.selectedResource);
  return <div className="admin-workspace-stack">
    <section className="admin-card admin-queue-head">
      <div><span>Authorised work queue</span><h2>{admin.assignment.domainName || domainLabel || domain}</h2><p>{admin.assignment.role === 'DIVISION_ADMIN' ? `Only requests assigned to ${admin.assignment.divisionName} Division are returned by the server.` : 'Central scope includes requests from every division.'}</p></div>
      <label>Request type<select value={data.selectedResource} onChange={event => { setResource(event.target.value); load(event.target.value); }}>{data.resources.map(item => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>
    </section>
    {selected?.readOnly && <div className="admin-readonly-note"><i className="fas fa-lock" /> Payment state is read-only here and may only change through the verified payment workflow.</div>}
    <DataTable label={selected?.label || 'Requests'} rows={data.items} actions={selected?.statuses.length ? item => <select aria-label={`Status for ${item.reference}`} value={item.status} onChange={event => update(item, event.target.value)}>{selected.statuses.map(status => <option value={status} key={status}>{status}</option>)}</select> : null} />
  </div>;
}

function AccessEditor({ record, options, onSaved, locked }) {
  const initialRole = record.role_type || (record.requested_scope_level === 'division' ? 'DIVISION_ADMIN' : 'DOMAIN_ADMIN');
  const [form, setForm] = useState({ role: initialRole, domainCode: record.domain_code || record.requested_domain_code || '', divisionId: record.division_id || record.requested_division_id || '', note: '' });
  const [saving, setSaving] = useState(false);
  const domain = options.domains.find(item => item.code === form.domainCode);

  async function save(status) {
    setSaving(true);
    try {
      const result = await apiRequest(`/api/admin/access/admins/${record.id}/access`, { method: 'PUT', audience: 'admin', body: { ...form, status } });
      await alerts.success('Access governance updated', result.message);
      await onSaved();
    } catch (error) { await alerts.error(error.message, 'Access update failed'); }
    finally { setSaving(false); }
  }

  function change(event) {
    const { name, value } = event.target;
    setForm(current => {
      const next = { ...current, [name]: value };
      if (name === 'role' && value !== 'DIVISION_ADMIN') next.divisionId = '';
      if (name === 'domainCode') {
        const nextDomain = options.domains.find(item => item.code === value);
        if (nextDomain && !nextDomain.supports_division_scope && next.role === 'DIVISION_ADMIN') { next.role = 'DOMAIN_ADMIN'; next.divisionId = ''; }
      }
      return next;
    });
  }

  return <article className="admin-access-record">
    <header><div className="admin-avatar">{record.name.slice(0, 1).toUpperCase()}</div><div><h3>{record.name}</h3><p>{record.email} · NID {record.nid}</p></div><StatusBadge value={record.status} /></header>
    <div className="admin-request-summary"><span>Requested</span><strong>{options.domains.find(item => item.code === record.requested_domain_code)?.name || 'Not specified'}</strong><small>{record.requested_scope_level === 'division' ? `${options.divisions.find(item => Number(item.id) === Number(record.requested_division_id))?.name || 'Division'} scope` : 'Central scope'}{record.access_request_note ? ` · ${record.access_request_note}` : ''}</small></div>
    <div className="admin-access-form">
      <label>Role<select name="role" value={form.role} onChange={change}><option value="DOMAIN_ADMIN">Central service admin</option><option value="DIVISION_ADMIN" disabled={domain && !domain.supports_division_scope}>Divisional service admin</option><option value="SUPER_ADMIN">Platform super admin</option></select></label>
      {form.role !== 'SUPER_ADMIN' && <label>Service authority<select name="domainCode" value={form.domainCode} onChange={change}><option value="">Select authority</option>{options.domains.map(item => <option value={item.code} key={item.code}>{item.name}</option>)}</select></label>}
      {form.role === 'DIVISION_ADMIN' && <label>Division<select name="divisionId" value={form.divisionId} onChange={change}><option value="">Select division</option>{options.divisions.map(item => <option value={item.id} key={item.id}>{item.name} · {item.name_bn}</option>)}</select></label>}
      <label className="admin-access-note">Decision note<input name="note" value={form.note} onChange={change} placeholder="Reference or reason (optional)" /></label>
    </div>
    <footer>{locked ? <span className="admin-current-account"><i className="fas fa-lock" /> Current account is protected from self-modification</span> : <><button type="button" disabled={saving} onClick={() => save('approved')}><i className="fas fa-check" /> {record.status === 'approved' ? 'Save access' : 'Approve and assign'}</button><button className="admin-danger-button" type="button" disabled={saving} onClick={() => save('rejected')}><i className="fas fa-ban" /> Revoke</button></>}</footer>
  </article>;
}

function AccessControl({ options, currentAdminId }) {
  const [admins, setAdmins] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [error, setError] = useState('');
  async function load() { try { setAdmins(await apiRequest('/api/admin/access/admins', { audience: 'admin' })); setError(''); } catch (requestError) { setError(requestError.message); } }
  useEffect(() => { load(); }, []);
  const visible = admins.filter(admin => filter === 'all' || admin.status === filter);
  return <div className="admin-workspace-stack">
    <section className="admin-card admin-access-intro"><div><span>Least-privilege governance</span><h2>Administrator access control</h2><p>Verify the officer, then assign exactly one authority and jurisdiction. Every decision is audited.</p></div><div className="admin-filter-pills">{['pending', 'approved', 'rejected', 'all'].map(value => <button className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} type="button" key={value}>{value} {value !== 'all' && <b>{admins.filter(item => item.status === value).length}</b>}</button>)}</div></section>
    {error && <div className="admin-error" role="alert">{error}</div>}
    <section className="admin-access-grid">{visible.map(admin => <AccessEditor record={admin} options={options} onSaved={load} locked={Number(admin.id) === Number(currentAdminId)} key={admin.id} />)}{!visible.length && <div className="admin-card admin-empty"><i className="fas fa-user-check" /><h3>No {filter} accounts</h3><p>There are no administrator records in this view.</p></div>}</section>
  </div>;
}

function AuditTrail() {
  const [rows, setRows] = useState([]); const [error, setError] = useState('');
  useEffect(() => { apiRequest('/api/admin/access/audit', { audience: 'admin' }).then(setRows).catch(requestError => setError(requestError.message)); }, []);
  return error ? <div className="admin-error">{error}</div> : <DataTable label="Access decision audit trail" rows={rows} />;
}

function Analytics({ section, onSection }) {
  const [datasets, setDatasets] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    setLoading(true); setError('');
    const definitions = REPORT_SECTIONS[section];
    Promise.all(definitions.map(([, path]) => apiRequest(path, { audience: 'admin' })))
      .then(data => setDatasets(definitions.map(([label], index) => ({ label, rows: rowsFrom(data[index]) }))))
      .catch(requestError => setError(requestError.message)).finally(() => setLoading(false));
  }, [section]);
  return <div className="admin-workspace-stack"><div className="admin-report-tabs">{Object.keys(REPORT_SECTIONS).map(value => <button className={section === value ? 'active' : ''} type="button" onClick={() => onSection(value)} key={value}>{value}</button>)}</div>{error && <div className="admin-error">{error}</div>}{loading ? <div className="admin-card admin-loading">Loading analytics…</div> : datasets.map(dataset => <DataTable {...dataset} key={dataset.label} />)}</div>;
}

function DomainOverview({ options, selectedDomain, onDomain, admin }) {
  const domains = admin.assignment.role === 'SUPER_ADMIN' ? options.domains : options.domains.filter(item => item.code === admin.assignment.domainCode);
  const selected = domains.find(domain => domain.code === selectedDomain);
  return <div className="admin-workspace-stack">
    <section className="admin-domain-grid">{domains.map(domain => <button className={selectedDomain === domain.code ? 'admin-domain-card active' : 'admin-domain-card'} onClick={() => onDomain(domain.code)} type="button" key={domain.code}><i className={`fas ${domain.icon}`} /><span><strong>{domain.name}</strong><small>{domain.name_bn}</small><em>{domain.parent_authority}</em></span><i className="fas fa-arrow-right" /></button>)}</section>
    {selectedDomain && <WorkQueue domain={selectedDomain} domainLabel={selected?.name} admin={admin} />}
  </div>;
}

export default function AdminReportsPage() {
  const { clearAdminSession } = useAuth(); const navigate = useNavigate();
  const [admin, setAdmin] = useState(null); const [options, setOptions] = useState({ domains: [], divisions: [] });
  const [view, setView] = useState('workspace'); const [reportSection, setReportSection] = useState('overview');
  const [selectedDomain, setSelectedDomain] = useState(''); const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiRequest('/api/admin/me', { audience: 'admin' }), apiRequest('/api/admin/access/options', { auth: false })])
      .then(([me, catalogue]) => { setAdmin(me); setOptions(catalogue); setSelectedDomain(me.assignment.role === 'SUPER_ADMIN' ? catalogue.domains[0]?.code || '' : me.assignment.domainCode); })
      .catch(requestError => setError(requestError.message));
  }, []);

  if (error) return <main className="role-admin-page"><section className="admin-fatal" role="alert"><i className="fas fa-shield" /><h1>Administrative workspace unavailable</h1><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></section></main>;
  if (!admin) return <main className="role-admin-page"><section className="admin-fatal"><i className="fas fa-spinner fa-spin" /><p>Verifying your administrative responsibility…</p></section></main>;

  const superAdmin = admin.assignment.role === 'SUPER_ADMIN'; const centralDomainAdmin = admin.assignment.role === 'DOMAIN_ADMIN';
  return <main className="role-admin-page">
    <header className="role-admin-topbar"><a className="role-admin-brand" href="/reports.html"><span className="role-admin-mark">NX</span><span><strong>NationX Administration</strong><small>Government service operations</small></span></a><nav><span><strong>{admin.name}</strong><small>{roleLabel(admin.assignment.role)}</small></span><button type="button" onClick={() => { clearAdminSession(); navigate('/index.html#admin'); }}><i className="fas fa-arrow-right-from-bracket" /> Log out</button></nav></header>
    <div className="role-admin-layout"><aside className="role-admin-sidebar"><span className="role-admin-sidebar-label">Workspace</span><button className={view === 'workspace' ? 'active' : ''} onClick={() => setView('workspace')} type="button"><i className="fas fa-inbox" /> Service work</button>{superAdmin && <><button className={view === 'access' ? 'active' : ''} onClick={() => setView('access')} type="button"><i className="fas fa-user-shield" /> Access & roles</button><button className={view === 'access-audit' ? 'active' : ''} onClick={() => setView('access-audit')} type="button"><i className="fas fa-clock-rotate-left" /> Access audit</button><button className={view === 'analytics' ? 'active' : ''} onClick={() => setView('analytics')} type="button"><i className="fas fa-chart-line" /> National analytics</button></>}{centralDomainAdmin && PAGE_LINKS[admin.assignment.domainCode] && <a href={PAGE_LINKS[admin.assignment.domainCode]}><i className="fas fa-arrow-up-right-from-square" /> Full service console</a>}<div className="role-admin-safety"><i className="fas fa-lock" /><strong>Scope enforced</strong><small>API access is limited to your assigned authority and jurisdiction.</small></div></aside>
      <section className="role-admin-content"><ScopeBanner admin={admin} />{view === 'workspace' && <DomainOverview options={options} selectedDomain={selectedDomain} onDomain={setSelectedDomain} admin={admin} />}{view === 'access' && superAdmin && <AccessControl options={options} currentAdminId={admin.id} />}{view === 'access-audit' && superAdmin && <AuditTrail />}{view === 'analytics' && superAdmin && <Analytics section={reportSection} onSection={setReportSection} />}</section></div>
  </main>;
}
