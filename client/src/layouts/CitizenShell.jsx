import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStylesheets } from '../hooks/useStylesheets.js';
import { apiRequest } from '../services/api.js';

const navigation = [
  ['dashboard.html', 'home', 'Dashboard'],
  ['documents.html', 'folder', 'My Documents'],
  ['history.html', 'history', 'History'],
  ['todo.html', 'tasks', 'To Do'],
  ['community.html', 'users', 'Community'],
  ['market.html', 'chart-line', 'Market Info'],
  ['events.html', 'bullhorn', 'Notices'],
  ['education.html', 'graduation-cap', 'Education'],
  ['contact.html', 'envelope', 'Contact']
];

export function resolveAssetUrl(value) {
  if (!value) return '';
  if (/^(https?:|data:|blob:|\/)/.test(value)) return value;
  return `/${value}`;
}

export default function CitizenShell({ children, pageStyles = [] }) {
  useStylesheets(['/css/style.css', '/css/sidebar.css', ...pageStyles, '/css/dashboard.css', '/css/citizen-pages.css']);
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCitizenSession } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState({});

  useEffect(() => {
    let active = true;
    apiRequest('/api/user/profile')
      .then(data => active && setProfile(data))
      .catch(() => {});
    return () => { active = false; };
  }, []);

  function logout() {
    clearCitizenSession();
    navigate('/index.html', { replace: true });
  }

  return (
    <div className="nationx-dashboard nationx-citizen-pages">
      <div className="dashboard-ambient" aria-hidden="true">
        <span className="dashboard-orb dashboard-orb-green" />
        <span className="dashboard-orb dashboard-orb-red" />
        <span className="dashboard-orb dashboard-orb-gold" />
        <span className="dashboard-grid-pattern" />
        <span className="dashboard-wave dashboard-wave-one" />
        <span className="dashboard-wave dashboard-wave-two" />
      </div>
      <button className={`react-sidebar-toggle ${sidebarOpen ? 'is-open' : ''}`} type="button" aria-label={sidebarOpen ? 'Close menu' : 'Toggle navigation'} onClick={() => setSidebarOpen(value => !value)}><i className={`fas ${sidebarOpen ? 'fa-xmark' : 'fa-bars'}`} /></button>
      {sidebarOpen && <button className="react-sidebar-overlay" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <div className="dashboard-container">
        <aside className={`sidebar ${sidebarOpen ? 'react-sidebar-open' : ''}`}>
          <Link className="dashboard-brand" to="/dashboard.html" aria-label="NationX citizen portal">
            <span className="dashboard-brand-mark"><span /></span>
            <span><strong>NationX</strong><small>Citizen Portal</small></span>
          </Link>
          <Link className="user-profile" to="/profile.html" onClick={() => setSidebarOpen(false)}>
            <div className="user-avatar">{profile.profile_image ? <img src={resolveAssetUrl(profile.profile_image)} alt="Citizen profile" /> : <i className="fas fa-user" />}</div>
            <h3>{profile.name || 'Citizen'}</h3><p>NID: {profile.nid || '—'}</p>
          </Link>
          <nav className="nav-links">
            <span className="dashboard-nav-label">Citizen workspace</span>
            {navigation.map(([path, icon, label]) => (
              <Link className={location.pathname === `/${path}` ? 'active' : ''} to={`/${path}`} key={path} onClick={() => setSidebarOpen(false)}><i className={`fas fa-${icon}`} /> {label}</Link>
            ))}
            <button className="react-nav-button dashboard-logout" type="button" onClick={logout}><i className="fas fa-sign-out-alt" /> Logout</button>
          </nav>
        </aside>
        <main className="main-content react-page-content"><div className="dashboard-content-shell citizen-content-shell">{children}</div></main>
      </div>
    </div>
  );
}
