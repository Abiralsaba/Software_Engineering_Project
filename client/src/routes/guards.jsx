import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function CitizenGuard({ children }) {
  const { citizenToken } = useAuth();
  const location = useLocation();

  if (!citizenToken) {
    return <Navigate to="/index.html" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export function AdminGuard({ children }) {
  const { adminToken } = useAuth();
  if (!adminToken) return <Navigate to="/index.html#admin" replace />;
  return children;
}
