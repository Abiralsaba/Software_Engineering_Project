import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import LoginPage from '../auth/LoginPage.jsx';

const LandingPage = lazy(() => import('./LandingPage.jsx'));

export default function PublicEntry() {
  const location = useLocation();
  const wantsLogin = ['#signin', '#admin'].includes(location.hash) || Boolean(location.state?.from);
  // Guard redirects still enter authentication directly, not the public landing.
  if (wantsLogin) return <LoginPage />;
  return <Suspense fallback={<main style={{ padding: '3rem', background: '#F6F1E7', color: '#103D32', minHeight: '100vh' }}>NationX · A connected citizen experience</main>}><LandingPage /></Suspense>;
}
