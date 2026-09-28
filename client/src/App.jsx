import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import TenantDashboard from './pages/TenantDashboard';
import LandlordDashboard from './pages/LandlordDashboard';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Dashboard() {
  const { user } = useAuth();
  return user.role === 'LANDLORD' ? <LandlordDashboard /> : <TenantDashboard />;
}

export default function App() {
  const { user, logout, loading } = useAuth();

  if (loading) return <p>Loading...</p>;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">Maintenance Tracker</h1>
        {user && (
          <div className="user-info">
            <span>
              {user.name} ({user.role})
            </span>
            <button onClick={logout}>Log out</button>
          </div>
        )}
      </header>

      <main className="content">
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
