import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/useAuth';
import Login from './pages/Login';
import Register from './pages/Register';
import TenantDashboard from './pages/TenantDashboard';
import LandlordDashboard from './pages/LandlordDashboard';
import Loading from './components/Loading';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Dashboard() {
  const { user } = useAuth();
  return user.role === 'LANDLORD' ? <LandlordDashboard /> : <TenantDashboard />;
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="brand-icon">
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <WrenchIcon />
          <span>Maintenance Tracker</span>
        </div>
        {user && (
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="role-pill">{user.role === 'LANDLORD' ? 'Landlord' : 'Tenant'}</span>
            <button type="button" className="btn-ghost" onClick={logout}>
              Log out
            </button>
          </div>
        )}
      </header>

      <main className="content">
        {/* Login and sign-up render at once instead of waiting for the "who's logged in?" check,
            which can take up to a minute if the free API is asleep. Only the dashboard waits. */}
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
