import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { useAuth } from './hooks/useAuth';
import { Dashboard } from './pages/Dashboard';
import { Diagnostics } from './pages/Diagnostics';
import { Editor } from './pages/Editor';
import { Login } from './pages/Login';
import { Settings } from './pages/Settings';
import { Setup } from './pages/Setup';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, needsSetup } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function SetupRedirect() {
  const { needsSetup, loading } = useAuth();
  const location = useLocation();

  if (!loading && needsSetup && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  return null;
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="text-5xl font-semibold text-fg">404</p>
      <p className="text-sm text-fg-muted">This page doesn&apos;t exist or was moved.</p>
      <Link
        to="/"
        className="px-4 py-2 rounded-md bg-primary text-primary-fg text-sm font-medium hover:bg-primary-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SetupRedirect />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/setup"
          element={
            <PublicRoute>
              <Setup />
            </PublicRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor/:libraryId" element={<Editor />} />
          <Route path="/editor/:libraryId/*" element={<Editor />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
