import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import PatientDashboard from './pages/PatientDashboard';
import DoctorSearch from './pages/DoctorSearch';
import DoctorProfile from './pages/DoctorProfile';
import BookAppointment from './pages/BookAppointment';
import LiveQueue from './pages/LiveQueue';
import PatientProfile from './pages/PatientProfile';

const DummyPage = ({ title }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 min-h-[60vh] flex items-center justify-center">
    <h2 className="text-2xl text-gray-400 font-medium">{title} Page Content</h2>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        <Route element={<Layout />}>
          <Route path="/patient-dashboard" element={<PatientDashboard />} />
          <Route path="/doctors" element={<DoctorSearch />} />
          <Route path="/doctors/:id" element={<DoctorProfile />} />
          <Route path="/book" element={<BookAppointment />} />
          <Route path="/queue" element={<LiveQueue />} />
          <Route path="/profile" element={<PatientProfile />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
