import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Public demo accounts so visitors (e.g. recruiters) can try the app without signing up.
const DEMO_ACCOUNTS = {
  LANDLORD: { label: 'Try as a landlord', email: 'demo-landlord@example.com', password: 'password123' },
  TENANT: { label: 'Try as a tenant', email: 'demo-tenant@example.com', password: 'password123' },
};

const REPO_URL = 'https://github.com/Seshasai-Tunuguntla/landlord-maintenance-tracker';

export default function AuthLayout({ children }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loadingRole, setLoadingRole] = useState(null);
  const [error, setError] = useState('');

  async function tryDemo(role) {
    setError('');
    setLoadingRole(role);
    try {
      await login(DEMO_ACCOUNTS[role].email, DEMO_ACCOUNTS[role].password);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setLoadingRole(null);
    }
  }

  return (
    <div className="auth">
      <section className="auth-brand">
        <h2 className="auth-brand-title">Repairs, tracked from report to done.</h2>
        <p>
          Tenants report a problem with a photo. Landlords see what's urgent first and update progress as the work
          happens.
        </p>

        <div className="demo">
          <p className="demo-title">See it in action, no sign-up needed</p>
          <div className="demo-actions">
            {Object.entries(DEMO_ACCOUNTS).map(([role, account]) => (
              <button
                key={role}
                type="button"
                className="btn-demo"
                disabled={loadingRole !== null}
                onClick={() => tryDemo(role)}
              >
                {loadingRole === role ? 'Opening demo…' : account.label}
              </button>
            ))}
          </div>
          {loadingRole && <p className="demo-note">The free server can take up to a minute to wake up.</p>}
          {error && <p className="demo-error" role="alert">{error}</p>}
        </div>

        <p className="auth-stack">
          Built with React, Node.js/Express, PostgreSQL and Prisma.{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            See the code on GitHub
          </a>
        </p>
      </section>
      <div className="panel auth-panel">{children}</div>
    </div>
  );
}
