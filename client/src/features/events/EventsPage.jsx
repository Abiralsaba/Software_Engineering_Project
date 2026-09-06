import { useEffect, useState } from 'react';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import Modal from '../../components/Modal.jsx';
import { apiRequest } from '../../services/api.js';

const categoryLabels = { General: 'সাধারণ', Urgent: 'জরুরি', Circular: 'পরিপত্র', Tender: 'দরপত্র', Recruitment: 'নিয়োগ' };
const priorityLabels = { High: 'উচ্চ', Medium: 'মাঝারি', Low: 'সাধারণ' };

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function EventsPage() {
  const [filters, setFilters] = useState({ search: '', department: '', category: '', priority: '' });
  const [data, setData] = useState({ notices: [], total: 0, page: 1, totalPages: 1, departments: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
      try {
        setData(await apiRequest(`/api/notices?${params}`, { auth: false }));
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }, filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [filters, page]);

  function updateFilter(event) {
    setFilters(current => ({ ...current, [event.target.name]: event.target.value }));
    setPage(1);
  }

  async function openNotice(id) {
    setSelected({ title: 'লোড হচ্ছে…' });
    setDetailLoading(true);
    try {
      setSelected(await apiRequest(`/api/notices/${id}`, { auth: false }));
    } catch (requestError) {
      setSelected({ title: 'বিজ্ঞপ্তি লোড করতে ব্যর্থ', content: requestError.message });
    } finally {
      setDetailLoading(false);
    }
  }

  const stats = {
    Urgent: data.notices?.filter(row => row.category === 'Urgent').length || 0,
    Circular: data.notices?.filter(row => row.category === 'Circular').length || 0,
    Tender: data.notices?.filter(row => row.category === 'Tender').length || 0,
    Recruitment: data.notices?.filter(row => row.category === 'Recruitment').length || 0
  };

  return (
    <CitizenShell>
      <header className="react-page-header"><div><h1>সরকারি বিজ্ঞপ্তি</h1><p>Government notices, circulars, tenders and recruitment updates.</p></div><time>{formatDate(new Date())}</time></header>
      <div className="react-dashboard-grid react-notice-stats"><div className="react-panel"><strong>{data.total || 0}</strong><span>মোট বিজ্ঞপ্তি</span></div>{Object.entries(stats).map(([label, count]) => <div className="react-panel" key={label}><strong>{count}</strong><span>{categoryLabels[label]}</span></div>)}</div>
      <section className="react-panel"><div className="react-filter-grid"><label>Search<input name="search" value={filters.search} onChange={updateFilter} placeholder="Title, content, reference…" /></label><label>Department<select name="department" value={filters.department} onChange={updateFilter}><option value="">All departments</option>{(data.departments || []).map(value => <option value={value} key={value}>{value}</option>)}</select></label><label>Category<select name="category" value={filters.category} onChange={updateFilter}><option value="">All categories</option>{Object.keys(categoryLabels).map(value => <option value={value} key={value}>{value}</option>)}</select></label><label>Priority<select name="priority" value={filters.priority} onChange={updateFilter}><option value="">All priorities</option>{Object.keys(priorityLabels).map(value => <option value={value} key={value}>{value}</option>)}</select></label></div>
        {Object.values(filters).some(Boolean) && <button className="btn-secondary react-clear-button" type="button" onClick={() => { setFilters({ search: '', department: '', category: '', priority: '' }); setPage(1); }}>Clear filters</button>}
      </section>
      {error && <div className="react-dashboard-error" role="alert">{error}</div>}
      <section className="react-notice-list">{loading ? <p className="react-empty-state">বিজ্ঞপ্তি লোড হচ্ছে…</p> : data.notices?.map(notice => <button className={`react-notice-card priority-${String(notice.priority).toLowerCase()}`} type="button" onClick={() => openNotice(notice.id)} key={notice.id}><div><h2>{notice.title_bn || notice.title}</h2>{notice.title_bn && <h3>{notice.title}</h3>}</div><div className="react-chip-row"><span>{categoryLabels[notice.category] || notice.category}</span><span>{priorityLabels[notice.priority] || notice.priority}</span></div><p>{notice.content}</p><footer><span><i className="fas fa-building" /> {notice.department}</span>{notice.reference_no && <span><i className="fas fa-file-signature" /> {notice.reference_no}</span>}<span><i className="far fa-calendar" /> {formatDate(notice.publish_date)}</span></footer></button>)}{!loading && !data.notices?.length && <p className="react-empty-state">কোনো বিজ্ঞপ্তি পাওয়া যায়নি।</p>}</section>
      {data.totalPages > 1 && <nav className="react-pagination" aria-label="Notice pages"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {data.page} of {data.totalPages}</span><button type="button" disabled={page >= data.totalPages} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
      {selected && <Modal title={selected.title_bn || selected.title} onClose={() => setSelected(null)}>{detailLoading ? <p>লোড হচ্ছে…</p> : <article className="react-notice-detail">{selected.title_bn && <h3>{selected.title}</h3>}<div className="react-detail-grid"><p><strong>Department</strong>{selected.department}</p><p><strong>Category</strong>{categoryLabels[selected.category] || selected.category}</p><p><strong>Priority</strong>{priorityLabels[selected.priority] || selected.priority}</p><p><strong>Published</strong>{formatDate(selected.publish_date)}</p><p><strong>Reference</strong>{selected.reference_no || 'N/A'}</p><p><strong>Publisher</strong>{selected.created_by_name || 'System'}</p></div>{selected.attachment_url && <a className="btn-primary react-attachment" href={selected.attachment_url} target="_blank" rel="noreferrer"><i className="fas fa-download" /> Download attachment</a>}<p className="react-notice-content">{selected.content}</p></article>}</Modal>}
    </CitizenShell>
  );
}
