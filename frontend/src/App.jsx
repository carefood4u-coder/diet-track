import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Nav from './components/Nav';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/AdminDashboard';
import AdminClientDetail from './pages/AdminClientDetail';
import ClientDashboard from './pages/ClientDashboard';

function HomeRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />;
}

export default function App() {
  const location = useLocation();
  const isClientDashboard = location.pathname.startsWith('/dashboard');

  return (
    <div className={`min-h-screen flex flex-col ${isClientDashboard ? 'diet-bg' : ''}`}>
      <Nav />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute role="ADMIN">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/clients/:id"
            element={
              <ProtectedRoute role="ADMIN">
                <AdminClientDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute role="USER">
                <ClientDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </main>
    </div>
  );
}
