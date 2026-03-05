import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import PatientDashboard from './pages/PatientDashboard';
import DoctorSearch from './pages/DoctorSearch';
import DoctorProfile from './pages/DoctorProfile';
import BookAppointment from './pages/BookAppointment';
import LiveQueue from './pages/LiveQueue';
import PatientProfile from './pages/PatientProfile';
import DoctorDashboard from './pages/DoctorDashboard';
import DoctorProfileEdit from './pages/DoctorProfileEdit';
import DoctorSchedule from './pages/DoctorSchedule';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminAppointments from './pages/AdminAppointments';
import Register from './pages/Register';
import VirtualWaitingRoom from './pages/VirtualWaitingRoom'; // Issue #39

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
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Patient routes */}
          <Route element={<ProtectedRoute allowedRoles={['PATIENT']}><Layout /></ProtectedRoute>}>
            <Route path="/patient-dashboard" element={<PatientDashboard />} />
            <Route path="/doctors" element={<DoctorSearch />} />
            <Route path="/doctors/:id" element={<DoctorProfile />} />
            <Route path="/book" element={<BookAppointment />} />
            <Route path="/queue" element={<LiveQueue />} />
            <Route path="/profile" element={<PatientProfile />} />
            <Route path="/virtual-waiting/:appointmentId" element={<VirtualWaitingRoom />} />
          </Route>

          {/* Doctor routes */}
          <Route element={<ProtectedRoute allowedRoles={['DOCTOR']}><Layout /></ProtectedRoute>}>
            <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
            <Route path="/doctor-profile" element={<DoctorProfileEdit />} />
            <Route path="/doctor-schedule" element={<DoctorSchedule />} />
          </Route>

          {/* Admin routes */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']}><Layout /></ProtectedRoute>}>
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/admin-users" element={<AdminUsers />} />
            <Route path="/admin-appointments" element={<AdminAppointments />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
