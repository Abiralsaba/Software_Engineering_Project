import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal.jsx';
import RouteLoading from '../../components/RouteLoading.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStylesheets } from '../../hooks/useStylesheets.js';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import ServiceRequestModal from './ServiceRequestModal.jsx';

const navigation = [
  ['documents.html', 'folder', 'My Documents'],
  ['history.html', 'history', 'History'],
  ['todo.html', 'tasks', 'To Do'],
  ['community.html', 'users', 'Community'],
  ['market.html', 'chart-line', 'Market Info'],
  ['events.html', 'bullhorn', 'Notices'],
  ['education.html', 'graduation-cap', 'Education'],
  ['contact.html', 'envelope', 'Contact']
];

function resolveAssetUrl(value) {
  if (!value) return '';
  if (/^(https?:|data:|blob:|\/)/.test(value)) return value;
  return `/${value}`;
}

export default function DashboardPage() {
  useStylesheets(['/css/style.css', '/css/sidebar.css', '/css/dashboard.css']);
  const navigate = useNavigate();
  const { clearCitizenSession } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [serviceModal, setServiceModal] = useState(false);
  const [collectionModal, setCollectionModal] = useState(null);
  const [collectionLoading, setCollectionLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setError('');
    try {
      const [summary, departmentRows] = await Promise.all([
        apiRequest('/api/dashboard/summary'),
        apiRequest('/api/dashboard/departments')
      ]);
      setDashboard(summary);
      setDepartments(departmentRows);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  function logout() {
    clearCitizenSession();
    navigate('/index.html', { replace: true });
  }

  async function openCollection(type) {
    const config = {
      active: ['Active Requests', '/api/dashboard/services/active'],
      completed: ['Completed Tasks', '/api/dashboard/services/completed'],
      notifications: ['Notifications', '/api/dashboard/notifications']
    }[type];
    setCollectionModal({ type, title: config[0], rows: [] });
    setCollectionLoading(true);
    try {
      const rows = await apiRequest(config[1]);
      setCollectionModal({ type, title: config[0], rows });
    } catch (requestError) {
      setCollectionModal({ type, title: config[0], rows: [], error: requestError.message });
    } finally {
      setCollectionLoading(false);
    }
  }

  async function readNotification(notification) {
    await alerts.success('Notification', notification.message);
    if (!notification.is_read) {
      await apiRequest(`/api/dashboard/notifications/${notification.id}/read`, { method: 'PUT' });
      setCollectionModal(current => ({
        ...current,
        rows: current.rows.map(row => row.id === notification.id ? { ...row, is_read: 1 } : row)
      }));
      loadDashboard();
    }
  }

  if (loading) return <RouteLoading label="Loading citizen dashboard…" />;

  const user = dashboard?.user || {};
  const stats = dashboard?.stats || {};

  return (
    <div className="nationx-dashboard">
      <div className="dashboard-ambient" aria-hidden="true">
        <span className="dashboard-orb dashboard-orb-green" />
        <span className="dashboard-orb dashboard-orb-red" />
        <span className="dashboard-orb dashboard-orb-gold" />
        <span className="dashboard-grid-pattern" />
        <span className="dashboard-wave dashboard-wave-one" />
        <span className="dashboard-wave dashboard-wave-two" />
      </div>
      <button className={`react-sidebar-toggle ${sidebarOpen ? 'is-open' : ''}`} type="button" aria-label={sidebarOpen ? 'Close menu' : 'Toggle navigation'} onClick={() => setSidebarOpen(value => !value)}><i className={`fas ${sidebarOpen ? 'fa-xmark' : 'fa-bars'}`} /></button>
      {sidebarOpen && <button className="react-sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <div className="dashboard-container">
        <aside className={`sidebar ${sidebarOpen ? 'react-sidebar-open' : ''}`}>
          <Link className="dashboard-brand" to="/dashboard.html" aria-label="NationX citizen portal">
            <span className="dashboard-brand-mark"><span /></span>
            <span><strong>NationX</strong><small>Citizen Portal</small></span>
          </Link>
          <Link className="user-profile" to="/profile.html" onClick={() => setSidebarOpen(false)}>
            <div className="user-avatar">{user.photo_url ? <img src={resolveAssetUrl(user.photo_url)} alt="Citizen profile" /> : <i className="fas fa-user" />}</div>
            <h3>{user.name || 'Citizen'}</h3><p>NID: {user.nid || '—'}</p>
          </Link>
          <nav className="nav-links">
            <span className="dashboard-nav-label">Citizen workspace</span>
            <Link className="active" to="/dashboard.html"><i className="fas fa-home" /> Dashboard</Link>
            {navigation.map(([path, icon, label]) => <Link to={`/${path}`} key={path} onClick={() => setSidebarOpen(false)}><i className={`fas fa-${icon}`} /> {label}</Link>)}
            <button className="react-nav-button dashboard-logout" type="button" onClick={logout}><i className="fas fa-sign-out-alt" /> Logout</button>
          </nav>
        </aside>

        <main className="main-content">
          <div className="dashboard-content-shell">
            <div className="react-dashboard-header">
              <div className="dashboard-heading">
                <span className="dashboard-eyebrow"><i className="fas fa-shield-halved" /> Secure citizen workspace</span>
                <h1>Citizen Dashboard</h1>
                <p>Welcome back, <strong>{user.name || 'Citizen'}</strong>. Your government services are ready.</p>
              </div>
              <button className="btn-primary react-request-button" type="button" onClick={() => setServiceModal(true)}><i className="fas fa-plus" /><span>New Request</span></button>
            </div>
            {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={loadDashboard}>Retry</button></div>}

            <section className="react-dashboard-grid" aria-label="Citizen service summary">
              <button className="react-stat-card stat-active" type="button" onClick={() => openCollection('active')}>
                <span className="stat-card-top"><span className="stat-icon"><i className="fas fa-hourglass-half" /></span><i className="fas fa-arrow-up-right-from-square stat-arrow" /></span>
                <span className="stat-value">{stats.activeRequests || 0}</span>
                <span className="stat-copy"><strong>Active Requests</strong><small>Pending government review</small></span>
              </button>
              <button className="react-stat-card stat-completed" type="button" onClick={() => openCollection('completed')}>
                <span className="stat-card-top"><span className="stat-icon"><i className="fas fa-circle-check" /></span><i className="fas fa-arrow-up-right-from-square stat-arrow" /></span>
                <span className="stat-value">{stats.completedTasks || 0}</span>
                <span className="stat-copy"><strong>Completed Tasks</strong><small>Approved applications</small></span>
              </button>
              <button className="react-stat-card stat-notifications" type="button" onClick={() => openCollection('notifications')}>
                <span className="stat-card-top"><span className="stat-icon"><i className="fas fa-bell" /></span><i className="fas fa-arrow-up-right-from-square stat-arrow" /></span>
                <span className="stat-value">{stats.notifications || 0}</span>
                <span className="stat-copy"><strong>Notifications</strong><small>Unread citizen messages</small></span>
              </button>
            </section>

            <section className="react-departments">
              <header className="dashboard-section-heading"><div><span>Explore services</span><h2>Government Departments</h2></div><p>Select a department to manage your applications and records.</p></header>
              <div className="react-dept-grid">{departments.map((department, index) => <a className="react-dept-card" href={`/${department.link}`} style={{ '--department-index': index }} key={department.link}><span className="department-icon"><i className={`fas ${department.icon}`} /></span><span className="department-copy"><h3>{department.name}</h3><p>{department.desc}</p></span><i className="fas fa-arrow-right department-arrow" /></a>)}</div>
            </section>

            <footer className="dashboard-footer-note"><span><i className="fas fa-lock" /> Protected local government portal</span><span className="dashboard-online"><i /> Services connected</span></footer>
          </div>
        </main>
      </div>

      {serviceModal && <ServiceRequestModal onClose={() => setServiceModal(false)} onSubmitted={loadDashboard} />}
      {collectionModal && (
        <Modal title={collectionModal.title} onClose={() => setCollectionModal(null)}>
          {collectionLoading ? <RouteLoading label={`Loading ${collectionModal.title.toLowerCase()}…`} /> : (
            <Collection type={collectionModal.type} rows={collectionModal.rows} error={collectionModal.error} onNotification={readNotification} />
          )}
        </Modal>
      )}
    </div>
  );
}

function Collection({ type, rows, error, onNotification }) {
  if (error) return <div className="react-dashboard-error" role="alert">{error}</div>;
  if (!rows.length) return <p className="react-empty-state">No records found.</p>;

  if (type === 'notifications') {
    return <div className="react-collection-list">{rows.map(row => <button className={row.is_read ? 'read' : 'unread'} type="button" key={row.id} onClick={() => onNotification(row)}><i className="fas fa-bell" /><span>{row.message}<small>{new Date(row.created_at).toLocaleString()}</small></span></button>)}</div>;
  }

  return (
    <div className="react-table-wrap"><table><thead><tr><th>Service</th><th>Details / ID</th><th>Status</th><th>Date</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.service_type}</td><td>{row.details || row.unique_number || '—'}</td><td><span className={`react-status ${String(row.status).toLowerCase()}`}>{row.status}</span></td><td>{new Date(row.created_at || row.completed_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>
  );
}
