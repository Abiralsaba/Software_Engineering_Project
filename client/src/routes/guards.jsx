import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, isApplicantToken } from '../context/AuthContext.jsx';

export function CitizenGuard({ children }) {
  const { citizenToken } = useAuth();
  const location = useLocation();

  if (!citizenToken) {
    return <Navigate to="/index.html" replace state={{ from: location.pathname }} />;
  }
  if (isApplicantToken(citizenToken)) return <Navigate to={`/nid-applicant.html?blocked=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

export function AdminGuard({ children }) {
  const { adminToken } = useAuth();
  if (!adminToken) return <Navigate to="/index.html#admin" replace />;
  return children;
}
