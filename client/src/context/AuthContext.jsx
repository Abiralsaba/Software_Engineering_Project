import { createContext, useContext, useMemo, useState } from 'react';
import { sanitizeToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [citizenToken, setCitizenToken] = useState(() => sanitizeToken(localStorage.getItem('token')));
  const [adminToken, setAdminToken] = useState(() => sanitizeToken(localStorage.getItem('adminToken')));

  const value = useMemo(() => ({
    citizenToken,
    adminToken,
    setCitizenSession(token) {
      const cleanToken = sanitizeToken(token);
      localStorage.setItem('token', cleanToken);
      setCitizenToken(cleanToken);
    },
    clearCitizenSession() {
      localStorage.removeItem('token');
      setCitizenToken('');
    },
    setAdminSession(token, adminName) {
      const cleanToken = sanitizeToken(token);
      localStorage.setItem('adminToken', cleanToken);
      localStorage.setItem('adminName', adminName || 'Admin');
      setAdminToken(cleanToken);
    },
    clearAdminSession() {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminName');
      setAdminToken('');
    }
  }), [citizenToken, adminToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
