import { useEffect, useMemo, useState } from 'react';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import RouteLoading from '../../components/RouteLoading.jsx';
import { apiRequest } from '../../services/api.js';

const filters = ['all', 'pending', 'approved', 'rejected'];

export default function HistoryPage() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/dashboard/history')
      .then(data => setRows(Array.isArray(data) ? data : []))
      .catch(requestError => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const visibleRows = useMemo(() => filter === 'all'
    ? rows
    : rows.filter(row => String(row.status || 'Pending').toLowerCase() === filter), [filter, rows]);

  return (
    <CitizenShell pageStyles={['/css/history.css']}>
      <header className="react-page-header"><div><h1>Service History</h1><p>Track your government service requests and outcomes.</p></div></header>
      <section className="history-card">
        <div className="filter-group" aria-label="History status filter">
          {filters.map(value => <button className={`filter-btn ${filter === value ? 'active' : ''}`} type="button" data-filter={value} onClick={() => setFilter(value)} key={value}>{value[0].toUpperCase() + value.slice(1)}</button>)}
        </div>
        {loading ? <RouteLoading label="Loading service history…" /> : error ? <div className="react-dashboard-error" role="alert">{error}</div> : (
          <div className="react-table-wrap"><table className="history-table"><thead><tr><th>Date</th><th>Service</th><th>Details</th><th>Status</th></tr></thead><tbody>
            {visibleRows.map(row => <tr key={row.id}><td>{new Date(row.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td><td>{row.service_type}</td><td>{row.details || '—'}</td><td><span className={`status-pill status-${String(row.status || 'Pending').toLowerCase()}`}>{row.status || 'Pending'}</span></td></tr>)}
            {!visibleRows.length && <tr><td colSpan="4" className="empty-state"><i className="fas fa-folder-open" /> No items found.</td></tr>}
          </tbody></table></div>
        )}
      </section>
    </CitizenShell>
  );
}
