import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import RouteLoading from './RouteLoading.jsx';

export default function LegacyPageHandoff() {
  const location = useLocation();

  useEffect(() => {
    const legacyOrigin = import.meta.env.VITE_LEGACY_ORIGIN || 'http://localhost:3000';
    window.location.replace(`${legacyOrigin}${location.pathname}${location.search}${location.hash}`);
  }, [location]);

  return <RouteLoading label="Opening the rollback-compatible legacy page…" />;
}
