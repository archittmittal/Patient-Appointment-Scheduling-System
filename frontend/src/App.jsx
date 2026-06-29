import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';

// ── Lazy-loaded route pages ──────────────────────────────────────────────────
// Each page is code-split into its own chunk and loaded on demand.  This
// keeps the initial bundle small (core router + auth + layout only).
const Login           = React.lazy(() => import('./pages/Login'));
const Register        = React.lazy(() => import('./pages/Register'));
const ForgotPassword  = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword   = React.lazy(() => import('./pages/ResetPassword'));

// Public / shared
const DoctorSearch     = React.lazy(() => import('./pages/DoctorSearch'));
const DoctorProfile    = React.lazy(() => import('./pages/DoctorProfile'));
const BookAppointment  = React.lazy(() => import('./pages/BookAppointment'));

// Patient
const PatientDashboard    = React.lazy(() => import('./pages/PatientDashboard'));
const VitalsHub            = React.lazy(() => import('./pages/VitalsHub'));
const PatientPrescriptions = React.lazy(() => import('./pages/PatientPrescriptions'));
const LiveQueue            = React.lazy(() => import('./pages/LiveQueue'));
const PatientProfile       = React.lazy(() => import('./pages/PatientProfile'));
const NotificationSettings = React.lazy(() => import('./pages/NotificationSettings'));
const WalkinRegistration    = React.lazy(() => import('./pages/WalkinRegistration'));
const MultiDoctorJourney   = React.lazy(() => import('./pages/MultiDoctorJourney'));
const FeedbackAnalytics     = React.lazy(() => import('./pages/FeedbackAnalytics'));
const PatientInsurance     = React.lazy(() => import('./pages/PatientInsurance'));
const SymptomChecker       = React.lazy(() => import('./pages/SymptomChecker'));
const Messages             = React.lazy(() => import('./pages/Messages'));

// Doctor
const DoctorDashboard    = React.lazy(() => import('./pages/DoctorDashboard'));
const DoctorProfileEdit  = React.lazy(() => import('./pages/DoctorProfileEdit'));
const DoctorSchedule      = React.lazy(() => import('./pages/DoctorSchedule'));
const DoctorAnalytics    = React.lazy(() => import('./pages/DoctorAnalytics'));

// Admin
const AdminDashboard    = React.lazy(() => import('./pages/AdminDashboard'));
const AdminUsers        = React.lazy(() => import('./pages/AdminUsers'));
const AdminAppointments = React.lazy(() => import('./pages/AdminAppointments'));
const InsurancePortal   = React.lazy(() => import('./pages/InsurancePortal'));
const AdminAnalytics    = React.lazy(() => import('./pages/AdminAnalytics'));

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'PATIENT') return <Navigate to="/patient-dashboard" replace />;
  if (user.role === 'DOCTOR') return <Navigate to="/doctor-dashboard" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin-dashboard" replace />;
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
          <Router>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Public/Shared routes that use Layout but don't strictly require login */}
            <Route element={<Layout />}>
              <Route path="/doctors" element={<DoctorSearch />} />
              <Route path="/doctors/:id" element={<DoctorProfile />} />
              <Route path="/book" element={<BookAppointment />} />
            </Route>

            {/* Patient routes */}
            <Route element={<ProtectedRoute allowedRoles={['PATIENT']}><Layout /></ProtectedRoute>}>
              <Route path="/patient-dashboard" element={<PatientDashboard />} />
              <Route path="/vitals" element={<VitalsHub />} />
              <Route path="/prescriptions" element={<PatientPrescriptions />} />
              <Route path="/queue" element={<LiveQueue />} />
              <Route path="/profile" element={<PatientProfile />} />
              <Route path="/notifications/settings" element={<NotificationSettings />} />
              {/* /virtual-waiting redirects to live-queue — VirtualWaitingRoom removed, patients track via LiveQueue */}
              <Route path="/virtual-waiting/:appointmentId" element={<Navigate to="/queue" replace />} />
              <Route path="/walkin" element={<WalkinRegistration />} />
              <Route path="/multi-doctor" element={<MultiDoctorJourney />} />
              <Route path="/feedback" element={<FeedbackAnalytics />} />
              <Route path="/insurance" element={<PatientInsurance />} />
              <Route path="/symptom-checker" element={<SymptomChecker />} />
              <Route path="/messages" element={<Messages />} />
            </Route>

            {/* Doctor routes */}
            <Route element={<ProtectedRoute allowedRoles={['DOCTOR']}><Layout /></ProtectedRoute>}>
              <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
              <Route path="/doctor-profile" element={<DoctorProfileEdit />} />
              <Route path="/doctor-schedule" element={<DoctorSchedule />} />
              <Route path="/notifications/settings" element={<NotificationSettings />} />
              <Route path="/doctor-feedback" element={<FeedbackAnalytics />} />
              <Route path="/doctor-analytics" element={<DoctorAnalytics />} />
              <Route path="/messages" element={<Messages />} />
            </Route>

            {/* Admin routes */}
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']}><Layout /></ProtectedRoute>}>
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
              <Route path="/admin-users" element={<AdminUsers />} />
              <Route path="/admin-appointments" element={<AdminAppointments />} />
              <Route path="/admin/insurance" element={<InsurancePortal />} />
              <Route path="/notifications/settings" element={<NotificationSettings />} />
              <Route path="/admin-analytics" element={<AdminAnalytics />} />
            </Route>

            {/* Catch-all redirect to root */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Router>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
