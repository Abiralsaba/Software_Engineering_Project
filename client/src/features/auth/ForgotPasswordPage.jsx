import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStylesheets } from '../../hooks/useStylesheets.js';
import { authApi } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';

export default function ForgotPasswordPage() {
  useStylesheets(['/css/style.css']);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [identity, setIdentity] = useState({ email: '', nid: '' });
  const [verification, setVerification] = useState({ otp: '', newPassword: '' });
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function sendOtp(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await authApi.sendResetOtp(identity);
      setPreviewUrl(data.previewUrl || '');
      setStep(2);
      await alerts.success('Code Sent!', 'Use the six-digit code to reset your password.');
    } catch (requestError) {
      setError(requestError.message);
      await alerts.error(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await authApi.verifyResetOtp({ ...identity, ...verification });
      await alerts.success('Password Changed', 'Please sign in with your new password.');
      navigate('/index.html', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
      await alerts.error(requestError.message, 'Verification Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="bg-shape shape-1" /><div className="bg-shape shape-2" />
      <div className="container react-reset-container">
        <div className="auth-card">
          <div className="logo-area"><i className="fas fa-lock-open fa-3x" /><h1>Reset Password</h1><p>2-Step Verification</p></div>
          {error && <div className="react-auth-error" role="alert">{error}</div>}
          {step === 1 ? (
            <form onSubmit={sendOtp}>
              <div className="form-group"><label htmlFor="reset-email">Email Address</label><input id="reset-email" className="form-control" type="email" value={identity.email} onChange={event => setIdentity({ ...identity, email: event.target.value })} required /></div>
              <div className="form-group"><label htmlFor="reset-nid">NID Number</label><input id="reset-nid" className="form-control" value={identity.nid} onChange={event => setIdentity({ ...identity, nid: event.target.value })} required /></div>
              <button className="btn-primary" disabled={submitting} type="submit">{submitting ? 'Sending…' : 'Send Secret Code'}</button>
            </form>
          ) : (
            <form onSubmit={verifyOtp}>
              {previewUrl && <p className="react-preview-link"><a href={previewUrl} target="_blank" rel="noreferrer">Open the Ethereal test message for this demo OTP</a></p>}
              <div className="form-group"><label htmlFor="reset-otp">Secret Code (OTP)</label><input id="reset-otp" className="form-control" inputMode="numeric" minLength="6" maxLength="6" value={verification.otp} onChange={event => setVerification({ ...verification, otp: event.target.value })} required /></div>
              <div className="form-group"><label htmlFor="reset-password">New Password</label><input id="reset-password" className="form-control" type="password" minLength="6" value={verification.newPassword} onChange={event => setVerification({ ...verification, newPassword: event.target.value })} required /></div>
              <button className="btn-primary" disabled={submitting} type="submit">{submitting ? 'Verifying…' : 'Verify & Change Password'}</button>
            </form>
          )}
          <div className="auth-links"><Link to="/index.html">Back to Login</Link></div>
        </div>
      </div>
    </>
  );
}
