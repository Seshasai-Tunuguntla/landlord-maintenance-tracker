import { useEffect, useState } from 'react';
import { api } from '../api/client';

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];

export default function LandlordDashboard() {
  const [properties, setProperties] = useState([]);
  const [requests, setRequests] = useState([]);
  const [address, setAddress] = useState('');
  const [unitName, setUnitName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  async function loadAll() {
    const [propData, reqData] = await Promise.all([api.listProperties(), api.listRequests()]);
    setProperties(propData.properties);
    setRequests(reqData.requests);
  }

  useEffect(() => {
    loadAll().catch((err) => setError(err.message));
  }, []);

  async function handleCreateProperty(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.createProperty({ address, unitName });
      setAddress('');
      setUnitName('');
      setMessage('Property created. Share its join code below with your tenant.');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCopy(property) {
    try {
      await navigator.clipboard.writeText(property.joinCode);
      setCopiedId(property.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('Could not copy automatically — select the code and copy it manually.');
    }
  }

  async function handleStatusChange(id, status) {
    setError('');
    try {
      await api.updateRequestStatus(id, status);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Landlord Dashboard</h1>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <section className="card">
        <h2>Add a property</h2>
        <form onSubmit={handleCreateProperty}>
          <label>
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} required />
          </label>
          <label>
            Unit name (optional)
            <input value={unitName} onChange={(e) => setUnitName(e.target.value)} />
          </label>
          <button type="submit">Add property</button>
        </form>
      </section>

      <section className="card">
        <h2>Your properties</h2>
        {properties.length === 0 && <p>No properties yet. Add one above to get a join code.</p>}
        <ul className="property-list">
          {properties.map((p) => (
            <li key={p.id} className="property-item">
              <div>
                <strong>{p.address}</strong>
                {p.unitName && <span className="meta"> — {p.unitName}</span>}
                <p className="meta">
                  {p.tenants?.length
                    ? `Tenants: ${p.tenants.map((t) => t.name).join(', ')}`
                    : 'No tenants yet'}
                </p>
              </div>
              <div className="join-code-box">
                <span className="join-code-label">Tenant join code</span>
                <code className="join-code">{p.joinCode}</code>
                <button type="button" onClick={() => handleCopy(p)}>
                  {copiedId === p.id ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Maintenance requests</h2>
        {requests.length === 0 && <p>No requests yet.</p>}
        <ul className="request-list">
          {requests.map((r) => (
            <li key={r.id} className={`request-item priority-${r.priority.toLowerCase()}`}>
              <div className="request-header">
                <strong>{r.title}</strong>
                <span className="badge">{r.priority}</span>
              </div>
              <p>{r.description}</p>
              <p className="meta">
                {r.property.address}
                {r.property.unitName ? ` — ${r.property.unitName}` : ''} · reported by {r.tenant.name}
              </p>
              {r.photoUrl && <img src={r.photoUrl} alt={r.title} className="request-photo" />}
              <label>
                Status
                <select value={r.status} onChange={(e) => handleStatusChange(r.id, e.target.value)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <ul className="status-history">
                {r.statusHistory.map((h) => (
                  <li key={h.id}>
                    {h.status.replace('_', ' ')} by {h.changedBy.name} (
                    {h.changedBy.role.toLowerCase()}) — {new Date(h.changedAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
