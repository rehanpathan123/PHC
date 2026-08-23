import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/Layout';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import AddPatientPage from './pages/AddPatientPage';
import MedicinePage from './pages/MedicinePage';
import MapPage from './pages/MapPage';
import RequestsPage from './pages/RequestsPage';
import InventoryPage from './pages/InventoryPage';
import OfflinePage from './pages/OfflinePage';

import './index.css';

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      } />

      <Route path="/patients" element={
        <ProtectedRoute>
          <PatientsPage />
        </ProtectedRoute>
      } />

      <Route path="/patients/new" element={
        <ProtectedRoute allowedRoles={['ASHA', 'OFFICER', 'ADMIN']}>
          <AddPatientPage />
        </ProtectedRoute>
      } />

      <Route path="/medicine" element={
        <ProtectedRoute>
          <MedicinePage />
        </ProtectedRoute>
      } />

      <Route path="/map" element={
        <ProtectedRoute>
          <MapPage />
        </ProtectedRoute>
      } />

      <Route path="/requests" element={
        <ProtectedRoute>
          <RequestsPage />
        </ProtectedRoute>
      } />

      <Route path="/inventory" element={
        <ProtectedRoute allowedRoles={['OFFICER', 'ADMIN']}>
          <InventoryPage />
        </ProtectedRoute>
      } />

      <Route path="/offline" element={
        <ProtectedRoute allowedRoles={['ASHA', 'OFFICER', 'ADMIN']}>
          <OfflinePage />
        </ProtectedRoute>
      } />

      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<App />);
