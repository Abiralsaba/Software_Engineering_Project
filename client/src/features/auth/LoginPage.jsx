import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthHeader, FormField } from '../../layouts/AuthShell.jsx';
import VillageLoginShell from './VillageLoginShell.jsx';
import { authApi, apiRequest } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { alerts } from '../../utils/alerts.js';
import RiverJourney from '../../components/RiverJourney.jsx';

const emptyAdminRegistration = {
  name: '', nid: '', email: '', mobile: '', password: '', confirmPassword: '',
  requested_domain_code: '', requested_scope_level: 'central', requested_division_id: '',
  access_request_note: ''
};

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setCitizenSession, setAdminSession } = useAuth();
  const [audience, setAudience] = useState(location.hash === '#admin' ? 'admin' : 'citizen');
  const [adminMode, setAdminMode] = useState('login');
  const [citizen, setCitizen] = useState({ email: '', password: '' });
  const [adminLogin, setAdminLogin] = useState({ email: '', password: '' });
  const [adminRegistration, setAdminRegistration] = useState(emptyAdminRegistration);
  const [pendingNotice, setPendingNotice] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [applicantLogin, setApplicantLogin] = useState(false);
  const [adminOptions, setAdminOptions] = useState({ domains: [], divisions: [] });
  const [arrival, setArrival] = useState(null);

  useEffect(() => {
    if (!arrival) return;
    const timer = window.setTimeout(() => navigate(arrival, { replace: true }), 2000);
    return () => window.clearTimeout(timer);
  }, [arrival, navigate]);

  useEffect(() => {
    setAudience(location.hash === '#admin' ? 'admin' : 'citizen');
    setPendingNotice(false);
    setError('');
  }, [location.hash]);

  useEffect(() => {
    if (audience !== 'admin' || adminMode !== 'register' || adminOptions.domains.length) return;
    apiRequest('/api/admin/access/options', { auth: false })
      .then(setAdminOptions)
      .catch(requestError => setError(requestError.message));
  }, [audience, adminMode, adminOptions.domains.length]);

  function selectAudience(nextAudience) {
    setAudience(nextAudience);
    setPendingNotice(false);
    setError('');
    navigate(nextAudience === 'admin' ? '/index.html#admin' : '/index.html#signin', { replace: true });
  }

  async function submitCitizen(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = applicantLogin ? await apiRequest('/api/applicants/login', { method: 'POST', auth: false, body: citizen }) : await authApi.citizenLogin(citizen);
      setCitizenSession(data.token);
      setArrival(applicantLogin ? '/nid-applicant.html' : '/dashboard.html');
    } catch (requestError) {
      setError(requestError.message);
      await alerts.error(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAdminLogin(event) {
    event.preventDefault();
    setSubmitting(true);
    setPendingNotice(false);
    setError('');
    try {
      const data = await authApi.adminLogin(adminLogin);
      setAdminSession(data.token, data.admin?.name);
      setArrival('/reports.html');
    } catch (requestError) {
      setPendingNotice(requestError.data?.status === 'pending');
      setError(requestError.message);
      await alerts.error(requestError.message, 'Login Failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAdminRegistration(event) {
    event.preventDefault();
    if (adminRegistration.password !== adminRegistration.confirmPassword) {
      setError('Passwords do not match');
      await alerts.error('Passwords do not match', 'Password Mismatch');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { confirmPassword, ...payload } = adminRegistration;
      const data = await authApi.adminRegister(payload);
      await alerts.success('Registration Successful!', data.message || 'Your account is pending approval.');
      setAdminRegistration(emptyAdminRegistration);
      setAdminMode('login');
    } catch (requestError) {
      setError(requestError.message);
      await alerts.error(requestError.message, 'Registration Failed');
    } finally {
      setSubmitting(false);
    }
  }

  const updateAdminRegistration = event => {
    const { name, value } = event.target;
    setAdminRegistration(current => {
      const next = { ...current, [name]: value };
      if (name === 'requested_domain_code') {
        const domain = adminOptions.domains.find(item => item.code === value);
        if (domain && !domain.supports_division_scope) {
          next.requested_scope_level = 'central';
          next.requested_division_id = '';
        }
      }
      if (name === 'requested_scope_level' && value === 'central') next.requested_division_id = '';
      return next;
    });
  };

  const selectedAdminDomain = adminOptions.domains.find(domain => domain.code === adminRegistration.requested_domain_code);

  if (arrival) return <div className="nx-login-arrival"><RiverJourney success onContinue={() => navigate(arrival, { replace: true })} /></div>;

  return (
    <VillageLoginShell admin={audience === 'admin'} registering={audience === 'admin' && adminMode === 'register'}>
      <AuthHeader admin={audience === 'admin'} />

      <div className="role-tabs" aria-label="Portal role">
        <button className={`role-tab ${audience === 'citizen' ? 'active' : ''}`} onClick={() => selectAudience('citizen')} type="button" aria-pressed={audience === 'citizen'}>
          <i className="fas fa-users" /><span>Citizen</span>
        </button>
        <button className={`role-tab ${audience === 'admin' ? 'active' : ''}`} onClick={() => selectAudience('admin')} type="button" aria-pressed={audience === 'admin'}>
          <i className="fas fa-user-shield" /><span>Admin</span>
        </button>
      </div>

      {error && <div className="react-auth-error" role="alert">{error}</div>}

      {audience === 'citizen' ? (
        <section className="login-section active" aria-label="Citizen login">
          <form className="auth-form" onSubmit={submitCitizen}>
            <label className={`applicant-login-option${applicantLogin ? ' selected' : ''}`}>
              <input type="checkbox" checked={applicantLogin} onChange={event => setApplicantLogin(event.target.checked)} />
              <span className="applicant-login-icon"><i className="fas fa-id-card" aria-hidden="true" /></span>
              <span className="applicant-login-copy"><strong>Applicant login</strong><small>Use this if you registered without an NID.</small></span>
              <span className="applicant-login-switch" aria-hidden="true"><span /></span>
            </label>
            <FormField id="citizen-email" type="email" autoComplete="username" label="Email Address" icon="envelope" placeholder="you@example.com" value={citizen.email} onChange={event => setCitizen({ ...citizen, email: event.target.value })} required />
            <div className="nx-password-field"><FormField id="citizen-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" label="Password" icon="lock" placeholder="Enter your password" value={citizen.password} onChange={event => setCitizen({ ...citizen, password: event.target.value })} required /><button type="button" className="nx-password-reveal" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><i className={`fas fa-${showPassword ? 'eye-slash' : 'eye'}`} aria-hidden="true" /></button></div>
            <button className="btn-submit" disabled={submitting} type="submit">
              <span>{submitting ? 'Authenticating…' : 'Login to Portal'}</span>
              <i className={`fas ${submitting ? 'fa-spinner fa-spin' : 'fa-arrow-right'}`} />
            </button>
          </form>
          <div className="forgot-link"><Link to="/forgot-password.html"><i className="fas fa-key" /> Forgot Password?</Link></div>
          <div className="auth-links"><span>New Citizen?</span><Link to="/register.html">Create Account <i className="fas fa-user-plus" /></Link></div>
        </section>
      ) : (
        <section className="login-section active" aria-label="Administrator access">
          {pendingNotice && (
            <div className="admin-pending-notice react-visible-notice">
              <i className="fas fa-clock" />
              <p>Your registration is pending approval. Please contact the super administrator.</p>
            </div>
          )}

          {adminMode === 'login' ? (
            <form className="auth-form admin-login-visible" onSubmit={submitAdminLogin}>
              <FormField id="admin-email" type="email" label="Admin Email" icon="envelope" value={adminLogin.email} onChange={event => setAdminLogin({ ...adminLogin, email: event.target.value })} required />
              <FormField id="admin-password" type="password" label="Password" icon="lock" value={adminLogin.password} onChange={event => setAdminLogin({ ...adminLogin, password: event.target.value })} required />
              <button className="btn-submit admin-btn" disabled={submitting} type="submit"><span>{submitting ? 'Signing in…' : 'Sign In to Admin Panel'}</span><i className="fas fa-arrow-right" /></button>
              <div className="admin-toggle"><span>Don&apos;t have an admin account?</span><button className="link-button" onClick={() => setAdminMode('register')} type="button">Register <i className="fas fa-user-plus" /></button></div>
            </form>
          ) : (
            <form className="auth-form admin-login-visible" onSubmit={submitAdminRegistration}>
              <FormField id="admin-reg-name" name="name" type="text" label="Full Name" icon="user" value={adminRegistration.name} onChange={updateAdminRegistration} required />
              <FormField id="admin-reg-nid" name="nid" type="text" label="NID Number" icon="id-card" value={adminRegistration.nid} onChange={updateAdminRegistration} required />
              <FormField id="admin-reg-email" name="email" type="email" label="Email Address" icon="envelope" value={adminRegistration.email} onChange={updateAdminRegistration} required />
              <FormField id="admin-reg-mobile" name="mobile" type="tel" label="Mobile Number (Optional)" icon="phone" value={adminRegistration.mobile} onChange={updateAdminRegistration} />
              <FormField id="admin-reg-domain" name="requested_domain_code" as="select" label="Service Responsibility" icon="building-columns" value={adminRegistration.requested_domain_code} onChange={updateAdminRegistration} required>
                <option value="">Select service authority</option>
                {adminOptions.domains.map(domain => <option value={domain.code} key={domain.code}>{domain.name} — {domain.parent_authority}</option>)}
              </FormField>
              <FormField id="admin-reg-scope" name="requested_scope_level" as="select" label="Requested Jurisdiction" icon="map-location-dot" value={adminRegistration.requested_scope_level} onChange={updateAdminRegistration} required>
                <option value="central">Central authority — nationwide</option>
                <option value="division" disabled={selectedAdminDomain && !selectedAdminDomain.supports_division_scope}>Divisional authority — one division</option>
              </FormField>
              {adminRegistration.requested_scope_level === 'division' && (
                <FormField id="admin-reg-division" name="requested_division_id" as="select" label="Division" icon="location-dot" value={adminRegistration.requested_division_id} onChange={updateAdminRegistration} required>
                  <option value="">Select division</option>
                  {adminOptions.divisions.map(division => <option value={division.id} key={division.id}>{division.name} · {division.name_bn}</option>)}
                </FormField>
              )}
              <FormField id="admin-reg-note" name="access_request_note" as="textarea" rows="3" label="Official Role / Designation (Optional)" icon="briefcase" value={adminRegistration.access_request_note} onChange={updateAdminRegistration} placeholder="Department, office and designation for verification" />
              <FormField id="admin-reg-password" name="password" type="password" label="Password" icon="lock" minLength="6" value={adminRegistration.password} onChange={updateAdminRegistration} required />
              <FormField id="admin-reg-confirm" name="confirmPassword" type="password" label="Confirm Password" icon="check-circle" value={adminRegistration.confirmPassword} onChange={updateAdminRegistration} required />
              <button className="btn-submit admin-btn" disabled={submitting} type="submit"><span>{submitting ? 'Registering…' : 'Register as Admin'}</span><i className="fas fa-user-plus" /></button>
              <div className="admin-toggle"><span>Already have an account?</span><button className="link-button" onClick={() => setAdminMode('login')} type="button">Sign In <i className="fas fa-sign-in-alt" /></button></div>
            </form>
          )}
        </section>
      )}

      <div className="security-badge"><i className="fas fa-lock" /><span>Protected Government Portal</span><i className="fas fa-certificate" /></div>
    </VillageLoginShell>
  );
}
