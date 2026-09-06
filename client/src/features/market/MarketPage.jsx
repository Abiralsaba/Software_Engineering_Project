import { useEffect, useMemo, useState } from 'react';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';

const emptyComplaint = { shop_name: '', shop_phone: '', shop_location: '', item_name: '', official_price: '', charged_price: '', description: '' };

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `৳${number.toFixed(2)}` : '—';
}

export default function MarketPage() {
  const [view, setView] = useState('hub');
  const [prices, setPrices] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyComplaint);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest('/api/shop/market-prices', { auth: false }),
      apiRequest('/api/shop/complaints/my')
    ]).then(([priceRows, complaintRows]) => {
      setPrices(Array.isArray(priceRows) ? priceRows : []);
      setComplaints(Array.isArray(complaintRows) ? complaintRows : []);
    }).catch(requestError => setError(requestError.message)).finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ['All', ...new Set(prices.map(row => row.category))], [prices]);
  const visiblePrices = useMemo(() => prices.filter(row => {
    const categoryMatches = category === 'All' || row.category === category;
    const term = search.trim().toLowerCase();
    return categoryMatches && (!term || String(row.item_name).toLowerCase().includes(term) || String(row.item_name_bn || '').toLowerCase().includes(term));
  }), [category, prices, search]);

  const difference = Number(form.charged_price || 0) - Number(form.official_price || 0);

  function update(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await apiRequest('/api/shop/complaints', { method: 'POST', body: form });
      if (!result.success) throw new Error(result.error || 'Complaint submission failed');
      setForm(emptyComplaint);
      const complaintRows = await apiRequest('/api/shop/complaints/my');
      setComplaints(complaintRows);
      await alerts.success('Complaint Submitted!', result.message);
    } catch (requestError) {
      setError(requestError.message);
      await alerts.error(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CitizenShell>
      <header className="react-page-header"><div><h1>Market Information</h1><p>Official prices and citizen price-fraud reporting.</p></div>{view !== 'hub' && <button className="btn-secondary" type="button" onClick={() => setView('hub')}><i className="fas fa-arrow-left" /> Market Home</button>}</header>
      {error && <div className="react-dashboard-error" role="alert">{error}</div>}
      {view === 'hub' && <div className="react-hub-grid"><a className="react-hub-card" href="/shop.html"><i className="fas fa-store" /><h2>Government Store</h2><p>Browse official publications and goods.</p></a><button className="react-hub-card" type="button" onClick={() => setView('prices')}><i className="fas fa-tags" /><h2>Today&apos;s Market Price</h2><p>Check government-set prices for necessities.</p></button><button className="react-hub-card" type="button" onClick={() => setView('report')}><i className="fas fa-shield-halved" /><h2>Report Price Fraud</h2><p>Report vendors charging above official prices.</p></button></div>}
      {view === 'prices' && <section className="react-panel"><div className="react-toolbar"><input aria-label="Search market prices" placeholder="Search items…" value={search} onChange={event => setSearch(event.target.value)} /><div className="react-chip-row">{categories.map(value => <button className={category === value ? 'active' : ''} type="button" onClick={() => setCategory(value)} key={value}>{value}</button>)}</div></div>
        {loading ? <p className="react-empty-state">Loading prices…</p> : <div className="react-table-wrap"><table><thead><tr><th>Item</th><th>Category</th><th>Unit</th><th>Official Price</th><th>Effective</th></tr></thead><tbody>{visiblePrices.map(row => <tr key={row.id}><td><strong>{row.item_name}</strong>{row.item_name_bn && <small className="react-block">{row.item_name_bn}</small>}</td><td>{row.category}</td><td>{row.unit}</td><td>{money(row.price)}</td><td>{new Date(row.effective_date || row.updated_at).toLocaleDateString()}</td></tr>)}{!visiblePrices.length && <tr><td colSpan="5" className="react-empty-state">No prices found.</td></tr>}</tbody></table></div>}
      </section>}
      {view === 'report' && <div className="react-two-column react-market-columns"><section className="react-panel"><h2>File a Price Complaint</h2><form className="react-form-stack" onSubmit={submit}><label>Shop Name<input name="shop_name" value={form.shop_name} onChange={update} required /></label><label>Shop Phone<input name="shop_phone" value={form.shop_phone} onChange={update} /></label><label>Shop Location<input name="shop_location" value={form.shop_location} onChange={update} required /></label><label>Item Name<input name="item_name" value={form.item_name} onChange={update} required /></label><div className="react-form-grid"><label>Official Price<input name="official_price" type="number" min="0" step="0.01" value={form.official_price} onChange={update} /></label><label>Charged Price<input name="charged_price" type="number" min="0.01" step="0.01" value={form.charged_price} onChange={update} required /></label></div>{form.official_price && form.charged_price && <p className={difference > 0 ? 'react-price-alert' : 'react-price-ok'}>Difference: {money(difference)}</p>}<label>Description<textarea name="description" rows="4" value={form.description} onChange={update} /></label><button className="btn-primary" disabled={submitting} type="submit">{submitting ? 'Submitting…' : 'Submit Complaint'}</button></form></section><section className="react-panel"><h2>Your Previous Complaints</h2><div className="react-card-list">{complaints.map(row => <article key={row.id}><div><h3>{row.shop_name} — {row.item_name}</h3><p>{row.shop_location}{row.shop_phone ? ` · ${row.shop_phone}` : ''}</p><p>Charged: {money(row.charged_price)}{row.official_price ? ` · Official: ${money(row.official_price)}` : ''}</p>{row.description && <p>{row.description}</p>}</div><span className={`react-status ${String(row.status).toLowerCase()}`}>{row.status}</span></article>)}{!complaints.length && <p className="react-empty-state">You have not filed any complaints.</p>}</div></section></div>}
    </CitizenShell>
  );
}
