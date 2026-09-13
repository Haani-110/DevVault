import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import ProtectedRoute from '@/routes/ProtectedRoute';
import Login from '@/pages/auth/Login';

/**
 * Every page is a separate chunk, loaded when its route is visited.
 *
 * The pages are not small: Notes pulls in a markdown editor, Snippets and the
 * project detail view pull in Monaco, the dashboard pulls in a charting
 * library. Loaded eagerly, all of that arrived before the sign-in form could
 * paint (the main bundle was ~660 kB gzipped). Lazy here, split by route: the
 * Suspense boundaries live in the two layouts, so the shell and sidebar stay on
 * screen while a page downloads, and `RouteBoundary` in `main.tsx` catches the
 * one failure mode this introduces (a chunk that 404s after a deploy).
 *
 * `Login` is deliberately eager — it is the first thing a signed-out visitor
 * needs, and making it wait for a round trip would only slow the common case.
 */
const Register = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const OAuthCallback = lazy(() => import('@/pages/auth/OAuthCallback'));
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'));
const Settings = lazy(() => import('@/pages/dashboard/Settings'));
const NotesPage = lazy(() => import('@/pages/notes/NotesPage'));
const ProjectsPage = lazy(() => import('@/pages/projects/ProjectsPage'));
const ProjectDetail = lazy(() => import('@/pages/projects/ProjectDetail'));
const SnippetsPage = lazy(() => import('@/pages/snippets/SnippetsPage'));
const CollectionsPage = lazy(() => import('@/pages/collections/CollectionsPage'));
const NotFound = lazy(() => import('@/pages/NotFound'));

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
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="/auth/callback" element={<OAuthCallback />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
