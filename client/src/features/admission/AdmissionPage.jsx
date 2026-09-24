import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../services/api.js';
import { dateText, StatusBadge } from '../services/ServiceUi.jsx';
import './admission-page.css';

const API = '/api/university';

function AdmissionCard({ row }) {
  return <article className="admission-card">
    <header>
      <span className="admission-university-mark" aria-hidden="true"><i className="fas fa-building-columns" /></span>
      <div><h3>{row.university_name}</h3>{row.university_name_bn && <p lang="bn">{row.university_name_bn}</p>}</div>
      <StatusBadge value={row.status} />
    </header>
    <div className="admission-unit"><span>{row.unit_code}</span><div><small>Admission unit</small><h4>{row.unit_name}</h4></div></div>
    <div className="admission-card-details">
      <div><i className="fas fa-location-dot" /><span><small>Location</small><strong>{row.university_location || 'Bangladesh'}</strong></span></div>
      <div><i className="fas fa-chart-line" /><span><small>Minimum GPA</small><strong>{row.min_gpa || 'Not specified'}</strong></span></div>
      <div><i className="fas fa-user-graduate" /><span><small>Required group</small><strong>{row.required_group || 'Any group'}</strong></span></div>
      <div><i className="fas fa-users" /><span><small>Available seats</small><strong>{row.total_seats || '—'}</strong></span></div>
    </div>
    <footer><div><small>Application deadline</small><strong>{dateText(row.end_date)}</strong><span>{row.days_remaining} days remaining</span></div><div><small>Application fee</small><strong>৳{Number(row.application_fee || 0).toLocaleString()}</strong></div></footer>
    <Link className="admission-card-action" to={`/apply.html?id=${row.id}`}>View details and apply <i className="fas fa-arrow-right" /></Link>
  </article>;
}

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

  return <main className="react-public-service nationx-admission-page">
    <header className="admission-nav"><Link to="/index.html" className="admission-brand"><span><i className="fas fa-landmark" /></span><strong>NationX</strong></Link><nav><Link className="active" to="/admission.html">Admissions</Link><Link to="/index.html#signin">Citizen login <i className="fas fa-arrow-right-to-bracket" /></Link></nav></header>
    <section className="admission-hero"><div className="admission-hero-copy"><span className="admission-eyebrow"><i className="fas fa-graduation-cap" /> University admissions · Bangladesh</span><h1>Find the right path to your <em>next chapter.</em></h1><p>Explore active admission notices, compare eligibility requirements, and start an application through one clear government portal.</p><div className="admission-hero-meta"><span><strong>{admissions.length}</strong> published notices</span><span><strong>{new Set(admissions.map(row => row.university_name)).size}</strong> institutions</span><span><i className="fas fa-shield-halved" /> Verified portal data</span></div></div><div className="admission-hero-art" aria-hidden="true"><span className="admission-sun" /><i className="fas fa-building-columns" /><span className="admission-line line-one" /><span className="admission-line line-two" /></div></section>
    <div className="admission-page-shell">
      {error && <div className="react-dashboard-error" role="alert">{error}</div>}
      <section className="admission-listing-panel">
        <header className="admission-section-heading"><div><span>Explore opportunities</span><h2>Admission notices</h2><p>{filtered.length} matching {filtered.length === 1 ? 'post' : 'posts'}</p></div><div className="admission-filters"><label><span className="sr-only">Search admissions</span><i className="fas fa-magnifying-glass" /><input aria-label="Search admissions" value={search} onChange={event => { setSearch(event.target.value); updateFilter(event.target.value, type); }} placeholder="Search university or unit" /></label><label><span className="sr-only">University type</span><i className="fas fa-filter" /><select aria-label="University type" value={type} onChange={event => { setType(event.target.value); updateFilter(search, event.target.value); }}><option value="">All university types</option>{[...new Set(admissions.map(row => row.university_type).filter(Boolean))].map(value => <option key={value}>{value}</option>)}</select></label></div></header>
        {loading ? <p className="react-empty-state">Loading admissions…</p> : <div className="admission-card-grid">{filtered.map(row => <AdmissionCard row={row} key={row.id} />)}{!filtered.length && <div className="admission-empty"><i className="fas fa-magnifying-glass" /><h3>No matching admission notices</h3><p>Try a different university name, unit, or type.</p></div>}</div>}
      </section>
      <section className="admission-lookup-panel"><div className="admission-lookup-copy"><span className="admission-eyebrow">Continue an application</span><h2>Find applications by HSC record</h2><p>Use the same HSC roll and year entered during application to retrieve its current state.</p><div className="admission-privacy-note"><i className="fas fa-shield-halved" /><span>This lookup remains demonstration-only while its public identity-data access policy is under security review.</span></div></div><form className="admission-lookup-form" onSubmit={findApplications}><label><span>HSC roll number</span><input name="roll" required placeholder="e.g. 345678" /></label><label><span>Examination year</span><select name="year" defaultValue="2024">{[2026, 2025, 2024, 2023, 2022, 2021].map(year => <option key={year}>{year}</option>)}</select></label><button type="submit">Find my application <i className="fas fa-arrow-right" /></button></form>{myApps && <div className="admission-application-results">{myApps.map(row => <article key={row.application_id}><div><span>{row.application_id}</span><h3>{row.university_name} · {row.unit_code}</h3><p>{dateText(row.created_at)}</p></div><div><small>Payment</small><strong>{row.payment_status}</strong></div><div><small>Application</small><strong>{row.application_status}</strong></div><Link to={`/apply.html?id=${row.admission_post_id}&continue=${encodeURIComponent(row.application_id)}`}>View <i className="fas fa-arrow-right" /></Link></article>)}{!myApps.length && <p className="react-empty-state">No applications found.</p>}</div>}</section>
    </div>
  </main>;
}
