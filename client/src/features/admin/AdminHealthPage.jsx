import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { dateText, EmptyRow, StatusBadge } from '../services/ServiceUi.jsx';

const API = '/api/health/admin';
const PAGE_SIZE = 15;

export const HEALTH_ADMIN_DOMAINS = {
  'health-cards': {
    label: 'Health cards', responseKey: 'cards', detailKey: 'card', statuses: ['Pending', 'Approved', 'Rejected'],
    fields: [{ name: 'admin_note', source: 'admin_remarks', label: 'Admin note', type: 'textarea' }]
  },
  vaccinations: {
    label: 'Vaccinations', responseKey: 'vaccinations', detailKey: 'vaccination', statuses: ['Registered', 'Scheduled', 'Completed', 'Cancelled'],
    fields: [
      { name: 'vaccination_date', label: 'Vaccination date', type: 'date' }, { name: 'vaccination_center', label: 'Vaccination center' },
      { name: 'batch_number', label: 'Batch number' }, { name: 'administered_by', label: 'Administered by' },
      { name: 'next_dose_date', label: 'Next dose date', type: 'date' }, { name: 'certificate_number', label: 'Certificate number' },
      { name: 'admin_remarks', label: 'Admin remarks', type: 'textarea' }
    ]
  },
  appointments: {
    label: 'Appointments', responseKey: 'appointments', detailKey: 'appointment', statuses: ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No Show'], dateFilter: true,
    fields: [
      { name: 'doctor_name', label: 'Doctor name' }, { name: 'appointment_time', label: 'Appointment time' },
      { name: 'prescription', label: 'Prescription', type: 'textarea' }, { name: 'admin_remarks', label: 'Admin remarks', type: 'textarea' }
    ]
  },
  ambulance: {
    label: 'Ambulance', responseKey: 'requests', detailKey: 'request', statuses: ['Requested', 'Dispatched', 'En Route', 'Arrived', 'Completed', 'Cancelled'],
    fields: [
      { name: 'driver_name', label: 'Driver name' }, { name: 'driver_phone', label: 'Driver phone' },
      { name: 'vehicle_number', label: 'Vehicle number' }, { name: 'estimated_arrival', label: 'Estimated arrival' },
      { name: 'admin_remarks', label: 'Admin remarks', type: 'textarea' }
    ]
  },
  complaints: {
    label: 'Complaints', responseKey: 'complaints', detailKey: 'complaint', statuses: ['Submitted', 'Under Review', 'Resolved', 'Rejected'],
    fields: [{ name: 'admin_response', source: 'resolution', label: 'Admin response', type: 'textarea' }]
  }
};

export const HOSPITAL_FIELDS = [
  ['name', 'Hospital name', 'text', true], ['name_bn', 'Bangla name'], ['hospital_type', 'Hospital type', 'select'],
  ['division', 'Division', 'text', true], ['district', 'District', 'text', true], ['upazila', 'Upazila'], ['address', 'Address'],
  ['phone', 'Phone'], ['emergency_phone', 'Emergency phone'], ['email', 'Email', 'email'],
  ['total_beds', 'Total beds', 'number'], ['icu_beds', 'ICU beds', 'number'], ['available_beds', 'Available beds', 'number'],
  ['available_icu_beds', 'Available ICU beds', 'number'], ['departments', 'Departments', 'textarea'], ['facilities', 'Facilities', 'textarea']
];

const HOSPITAL_TYPES = ['Medical College', 'District Hospital', 'Upazila Health Complex', 'Union Sub-Center', 'Specialized Hospital', 'Community Clinic', 'Private Hospital'];
const VALID_SECTIONS = ['dashboard', ...Object.keys(HEALTH_ADMIN_DOMAINS), 'hospitals'];

function rowTitle(row) {
  return row.card_number || row.full_name || row.patient_name || row.vaccine_name || row.hospital_name || row.name || row.user_name || `Record #${row.id}`;
}

export function healthAdminQuery(section, filters, page = 1) {
  const query = new URLSearchParams();
  if (section !== 'dashboard') query.set('section', section);
  ['status', 'search', 'date'].forEach(key => { if (filters[key]) query.set(key, filters[key]); });
  if (page > 1) query.set('page', String(page));
  return query;
}

export default function AdminHealthPage() {
  const { clearAdminSession } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialSection = VALID_SECTIONS.includes(params.get('section')) ? params.get('section') : 'dashboard';
  const [section, setSection] = useState(initialSection);
  const [filters, setFilters] = useState({ status: params.get('status') || '', search: params.get('search') || '', date: params.get('date') || '' });
  const [page, setPage] = useState(Math.max(1, Number(params.get('page')) || 1));
  const [stats, setStats] = useState({});
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const { submitting, runLocked } = useSubmissionLock();
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = useMemo(() => records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [records, currentPage]);
  const config = HEALTH_ADMIN_DOMAINS[section];

  async function loadStats() {
    const response = await apiRequest(`${API}/stats`, { audience: 'admin' });
    setStats(response?.stats || {});
  }

  async function loadSection(nextSection = section, nextFilters = filters) {
    if (nextSection === 'dashboard') { setRecords([]); return; }
    const query = new URLSearchParams();
    if (nextFilters.status && nextSection !== 'hospitals') query.set('status', nextFilters.status);
    if (nextFilters.search && nextSection !== 'hospitals') query.set('search', nextFilters.search.trim());
    if (nextFilters.date && HEALTH_ADMIN_DOMAINS[nextSection]?.dateFilter) query.set('date', nextFilters.date);
    const response = await apiRequest(`${API}/${nextSection}${query.size ? `?${query}` : ''}`, { audience: 'admin' });
    const rows = nextSection === 'hospitals' ? response?.hospitals : response?.[HEALTH_ADMIN_DOMAINS[nextSection].responseKey];
    setRecords(Array.isArray(rows) ? rows : []);
  }

  async function loadCurrent() {
    setLoading(true); setError('');
    try { await Promise.all([loadStats(), loadSection()]); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadCurrent(); }, []);

  async function selectSection(nextSection) {
    const empty = { status: '', search: '', date: '' };
    setSection(nextSection); setFilters(empty); setPage(1); setSelected(null); setRecords([]); setLoading(true); setError('');
    setParams(healthAdminQuery(nextSection, empty), { replace: true });
    try { await loadSection(nextSection, empty); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  async function applyFilters(event) {
    event.preventDefault(); setPage(1); setSelected(null); setLoading(true); setError('');
    setParams(healthAdminQuery(section, filters), { replace: true });
    try { await loadSection(section, filters); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  function changePage(next) { setPage(next); setParams(healthAdminQuery(section, filters, next), { replace: true }); }

  async function view(row) {
    setSelected({ row, loading: true }); setError('');
    try {
      const response = await apiRequest(`${API}/${section}/${row.id}`, { audience: 'admin' });
      setSelected({ row, detail: response[config.detailKey], loading: false });
    } catch (requestError) { setSelected(null); setError(requestError.message); }
  }

  async function updateRecord(event) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    await runLocked(async () => {
      const body = { status: values.get('status') };
      config.fields.forEach(field => { body[field.name] = values.get(field.name) || ''; });
      try {
        const response = await apiRequest(`${API}/${section}/${selected.detail.id}`, { method: 'PUT', audience: 'admin', body });
        await alerts.success('Record updated', response.message); setSelected(null); await Promise.all([loadStats(), loadSection()]);
      } catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
    });
  }

  async function editHospital(row) {
    setSelected({ row, hospital: true, loading: true }); setError('');
    try { const response = await apiRequest(`${API}/hospitals/${row.id}`, { audience: 'admin' }); setSelected({ row, hospital: true, detail: response.hospital, loading: false }); }
    catch (requestError) { setSelected(null); setError(requestError.message); }
  }

  async function saveHospital(event) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    await runLocked(async () => {
      const body = {};
      HOSPITAL_FIELDS.forEach(([name]) => { body[name] = values.get(name) || ''; });
      body.ambulance_available = values.get('ambulance_available') === 'on';
      body.blood_bank = values.get('blood_bank') === 'on';
      body.is_active = values.get('is_active') === '1' ? 1 : 0;
      const editing = Boolean(selected?.detail?.id);
      try {
        const response = await apiRequest(`${API}/hospitals${editing ? `/${selected.detail.id}` : ''}`, { method: editing ? 'PUT' : 'POST', audience: 'admin', body });
        await alerts.success(editing ? 'Hospital updated' : 'Hospital added', response.message); setSelected(null); await Promise.all([loadStats(), loadSection('hospitals', filters)]);
      } catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
    });
  }

  async function deleteHospital(row) {
    if (!window.confirm(`Delete hospital “${row.name}”? This permanently removes the selected database record.`)) return;
    try { const response = await apiRequest(`${API}/hospitals/${row.id}`, { method: 'DELETE', audience: 'admin' }); await alerts.success('Hospital deleted', response.message); await Promise.all([loadStats(), loadSection('hospitals', filters)]); }
    catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
  }

  function logout() { clearAdminSession(); navigate('/index.html#admin', { replace: true }); }

  return <main className="react-public-service"><header className="react-public-header"><strong className="react-brand-link">NationX Admin · Health</strong><nav><a href="/reports.html">Admin dashboard</a><button type="button" onClick={logout}>Log out</button></nav></header><section className="react-public-content">
    <header className="react-page-header"><div><h1>Health administration</h1><p>Admin-only queues for health cards, vaccinations, appointments, ambulances, complaints, and hospitals.</p></div></header>
    <div className="react-service-tabs" aria-label="Health admin sections">{VALID_SECTIONS.map(value => <button className={section === value ? 'active' : ''} type="button" key={value} onClick={() => selectSection(value)}>{value === 'dashboard' ? 'Dashboard' : value.replace('-', ' ')}</button>)}</div>
    {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={loadCurrent}>Retry</button></div>}
    {section === 'dashboard' ? <><div className="react-service-stats">{Object.entries(stats).map(([key, value]) => <article className="react-panel" key={key}><strong>{value || 0}</strong><span>{key.replaceAll('_', ' ')}</span></article>)}</div>{loading && <p className="react-empty-state">Loading health administration statistics…</p>}</> : <>
      {section !== 'hospitals' && <section className="react-panel"><form className="react-inline-form" onSubmit={applyFilters}><select aria-label="Filter status" value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{config.statuses.map(value => <option key={value}>{value}</option>)}</select>{config.dateFilter && <input aria-label="Filter date" type="date" value={filters.date} onChange={event => setFilters({ ...filters, date: event.target.value })} />}<input aria-label="Search health admin records" value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder="Search records" /><button className="btn-primary">Apply filters</button></form></section>}
      <section className="react-panel react-service-spaced"><div className="react-section-heading"><div><h2>{section === 'hospitals' ? 'Hospitals' : config.label}</h2><p>{records.length} records · page {currentPage} of {totalPages}</p></div>{section === 'hospitals' && <button className="btn-primary" type="button" onClick={() => setSelected({ hospital: true, detail: {}, loading: false })}>Add hospital</button>}</div>{loading ? <p className="react-empty-state">Loading {section.replace('-', ' ')}…</p> : <><div className="react-table-wrap"><table><thead><tr><th>ID</th><th>Record</th><th>Status</th><th>Created / location</th><th>Actions</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><td>{row.id}</td><td>{rowTitle(row)}</td><td><StatusBadge value={section === 'hospitals' ? (row.is_active ? 'Active' : 'Inactive') : row.status} /></td><td>{section === 'hospitals' ? [row.division, row.district].filter(Boolean).join(', ') : dateText(row.created_at || row.appointment_date)}</td><td>{section === 'hospitals' ? <div className="react-inline-form"><button type="button" onClick={() => editHospital(row)}>Edit</button><button type="button" onClick={() => deleteHospital(row)}>Delete</button></div> : <button type="button" onClick={() => view(row)}>Review</button>}</td></tr>)}{!visible.length && <EmptyRow columns={5}>No records match this section and filter.</EmptyRow>}</tbody></table></div><div className="react-pagination"><button type="button" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>Previous</button><span>{currentPage} / {totalPages}</span><button type="button" disabled={currentPage >= totalPages} onClick={() => changePage(currentPage + 1)}>Next</button></div></>}</section>
    </>}
    {selected && !selected.hospital && <section className="react-panel react-service-spaced"><div className="react-section-heading"><h2>Review {rowTitle(selected.row)}</h2><button type="button" onClick={() => setSelected(null)}>Close</button></div>{selected.loading ? <p className="react-empty-state">Loading selected record…</p> : <><dl className="react-detail-grid">{Object.entries(selected.detail || {}).filter(([, value]) => value !== null && value !== '' && typeof value !== 'object').map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{String(value)}</dd></div>)}</dl><form className="react-form-stack react-service-spaced" onSubmit={updateRecord}><label>Status<select name="status" defaultValue={selected.detail.status}>{config.statuses.map(value => <option key={value}>{value}</option>)}</select></label>{config.fields.map(field => <label key={field.name}>{field.label}{field.type === 'textarea' ? <textarea name={field.name} defaultValue={selected.detail[field.source || field.name] || ''} /> : <input name={field.name} type={field.type || 'text'} defaultValue={selected.detail[field.source || field.name] ? String(selected.detail[field.source || field.name]).slice(0, field.type === 'date' ? 10 : undefined) : ''} />}</label>)}<button className="btn-primary" disabled={submitting}>Update selected record</button></form></>}</section>}
    {selected?.hospital && <section className="react-panel react-service-spaced"><div className="react-section-heading"><h2>{selected.detail?.id ? `Edit ${selected.detail.name}` : 'Add hospital'}</h2><button type="button" onClick={() => setSelected(null)}>Close</button></div>{selected.loading ? <p className="react-empty-state">Loading hospital…</p> : <HospitalForm hospital={selected.detail} submitting={submitting} onSubmit={saveHospital} />}</section>}
  </section></main>;
}

function HospitalForm({ hospital = {}, submitting, onSubmit }) {
  return <form className="react-form-grid" onSubmit={onSubmit}>{HOSPITAL_FIELDS.map(([name, label, type = 'text', required = false]) => <label key={name}>{label}{type === 'textarea' ? <textarea name={name} defaultValue={hospital[name] || ''} required={required} /> : type === 'select' ? <select name={name} defaultValue={hospital[name] || HOSPITAL_TYPES[0]}>{HOSPITAL_TYPES.map(value => <option key={value}>{value}</option>)}</select> : <input name={name} type={type} defaultValue={hospital[name] ?? ''} required={required} />}</label>)}<label><input name="ambulance_available" type="checkbox" defaultChecked={Boolean(hospital.ambulance_available)} /> Ambulance available</label><label><input name="blood_bank" type="checkbox" defaultChecked={Boolean(hospital.blood_bank)} /> Blood bank</label><label>Active<select name="is_active" defaultValue={hospital.is_active === 0 ? '0' : '1'}><option value="1">Active</option><option value="0">Inactive</option></select></label><button className="btn-primary" disabled={submitting}>{hospital.id ? 'Save selected hospital' : 'Add hospital'}</button></form>;
}
