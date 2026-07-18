import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import ProtectedRoute from '@/routes/ProtectedRoute';

import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';
import Dashboard from '@/pages/dashboard/Dashboard';
import Settings from '@/pages/dashboard/Settings';
import NotesPage from '@/pages/notes/NotesPage';
import ProjectsPage from '@/pages/projects/ProjectsPage';
import ProjectDetail from '@/pages/projects/ProjectDetail';
import SnippetsPage from '@/pages/snippets/SnippetsPage';
import CollectionsPage from '@/pages/collections/CollectionsPage';
import PasswordVaultPage from '@/pages/vault/PasswordVaultPage';
import NotFound from '@/pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/snippets" element={<SnippetsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/vault" element={<PasswordVaultPage />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
