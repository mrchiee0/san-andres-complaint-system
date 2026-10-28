import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import { Toaster } from './components/ui/sonner';
import type { Role } from './types';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const QuickRegister = lazy(() => import('./pages/QuickRegister'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ComplaintList = lazy(() => import('./pages/ComplaintList'));
const ComplaintForm = lazy(() => import('./pages/ComplaintForm'));
const ComplaintDetail = lazy(() => import('./pages/ComplaintDetail'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const Reports = lazy(() => import('./pages/Reports'));
const Chat = lazy(() => import('./pages/Chat'));
const VerifiedAccounts = lazy(() => import('./pages/VerifiedAccounts'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const UserSettings = lazy(() => import('./pages/UserSettings'));
const Settlement = lazy(() => import('./pages/Settlement'));
const NoticeToAppear = lazy(() => import('./pages/NoticeToAppear'));
const CertificateToFileAction = lazy(() => import('./pages/CertificateToFileAction'));
const SanAndresMapPage = lazy(() => import('./pages/SanAndresMapPage'));
const BoundaryManagement = lazy(() => import('./pages/BoundaryManagement'));

import { useSettingsStore } from './store/useSettingsStore';

function RoleRoute({ children, allowedRoles = [] }: { children: React.ReactNode; allowedRoles?: Role[] }) {
  const { token, user, loading } = useAuth();
  const userRole = user?.role as Role | undefined;

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  if (allowedRoles.length > 0 && (!userRole || !allowedRoles.includes(userRole))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
}

function PrivateRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: Role[] }) {
  return <RoleRoute allowedRoles={allowedRoles}>{children}</RoleRoute>;
}

function ResidentRoute({ children }: { children: React.ReactNode }) {
  return <RoleRoute allowedRoles={['mamamayan']}>{children}</RoleRoute>;
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  return <RoleRoute allowedRoles={['admin', 'official']}>{children}</RoleRoute>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  return <RoleRoute allowedRoles={['admin']}>{children}</RoleRoute>;
}

export default function App() {
  const { fetchSettings } = useSettingsStore();

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" richColors />
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading page...</div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<QuickRegister />} />
            <Route path="/register/full" element={<Register />} />
            
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/complaints" element={<PrivateRoute><ComplaintList /></PrivateRoute>} />
            <Route path="/complaints/new" element={<ResidentRoute><ComplaintForm /></ResidentRoute>} />
            <Route path="/complaints/:id/edit" element={<ResidentRoute><ComplaintForm /></ResidentRoute>} />
            <Route path="/complaints/:id" element={<PrivateRoute><ComplaintDetail /></PrivateRoute>} />
            <Route path="/complaints/:complaintId/settlement/:id" element={<PrivateRoute><Settlement /></PrivateRoute>} />
            <Route path="/complaints/:id/cfa" element={<PrivateRoute><CertificateToFileAction /></PrivateRoute>} />
            <Route path="/reklamo" element={<PrivateRoute><ComplaintList /></PrivateRoute>} />
            <Route path="/reklamo/:id" element={<PrivateRoute><ComplaintDetail /></PrivateRoute>} />
            <Route path="/reklamo/:complaintId/kasunduan/:id" element={<PrivateRoute><Settlement /></PrivateRoute>} />
            <Route path="/mediation/:id/patawag" element={<PrivateRoute><NoticeToAppear /></PrivateRoute>} />
            <Route path="/mediation/:id/notice-to-appear" element={<PrivateRoute><NoticeToAppear /></PrivateRoute>} />
            <Route path="/reklamo/:id/cfa" element={<PrivateRoute><CertificateToFileAction /></PrivateRoute>} />
            <Route path="/calendar" element={<PrivateRoute><CalendarPage /></PrivateRoute>} />
            <Route path="/kalendaryo" element={<PrivateRoute><CalendarPage /></PrivateRoute>} />
            <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
            <Route path="/admin/accounts" element={<StaffRoute><VerifiedAccounts /></StaffRoute>} />
            <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
            <Route path="/ulat" element={<PrivateRoute><Reports /></PrivateRoute>} />
            <Route path="/barangay-map" element={<PrivateRoute><SanAndresMapPage /></PrivateRoute>} />
            <Route path="/barangay-master-list" element={<Navigate to="/barangay-map" replace />} />
            <Route path="/admin/boundaries" element={<AdminRoute><BoundaryManagement /></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
            <Route path="/settings" element={<ResidentRoute><UserSettings /></ResidentRoute>} />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
