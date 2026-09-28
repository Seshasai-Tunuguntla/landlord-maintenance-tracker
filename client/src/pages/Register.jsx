import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { value: 'TENANT', title: "I'm a tenant", detail: 'Report problems in my home' },
  { value: 'LANDLORD', title: "I'm a landlord", detail: 'Track repairs across my properties' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('TENANT');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(name, email, password, role);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth">
      <div className="panel">
        <h1>Create an account</h1>
        <form onSubmit={handleSubmit} className="form">
          <fieldset className="role-picker">
            <legend className="visually-hidden">Account type</legend>
            {ROLES.map((r) => (
              <label key={r.value} className="role-option">
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={role === r.value}
                  onChange={() => setRole(r.value)}
                />
                <span className="role-option-body">
                  <strong>{r.title}</strong>
                  <span>{r.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
          <label className="field">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="field">
            <span>
              Password <span className="optional">(at least 8 characters)</span>
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
          {error && <p className="flash flash-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-block" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
