import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../services/api.js';
import { dateText, StatusBadge } from '../services/ServiceUi.jsx';

const API = '/api/university';

export default function AdmissionPage() {
  const [params, setParams] = useSearchParams();
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(params.get('search') || '');
  const [type, setType] = useState(params.get('type') || '');
  const [myApps, setMyApps] = useState(null);

  useEffect(() => {
    let active = true;
    apiRequest(`${API}/admissions`, { auth: false }).then(rows => { if (active) setAdmissions(Array.isArray(rows) ? rows : []); }).catch(requestError => { if (active) setError(requestError.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => admissions.filter(row => (!type || row.university_type === type) && (!search || `${row.university_name} ${row.university_name_bn || ''} ${row.unit_name} ${row.unit_code}`.toLowerCase().includes(search.toLowerCase()))), [admissions, search, type]);

  function updateFilter(nextSearch, nextType) {
    const next = new URLSearchParams(params);
    if (nextSearch) next.set('search', nextSearch); else next.delete('search');
    if (nextType) next.set('type', nextType); else next.delete('type');
    setParams(next, { replace: true });
  }

  async function findApplications(event) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    try { setMyApps(await apiRequest(`${API}/my-applications/${encodeURIComponent(values.get('roll'))}/${values.get('year')}`, { auth: false })); }
    catch (requestError) { setError(requestError.message); }
  }

  return <main className="react-public-service">
    <header className="react-public-header"><Link to="/index.html" className="react-brand-link">NationX</Link><nav><Link to="/admission.html">Admissions</Link><Link to="/index.html">Citizen login</Link></nav></header>
    <section className="react-public-hero"><p className="eyebrow">University admissions</p><h1>Bangladesh admission notices</h1><p>Search active and upcoming admission posts, check official criteria, and review Draft/Pending/Paid meanings accurately.</p></section>
    {error && <div className="react-dashboard-error" role="alert">{error}</div>}
    <section className="react-panel react-public-content"><div className="react-section-heading"><div><h2>Admission notices</h2><p>{filtered.length} matching posts</p></div><div className="react-inline-form"><input aria-label="Search admissions" value={search} onChange={event => { setSearch(event.target.value); updateFilter(event.target.value, type); }} placeholder="University or unit" /><select aria-label="University type" value={type} onChange={event => { setType(event.target.value); updateFilter(search, event.target.value); }}><option value="">All types</option>{[...new Set(admissions.map(row => row.university_type).filter(Boolean))].map(value => <option key={value}>{value}</option>)}</select></div></div>{loading ? <p className="react-empty-state">Loading admissions…</p> : <div className="react-service-card-grid">{filtered.map(row => <article key={row.id}><div className="react-section-heading"><div><h3>{row.university_name}</h3><p>{row.university_name_bn}</p></div><StatusBadge value={row.status} /></div><h4>{row.unit_code} — {row.unit_name}</h4><p>{row.university_location}</p><p>Minimum GPA {row.min_gpa} · Group {row.required_group || 'Any'}</p><p>{row.total_seats || '—'} seats · Fee ৳{Number(row.application_fee || 0).toLocaleString()}</p><p>Deadline {dateText(row.end_date)} · {row.days_remaining} days remaining</p><Link className="btn-primary react-button-link" to={`/apply.html?id=${row.id}`}>View and apply</Link></article>)}{!filtered.length && <p className="react-empty-state">No matching admission notices.</p>}</div>}</section>
    <section className="react-panel react-public-content"><h2>Find applications by HSC record</h2><p className="react-notice warning">This legacy API is public and returns application/contact/payment data from roll and year. Its access policy is under security review.</p><form className="react-inline-form" onSubmit={findApplications}><input name="roll" required placeholder="HSC roll" /><select name="year" defaultValue="2024">{[2026, 2025, 2024, 2023, 2022, 2021].map(year => <option key={year}>{year}</option>)}</select><button className="btn-primary">Find</button></form>{myApps && <div className="react-card-list react-service-spaced">{myApps.map(row => <article key={row.application_id}><div><h3>{row.university_name} · {row.unit_code}</h3><p>{row.application_id} · {dateText(row.created_at)}</p><p>Payment: {row.payment_status} · Application: {row.application_status}</p></div><Link to={`/apply.html?id=${row.admission_post_id}&continue=${encodeURIComponent(row.application_id)}`}>View</Link></article>)}{!myApps.length && <p className="react-empty-state">No applications found.</p>}</div>}</section>
  </main>;
}
