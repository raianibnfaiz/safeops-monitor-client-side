import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { ToastContainer } from '@/components/common/ToastContainer';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Workers from '@/pages/Workers';
import WorkerDetails from '@/pages/WorkerDetails';
import Incidents from '@/pages/Incidents';
import Devices from '@/pages/Devices';
import Events from '@/pages/Events';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <ToastProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />

                {/* Protected routes */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/workers" element={<Workers />} />
                    <Route path="/workers/:id" element={<WorkerDetails />} />
                    <Route path="/incidents" element={<Incidents />} />
                    <Route path="/devices" element={<Devices />} />
                    <Route path="/events" element={<Events />} />
                  </Route>
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
              <ToastContainer />
            </ToastProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
