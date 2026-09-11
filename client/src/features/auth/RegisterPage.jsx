import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell, { AuthHeader, FormField } from '../../layouts/AuthShell.jsx';
import { authApi, apiRequest } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { alerts } from '../../utils/alerts.js';

const initialForm = {
  username: '', nid: '', mobile: '', dob: '', gender: '', address: '',
  email: '', password: '', confirmPassword: ''
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setCitizenSession } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [applicant, setApplicant] = useState(false);

  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      await alerts.error('Passwords do not match');
      return;
    }
    if (!acceptedTerms) return;

    setSubmitting(true);
    setError('');
    try {
      const { confirmPassword, ...payload } = form;
      const data = applicant ? await apiRequest('/api/applicants/register', { method: 'POST', auth: false, body: { username: form.username, email: form.email, password: form.password, mobile: form.mobile } }) : await authApi.citizenRegister(payload);
      if (data.token) setCitizenSession(data.token);
      if (applicant) {
        navigate('/nid-applicant.html', { replace: true, state: { demoVerificationCode: data.demoVerificationCode } });
        return;
      }
      await alerts.success('Welcome, Citizen!', 'Registration successful. You are being logged in.');
      navigate('/dashboard.html', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
      await alerts.error(requestError.message, 'Registration Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell icons={['passport', 'id-card', 'user-shield', 'file-signature']}>
      <AuthHeader title="Citizen Registration" subtitle="Create your secure NationX identity" />
      <fieldset className="auth-form"><legend>Do you already have an NID?</legend>
        <label><input type="radio" name="identity-choice" checked={!applicant} onChange={() => setApplicant(false)} /> I already have an NID</label>
        <label><input type="radio" name="identity-choice" checked={applicant} onChange={() => setApplicant(true)} /> I don’t have an NID — Apply as a new applicant</label>
        {applicant && <p>Create a limited applicant account. You can apply for and track an NID; services requiring an NID remain locked. No NID number is assigned at registration.</p>}
      </fieldset>
      {error && <div className="react-auth-error" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={submit}>
        <div className="react-form-grid">
          <FormField id="register-name" name="username" label="Full Name" icon="user" value={form.username} onChange={update} required />
          {!applicant && <FormField id="register-nid" name="nid" label="NID Number" icon="id-card" value={form.nid} onChange={update} required />}
          <FormField id="register-mobile" name="mobile" type="tel" label="Mobile Number" icon="phone" value={form.mobile} onChange={update} required />
          {!applicant && <FormField id="register-dob" name="dob" type="date" label="Date of Birth" icon="calendar" value={form.dob} onChange={update} required />}
          {!applicant && <FormField id="register-gender" name="gender" as="select" label="Gender" icon="venus-mars" value={form.gender} onChange={update} required>
            <option value="">Select Gender</option><option>Male</option><option>Female</option><option>Other</option>
          </FormField>}
          <FormField id="register-email" name="email" type="email" label="Email Address" icon="envelope" value={form.email} onChange={update} required />
        </div>
        {!applicant && <FormField id="register-address" name="address" as="textarea" rows="3" label="Address" icon="location-dot" value={form.address} onChange={update} required />}
        <div className="react-form-grid">
          <FormField id="register-password" name="password" type="password" minLength={applicant ? 8 : 6} label="Password" icon="lock" value={form.password} onChange={update} required />
          <FormField id="register-confirm" name="confirmPassword" type="password" label="Confirm Password" icon="check-circle" value={form.confirmPassword} onChange={update} required />
        </div>
        <label className="terms-checkbox">
          <input type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} required />
          <span>I confirm that the supplied identity information is accurate.</span>
        </label>
        <button className="btn-submit" disabled={submitting} type="submit"><span>{submitting ? 'Creating Identity…' : applicant ? 'Create Applicant Account' : 'Create Citizen Account'}</span><i className="fas fa-user-plus" /></button>
      </form>
      <div className="auth-links"><span>Already registered?</span><Link to="/index.html">Back to Login</Link></div>
    </AuthShell>
  );
}
