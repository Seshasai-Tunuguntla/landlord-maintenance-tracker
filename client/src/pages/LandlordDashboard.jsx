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
      setMessage('Property created.');
      await loadAll();
    } catch (err) {
      setError(err.message);
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
        {properties.length === 0 && <p>No properties yet.</p>}
        <ul>
          {properties.map((p) => (
            <li key={p.id}>
              {p.address}
              {p.unitName ? ` — ${p.unitName}` : ''} — join code: <code>{p.joinCode}</code>
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
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
