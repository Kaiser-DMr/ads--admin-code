import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './utils/auth';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import PageRouteFallback from './components/PageRouteFallback';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const Creatives = lazy(() => import('./pages/Creatives'));
const Reports = lazy(() => import('./pages/Reports'));
const Users = lazy(() => import('./pages/Users'));
const PlatformConnections = lazy(() => import('./pages/PlatformConnections'));

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function withRouteFallback(element) {
  return <Suspense fallback={<PageRouteFallback />}>{element}</Suspense>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={withRouteFallback(<Dashboard />)} />
            <Route path="campaigns" element={withRouteFallback(<Campaigns />)} />
            <Route path="creatives" element={withRouteFallback(<Creatives />)} />
            <Route path="reports" element={withRouteFallback(<Reports />)} />
            <Route path="platform-connections" element={withRouteFallback(<PlatformConnections />)} />
            <Route path="users" element={withRouteFallback(<Users />)} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
