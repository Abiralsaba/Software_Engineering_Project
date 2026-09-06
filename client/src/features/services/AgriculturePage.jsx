import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { dateText, EmptyRow, formPayload, LocationIdFields, StatusBadge } from './ServiceUi.jsx';

const API = '/api/agriculture';
const sections = ['overview', 'subsidies', 'crop-reports', 'expert', 'market', 'training'];
const optional = value => value === '' ? null : value;

export function agriculturePayload(kind, form) {
  const values = formPayload(form);
  if (kind === 'subsidy') return {
    farmer_name: values.farmer_name, nid_number: values.nid_number, phone: values.phone,
    subsidy_type: values.subsidy_type, crop_type: optional(values.crop_type), amount_requested: values.amount_requested,
    land_size_acres: optional(values.land_size_acres), land_ownership: values.land_ownership,
    division_id: optional(values.division_id), district_id: optional(values.district_id), upazila_id: optional(values.upazila_id),
    village: optional(values.village), bank_name: optional(values.bank_name), bank_branch: optional(values.bank_branch), bank_account: optional(values.bank_account)
  };
  if (kind === 'crop') return {
    farmer_name: values.farmer_name, crop_name: values.crop_name, crop_variety: optional(values.crop_variety), season: values.season,
    yield_metric_ton: values.yield_metric_ton, land_area_acres: optional(values.land_area_acres), fertilizer_used: optional(values.fertilizer_used),
    irrigation_method: values.irrigation_method, harvest_date: optional(values.harvest_date), market_price_per_ton: optional(values.market_price_per_ton),
    division_id: optional(values.division_id), district_id: optional(values.district_id), upazila_id: optional(values.upazila_id), remarks: optional(values.remarks)
  };
  if (kind === 'expert') return { question: values.question, category: values.category, crop_name: optional(values.crop_name) };
  if (kind === 'market') return {
    farmer_name: values.farmer_name, phone: values.phone, product_name: values.product_name,
    product_category: values.product_category, quantity: values.quantity, unit: values.unit,
    price_per_unit: values.price_per_unit, email: optional(values.email), description: optional(values.description)
  };
  return { farmer_name: values.farmer_name, phone: values.phone };
}

function Forecast() {
  const [forecast, setForecast] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let active = true;
    const load = async (latitude, longitude) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=6`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Forecast unavailable');
        const json = await response.json();
        const daily = json.daily;
        if (!daily?.time) throw new Error('Forecast unavailable');
        if (active) {
          setForecast(daily.time.map((date, index) => ({ date, max: daily.temperature_2m_max[index], min: daily.temperature_2m_min[index], rain: daily.precipitation_probability_max[index] })));
          setState('success');
        }
      } catch { if (active) setState('error'); }
    };
    const fallback = () => load(23.8103, 90.4125);
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(position => load(position.coords.latitude, position.coords.longitude), fallback);
    else fallback();
    return () => { active = false; };
  }, []);

  if (state === 'loading') return <p className="react-empty-state">Loading 6-day forecast…</p>;
  if (state === 'error') return <p className="react-empty-state">Unable to load forecast.</p>;
  return <div className="react-forecast-grid">{forecast.map((row, index) => <article key={row.date}><strong>{index === 0 ? 'Today' : new Date(row.date).toLocaleDateString('en-US', { weekday: 'short' })}</strong><span>{Math.round(row.max)}° / {Math.round(row.min)}°</span><small>Rain {row.rain ?? 0}%</small></article>)}</div>;
}

export default function AgriculturePage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const [section, setSectionState] = useState(sections.includes(requested) ? requested : 'overview');
  const [data, setData] = useState({ stats: {}, activity: [], divisions: [], subsidies: [], crops: [], queries: [], market: [], myMarket: [], programs: [], registrations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marketTab, setMarketTab] = useState('browse');
  const [activeForm, setActiveForm] = useState('');
  const { submitting, runLocked } = useSubmissionLock();

  async function loadAll() {
    setLoading(true); setError('');
    try {
      const [stats, activity, divisions, subsidies, crops, queries, market, myMarket, programs, registrations] = await Promise.all([
        apiRequest(`${API}/stats`), apiRequest(`${API}/recent-activity`), apiRequest(`${API}/locations/divisions`),
        apiRequest(`${API}/subsidy/my-history`), apiRequest(`${API}/crop-report/my-reports`), apiRequest(`${API}/expert/my-queries`),
        apiRequest(`${API}/market/browse`), apiRequest(`${API}/market/my-listings`), apiRequest(`${API}/training/programs`), apiRequest(`${API}/training/my-registrations`)
      ]);
      setData({ stats: stats || {}, activity: activity || [], divisions: divisions || [], subsidies: subsidies || [], crops: crops || [], queries: queries || [], market: market || [], myMarket: myMarket || [], programs: programs || [], registrations: registrations || [] });
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  function setSection(next) {
    setSectionState(next); setActiveForm('');
    const nextParams = new URLSearchParams(params);
    if (next === 'overview') nextParams.delete('section'); else nextParams.set('section', next);
    setParams(nextParams, { replace: true });
  }

  async function submit(event, kind, path) {
    event.preventDefault(); const form = event.currentTarget;
    await runLocked(async () => {
      try {
        const response = await apiRequest(`${API}${path}`, { method: 'POST', body: agriculturePayload(kind, form) });
        form.reset(); setActiveForm(''); await alerts.success('Submitted', response.message || 'Submitted successfully.'); await loadAll();
      } catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
    });
  }

  return <CitizenShell>
    <header className="react-page-header"><div><h1>Agriculture Services</h1><p>Subsidies, crop reporting, expert advice, farmer market, training, and weather.</p></div></header>
    <nav className="react-service-tabs" aria-label="Agriculture sections">{sections.map(value => <button type="button" className={section === value ? 'active' : ''} onClick={() => setSection(value)} key={value}>{value.replace('-', ' ')}</button>)}</nav>
    {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={loadAll}>Retry</button></div>}
    {loading ? <p className="react-empty-state">Loading agriculture services…</p> : <>
      {section === 'overview' && <><div className="react-service-stats">{[['Subsidies', data.stats.subsidies], ['Crop reports', data.stats.reports], ['Expert queries', data.stats.queries], ['Market listings', data.stats.listings], ['Training enrolled', data.stats.trainings]].map(([label, value]) => <article className="react-panel" key={label}><strong>{value || 0}</strong><span>{label}</span></article>)}</div><section className="react-panel"><h2>6-day weather forecast</h2><p>Open-Meteo, using browser location when granted and Dhaka otherwise.</p><Forecast /></section><section className="react-panel react-service-spaced"><h2>Recent activity</h2><div className="react-card-list">{data.activity.map((row, index) => <article key={`${row.type}-${row.id}-${index}`}><div><h3>{row.title}</h3><p>{row.type} · {dateText(row.created_at)}</p></div><StatusBadge value={row.status} /></article>)}{!data.activity.length && <p className="react-empty-state">No recent activity.</p>}</div></section></>}

      {section === 'subsidies' && <div className="react-two-column"><section className="react-panel"><h2>Apply for subsidy</h2><form className="react-form-stack" onSubmit={event => submit(event, 'subsidy', '/subsidy/apply')}><div className="react-form-grid"><label>Farmer name<input name="farmer_name" required /></label><label>NID number<input name="nid_number" required /></label><label>Phone<input name="phone" required /></label><label>Subsidy type<select name="subsidy_type" required defaultValue=""><option value="">Select</option>{['Fertilizer', 'Seeds', 'Machinery', 'Irrigation', 'Pesticide', 'Livestock', 'Fishery'].map(value => <option key={value}>{value}</option>)}</select></label><label>Crop type<input name="crop_type" /></label><label>Amount requested<input name="amount_requested" type="number" min="0" required /></label><label>Land size acres<input name="land_size_acres" type="number" min="0" step="0.01" /></label><label>Land ownership<select name="land_ownership" defaultValue="Own"><option>Own</option><option>Leased</option><option>Shared</option><option>Government</option></select></label><LocationIdFields apiBase={API} divisions={data.divisions} /><label>Village<input name="village" /></label><label>Bank name<input name="bank_name" /></label><label>Bank branch<input name="bank_branch" /></label><label>Bank account<input name="bank_account" /></label></div><button className="btn-primary" disabled={submitting} type="submit">Submit subsidy application</button></form></section><section className="react-panel"><h2>My applications</h2><div className="react-card-list">{data.subsidies.map(row => <article key={row.id}><div><h3>{row.subsidy_type} — ৳{Number(row.amount_requested || 0).toLocaleString()}</h3><p>{row.district_name || '—'}, {row.upazila_name || '—'} · {dateText(row.created_at)}</p></div><StatusBadge value={row.status} /></article>)}{!data.subsidies.length && <p className="react-empty-state">No subsidy applications.</p>}</div></section></div>}

      {section === 'crop-reports' && <div className="react-two-column"><section className="react-panel"><h2>Submit crop report</h2><form className="react-form-stack" onSubmit={event => submit(event, 'crop', '/crop-report/submit')}><div className="react-form-grid"><label>Farmer name<input name="farmer_name" required /></label><label>Crop name<input name="crop_name" required /></label><label>Crop variety<input name="crop_variety" /></label><label>Season<select name="season" required defaultValue=""><option value="">Select</option>{['Aus', 'Aman', 'Boro', 'Rabi', 'Kharif-1', 'Kharif-2'].map(value => <option key={value}>{value}</option>)}</select></label><label>Yield metric ton<input name="yield_metric_ton" type="number" min="0" step="0.01" required /></label><label>Land area acres<input name="land_area_acres" type="number" min="0" step="0.01" /></label><label>Fertilizer used<input name="fertilizer_used" /></label><label>Irrigation method<select name="irrigation_method" defaultValue="Rainfed">{['Rainfed', 'Canal', 'Tubewell', 'Pond', 'Drip', 'Sprinkler'].map(value => <option key={value}>{value}</option>)}</select></label><label>Harvest date<input name="harvest_date" type="date" /></label><label>Market price per ton<input name="market_price_per_ton" type="number" min="0" step="0.01" /></label><LocationIdFields apiBase={API} divisions={data.divisions} /></div><label>Remarks<textarea name="remarks" /></label><button className="btn-primary" disabled={submitting} type="submit">Submit crop report</button></form></section><section className="react-panel"><h2>My crop reports</h2><div className="react-table-wrap"><table><thead><tr><th>Crop</th><th>Season</th><th>Yield</th><th>District</th><th>Date</th></tr></thead><tbody>{data.crops.map(row => <tr key={row.id}><td>{row.crop_name}<small className="react-block">{row.crop_variety || '—'}</small></td><td>{row.season}</td><td>{row.yield_metric_ton} MT</td><td>{row.district_name || '—'}</td><td>{dateText(row.created_at)}</td></tr>)}{!data.crops.length && <EmptyRow columns={5}>No crop reports.</EmptyRow>}</tbody></table></div></section></div>}

      {section === 'expert' && <div className="react-two-column"><section className="react-panel"><h2>Ask an agriculture expert</h2><form className="react-form-stack" onSubmit={event => submit(event, 'expert', '/expert/ask')}><label>Category<select name="category" defaultValue="Other">{['Pest Control', 'Soil Health', 'Irrigation', 'Seeds', 'Fertilizer', 'Livestock', 'Fishery', 'Marketing', 'Weather', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><label>Related crop<input name="crop_name" /></label><label>Question<textarea name="question" rows="5" required /></label><button className="btn-primary" disabled={submitting} type="submit">Submit question</button></form></section><section className="react-panel"><h2>My questions</h2><div className="react-card-list">{data.queries.map(row => <article key={row.id}><div><h3 className="react-safe-text">{row.question}</h3><p>{row.category} · {row.crop_name || 'General'} · {dateText(row.created_at)}</p>{row.answer && <div className="react-answer"><strong>{row.answered_by || 'Agriculture Officer'}</strong><p>{row.answer}</p></div>}</div><StatusBadge value={row.status} /></article>)}{!data.queries.length && <p className="react-empty-state">No expert questions.</p>}</div></section></div>}

      {section === 'market' && <><div className="react-section-heading"><div><h2>Farmer market</h2><p>The backend currently includes both Approved and Pending listings in public browse results.</p></div><button className="btn-primary" type="button" onClick={() => setActiveForm(activeForm === 'market' ? '' : 'market')}>Post listing</button></div>{activeForm === 'market' && <section className="react-panel react-narrow-panel"><form className="react-form-stack" onSubmit={event => submit(event, 'market', '/market/listing')}><label>Farmer name<input name="farmer_name" required /></label><label>Phone<input name="phone" required /></label><label>Product name<input name="product_name" required /></label><label>Category<select name="product_category" defaultValue="Rice">{['Rice', 'Wheat', 'Vegetables', 'Fruits', 'Fish', 'Poultry', 'Dairy', 'Spices', 'Jute', 'Tea', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><label>Quantity<input name="quantity" type="number" min="0" required /></label><label>Unit<select name="unit" defaultValue="kg"><option>kg</option><option>ton</option><option>maund</option><option>piece</option><option>litre</option><option>dozen</option></select></label><label>Price per unit<input name="price_per_unit" type="number" min="0" step="0.01" required /></label><label>Email<input name="email" type="email" /></label><label>Description<textarea name="description" /></label><button className="btn-primary" disabled={submitting} type="submit">Submit pending listing</button></form></section>}<nav className="react-service-tabs" aria-label="Market views"><button className={marketTab === 'browse' ? 'active' : ''} onClick={() => setMarketTab('browse')} type="button">Browse</button><button className={marketTab === 'mine' ? 'active' : ''} onClick={() => setMarketTab('mine')} type="button">My listings</button></nav><div className="react-service-card-grid">{(marketTab === 'browse' ? data.market : data.myMarket).map(row => <article key={row.id}><h3>{row.product_name}</h3><p>{row.product_category} · {row.quantity} {row.unit}</p><p>৳{Number(row.price_per_unit || 0).toLocaleString()} / {row.unit}</p><p>{row.description}</p><p>{row.farmer_name} · {row.phone}</p><StatusBadge value={row.status} /></article>)}{!(marketTab === 'browse' ? data.market : data.myMarket).length && <p className="react-empty-state">No market listings.</p>}</div></>}

      {section === 'training' && <><section className="react-panel"><h2>Upcoming training</h2><div className="react-service-card-grid">{data.programs.map(row => <article key={row.id}><h3>{row.title}</h3><p>{row.description}</p><p>{dateText(row.start_date)} – {dateText(row.end_date)} · {row.location || 'Online'}</p><p>{row.trainer_name || 'Trainer TBA'} · Capacity {row.capacity}</p><StatusBadge value={row.status} /><button className="btn-primary react-service-action" type="button" onClick={() => setActiveForm(String(row.id))}>Register</button>{activeForm === String(row.id) && <form className="react-form-stack react-service-spaced" onSubmit={event => submit(event, 'training', `/training/register/${row.id}`)}><label>Farmer name<input name="farmer_name" required /></label><label>Phone<input name="phone" required /></label><button className="btn-primary" disabled={submitting} type="submit">Confirm registration</button></form>}</article>)}{!data.programs.length && <p className="react-empty-state">No upcoming programs.</p>}</div></section><section className="react-panel react-service-spaced"><h2>My training registrations</h2><div className="react-card-list">{data.registrations.map(row => <article key={row.id}><div><h3>{row.title}</h3><p>{row.location || 'Online'} · {dateText(row.start_date)}</p></div><StatusBadge value={row.status} /></article>)}{!data.registrations.length && <p className="react-empty-state">No training registrations.</p>}</div></section></>}
    </>}
  </CitizenShell>;
}
