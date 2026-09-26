import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStylesheets } from '../hooks/useStylesheets.js';
import { apiRequest } from '../services/api.js';
import CitizenGuide, { GUIDE_ROUTE_KEY } from '../features/assistant/CitizenGuide.jsx';
import '../features/assistant/assistant.css';

import { ministryDesigns, ministryService } from './ministryDesigns.js';
import { MinistryBanner } from './MinistryPresentation.jsx';

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

const ministryPaths = new Set([
  '/agriculture.html',
  '/land.html',
  '/tax.html',
  '/passport.html',
  '/nid.html',
  '/health.html',
  '/water.html',
  '/education.html'
]);

export function resolveAssetUrl(value) {
  if (!value) return '';
  if (/^(https?:|data:|blob:|\/)/.test(value)) return value;
  return `/${value}`;
}

export default function CitizenShell({ children, pageStyles = [], ministry, sections = [], activeSection, onSectionChange }) {
  useStylesheets(['/css/style.css', '/css/sidebar.css', ...pageStyles, ...(!ministry ? ['/css/dashboard.css', '/css/citizen-pages.css'] : [])]);
  const location = useLocation();
  const isMinistryPage = ministryPaths.has(location.pathname);
  const navigate = useNavigate();
  const design = ministryDesigns[ministry];
  const { clearCitizenSession } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState({});
  const [profileReady, setProfileReady] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(() => Boolean(sessionStorage.getItem(GUIDE_ROUTE_KEY)));
  const [assistantStarted, setAssistantStarted] = useState(() => Boolean(sessionStorage.getItem(GUIDE_ROUTE_KEY)));

  useEffect(() => {
    let active = true;
    apiRequest('/api/user/profile')
      .then(data => active && setProfile(data))
      .catch(() => {})
      .finally(() => { if (active) setProfileReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!design) return;
    document.body.classList.add('nx-ministry-body');
    return () => document.body.classList.remove('nx-ministry-body');
  }, [design]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const close = event => { if (event.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [sidebarOpen]);
  function logout() {
    clearCitizenSession();
    navigate('/index.html', { replace: true });
  }

  return (
    <div className={design ? `nationx-ministry-page nx-ministry-${ministry}` : `nationx-dashboard nationx-citizen-pages${isMinistryPage ? ' nationx-ministry-page' : ''}`} style={design ? { '--ministry-accent': design.accent, '--ministry-light': design.light } : undefined}>
      <button className="nx-assistant-launch" onClick={() => {setAssistantStarted(true);setAssistantOpen(v => !v);}} aria-expanded={assistantOpen}>{assistantOpen ? 'Close assistant' : 'Voice assistant · কথা বলুন'}</button>
      {assistantStarted && <aside hidden={!assistantOpen} className="nx-assistant-drawer nx-guide-drawer"><CitizenGuide visible={assistantOpen} ministry={ministry} activeSection={activeSection} onSectionChange={onSectionChange} profile={profile} profileReady={profileReady} onClose={() => setAssistantOpen(false)} /></aside>}
      {design && <div className="nx-ministry-decoration" aria-hidden="true"><div className="bg-shape shape-1" /><div className="bg-shape shape-2" /></div>}
      {!design && <div className="dashboard-ambient" aria-hidden="true">
        <span className="dashboard-orb dashboard-orb-green" />
        <span className="dashboard-orb dashboard-orb-red" />
        <span className="dashboard-orb dashboard-orb-gold" />
        <span className="dashboard-grid-pattern" />
        <span className="dashboard-wave dashboard-wave-one" />
        <span className="dashboard-wave dashboard-wave-two" />
      </div>}
      <button className={`react-sidebar-toggle ${sidebarOpen ? 'is-open' : ''}`} type="button" aria-controls="citizen-sidebar" aria-expanded={sidebarOpen} aria-label={sidebarOpen ? 'Close menu' : 'Toggle navigation'} onClick={() => setSidebarOpen(value => !value)}><i className={`fas ${sidebarOpen ? 'fa-xmark' : 'fa-bars'}`} /></button>
      {sidebarOpen && <button className="react-sidebar-overlay" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <div className="dashboard-container">
        <aside id="citizen-sidebar" className={`sidebar ${sidebarOpen ? 'react-sidebar-open' : ''}`}>
          {design ? <>
            <div className="user-profile nx-ministry-identity">
              <div className="user-avatar"><i className={`fas fa-${design.icon}`} aria-hidden="true" /></div>
              <h3>{design.bn}</h3><p>{design.title}</p>
            </div>
            <nav className="nav-links" aria-label={`${ministry} services`}>
              <Link to="/dashboard.html"><i className="fas fa-arrow-left" aria-hidden="true" /> Back to Dashboard</Link>
              {sections.map(section => {
                const item = ministryService(section);
                return <a key={item.id} href={`?section=${item.id}`} className={activeSection === item.id ? 'active' : ''} aria-current={activeSection === item.id ? 'page' : undefined} onClick={event => { event.preventDefault(); onSectionChange(item.id); setSidebarOpen(false); }}><i className={`fas fa-${item.icon}`} aria-hidden="true" />{item.label}</a>;
              })}
              {ministry === 'education' && <Link to="/admission.html"><i className="fas fa-university" aria-hidden="true" /> University Admission</Link>}
            </nav>
          </> : <>
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
          </>}
        </aside>
        <main className="main-content react-page-content"><div className={design ? 'nx-ministry-content' : 'dashboard-content-shell citizen-content-shell'}>{design && <MinistryBanner design={design} id={ministry} />}{children}</div></main>
      </div>
    </div>
  );
}
