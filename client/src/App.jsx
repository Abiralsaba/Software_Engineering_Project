import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RouteLoading from './components/RouteLoading.jsx';
import PublicEntry from './features/landing/PublicEntry.jsx';
import RegisterPage from './features/auth/RegisterPage.jsx';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';
import ContactPage from './features/contact/ContactPage.jsx';
import DocumentsPage from './features/documents/DocumentsPage.jsx';
import EventsPage from './features/events/EventsPage.jsx';
import HistoryPage from './features/history/HistoryPage.jsx';
import MarketPage from './features/market/MarketPage.jsx';
import ProfilePage from './features/profile/ProfilePage.jsx';
import { AdminGuard, CitizenGuard } from './routes/guards.jsx';

const CommunityPage = lazy(() => import('./features/community/CommunityPage.jsx'));
const AdmissionPage = lazy(() => import('./features/admission/AdmissionPage.jsx'));
const ApplyPage = lazy(() => import('./features/admission/ApplyPage.jsx'));
const AdminNidPage = lazy(() => import('./features/admin/AdminNidPage.jsx'));
const AdminPassportPage = lazy(() => import('./features/admin/AdminPassportPage.jsx'));
const AdminHealthPage = lazy(() => import('./features/admin/AdminHealthPage.jsx'));
const AdminWaterPage = lazy(() => import('./features/admin/AdminWaterPage.jsx'));
const AdminReportsPage = lazy(() => import('./features/admin/AdminReportsPage.jsx'));
const AgriculturePage = lazy(() => import('./features/services/AgriculturePage.jsx'));
const EducationPage = lazy(() => import('./features/services/EducationPage.jsx'));
const HealthPage = lazy(() => import('./features/services/HealthPage.jsx'));
const LandPage = lazy(() => import('./features/services/LandPage.jsx'));
const NidPage = lazy(() => import('./features/services/NidPage.jsx'));
const PassportPage = lazy(() => import('./features/services/PassportPage.jsx'));
const ShopPage = lazy(() => import('./features/shop/ShopPage.jsx'));
const TaxPage = lazy(() => import('./features/services/TaxPage.jsx'));
const TodoPage = lazy(() => import('./features/todo/TodoPage.jsx'));
const WaterPage = lazy(() => import('./features/services/WaterPage.jsx'));

export default function App() {
  return (
    <Suspense fallback={<RouteLoading label="Loading NationX page…" />}><Routes>
      <Route path="/" element={<PublicEntry />} />
      <Route path="/index.html" element={<PublicEntry />} />
      <Route path="/register.html" element={<RegisterPage />} />
      <Route path="/forgot-password.html" element={<ForgotPasswordPage />} />
      <Route path="/admin-login.html" element={<Navigate to="/index.html#admin" replace />} />
      <Route path="/dashboard.html" element={<CitizenGuard><DashboardPage /></CitizenGuard>} />
      <Route path="/profile.html" element={<CitizenGuard><ProfilePage /></CitizenGuard>} />
      <Route path="/documents.html" element={<CitizenGuard><DocumentsPage /></CitizenGuard>} />
      <Route path="/history.html" element={<CitizenGuard><HistoryPage /></CitizenGuard>} />
      <Route path="/events.html" element={<CitizenGuard><EventsPage /></CitizenGuard>} />
      <Route path="/contact.html" element={<CitizenGuard><ContactPage /></CitizenGuard>} />
      <Route path="/market.html" element={<CitizenGuard><MarketPage /></CitizenGuard>} />
      <Route path="/todo.html" element={<CitizenGuard><TodoPage /></CitizenGuard>} />
      <Route path="/community.html" element={<CitizenGuard><CommunityPage /></CitizenGuard>} />
      <Route path="/shop.html" element={<CitizenGuard><ShopPage /></CitizenGuard>} />
      <Route path="/health.html" element={<CitizenGuard><HealthPage /></CitizenGuard>} />
      <Route path="/water.html" element={<CitizenGuard><WaterPage /></CitizenGuard>} />
      <Route path="/tax.html" element={<CitizenGuard><TaxPage /></CitizenGuard>} />
      <Route path="/education.html" element={<CitizenGuard><EducationPage /></CitizenGuard>} />
      <Route path="/land.html" element={<CitizenGuard><LandPage /></CitizenGuard>} />
      <Route path="/agriculture.html" element={<CitizenGuard><AgriculturePage /></CitizenGuard>} />
      <Route path="/nid.html" element={<CitizenGuard><NidPage /></CitizenGuard>} />
      <Route path="/passport.html" element={<CitizenGuard><PassportPage /></CitizenGuard>} />

      <Route path="/admission.html" element={<AdmissionPage />} />
      <Route path="/apply.html" element={<ApplyPage />} />
      <Route path="/admin-nid.html" element={<AdminGuard><AdminNidPage /></AdminGuard>} />
      <Route path="/admin-passport.html" element={<AdminGuard><AdminPassportPage /></AdminGuard>} />
      <Route path="/admin-health.html" element={<AdminGuard><AdminHealthPage /></AdminGuard>} />
      <Route path="/admin-water.html" element={<AdminGuard><AdminWaterPage /></AdminGuard>} />
      <Route path="/reports.html" element={<AdminGuard><AdminReportsPage /></AdminGuard>} />

      <Route path="*" element={<Navigate to="/index.html" replace />} />
    </Routes></Suspense>
  );
}
