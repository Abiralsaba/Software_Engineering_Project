import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell, { AuthHeader, FormField } from '../../layouts/AuthShell.jsx';
import { authApi } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { alerts } from '../../utils/alerts.js';

const emptyAdminRegistration = {
  name: '', nid: '', email: '', mobile: '', password: '', confirmPassword: ''
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

  useEffect(() => {
    setAudience(location.hash === '#admin' ? 'admin' : 'citizen');
    setPendingNotice(false);
    setError('');
  }, [location.hash]);

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
      const data = await authApi.citizenLogin(citizen);
      setCitizenSession(data.token);
      await alerts.success('Login Successful!', 'Welcome to NationX.');
      navigate('/dashboard.html', { replace: true });
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
      await alerts.success('Welcome, Admin!', `Logged in as ${data.admin?.name || 'Administrator'}`);
      window.location.assign('/reports.html');
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
    setAdminRegistration(current => ({ ...current, [event.target.name]: event.target.value }));
  };

  return (
    <AuthShell>
      <AuthHeader admin={audience === 'admin'} />

      <div className="role-tabs" aria-label="Portal role">
        <button className={`role-tab ${audience === 'citizen' ? 'active' : ''}`} onClick={() => selectAudience('citizen')} type="button">
          <i className="fas fa-users" /><span>Citizen</span>
        </button>
        <button className={`role-tab ${audience === 'admin' ? 'active' : ''}`} onClick={() => selectAudience('admin')} type="button">
          <i className="fas fa-user-shield" /><span>Admin</span>
        </button>
      </div>

      {error && <div className="react-auth-error" role="alert">{error}</div>}

      {audience === 'citizen' ? (
        <section className="login-section active" aria-label="Citizen login">
          <form className="auth-form" onSubmit={submitCitizen}>
            <FormField id="citizen-email" type="email" label="Email Address" icon="envelope" placeholder="citizen@bangladesh.gov.bd" value={citizen.email} onChange={event => setCitizen({ ...citizen, email: event.target.value })} required />
            <FormField id="citizen-password" type="password" label="Password" icon="lock" placeholder="Enter your password" value={citizen.password} onChange={event => setCitizen({ ...citizen, password: event.target.value })} required />
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
              <FormField id="admin-reg-password" name="password" type="password" label="Password" icon="lock" minLength="6" value={adminRegistration.password} onChange={updateAdminRegistration} required />
              <FormField id="admin-reg-confirm" name="confirmPassword" type="password" label="Confirm Password" icon="check-circle" value={adminRegistration.confirmPassword} onChange={updateAdminRegistration} required />
              <button className="btn-submit admin-btn" disabled={submitting} type="submit"><span>{submitting ? 'Registering…' : 'Register as Admin'}</span><i className="fas fa-user-plus" /></button>
              <div className="admin-toggle"><span>Already have an account?</span><button className="link-button" onClick={() => setAdminMode('login')} type="button">Sign In <i className="fas fa-sign-in-alt" /></button></div>
            </form>
          )}
        </section>
      )}

      <div className="security-badge"><i className="fas fa-lock" /><span>Protected Government Portal</span><i className="fas fa-certificate" /></div>
    </AuthShell>
  );
}
