import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function TenantDashboard() {
  const [properties, setProperties] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [requests, setRequests] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [photo, setPhoto] = useState(null);
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

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.joinProperty(joinCode);
      setJoinCode('');
      setMessage('Joined property successfully.');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmitRequest(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('priority', priority);
      if (photo) formData.append('photo', photo);

      await api.createRequest(formData);
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setPhoto(null);
      setMessage('Request submitted.');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  const hasProperty = properties.length > 0;

  return (
    <div>
      <h1>Tenant Dashboard</h1>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {!hasProperty && (
        <section className="card">
          <h2>Join your property</h2>
          <p>Ask your landlord for the join code for your unit.</p>
          <form onSubmit={handleJoin}>
            <input
              placeholder="Join code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
            />
            <button type="submit">Join</button>
          </form>
        </section>
      )}

      {hasProperty && (
        <>
          <section className="card">
            <h2>Your property</h2>
            <p>
              {properties[0].address}
              {properties[0].unitName ? ` — ${properties[0].unitName}` : ''}
            </p>
          </section>

          <section className="card">
            <h2>Submit a maintenance request</h2>
            <form onSubmit={handleSubmitRequest}>
              <label>
                Title
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label>
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                />
              </label>
              <label>
                Priority
                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
              <p className="hint">
                Requests mentioning things like "no heat", "gas smell", or "flood" are
                automatically marked Urgent regardless of the priority you pick.
              </p>
              <label>
                Photo (optional)
                <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
              </label>
              <button type="submit">Submit request</button>
            </form>
          </section>

          <section className="card">
            <h2>Your requests</h2>
            {requests.length === 0 && <p>No requests yet.</p>}
            <ul className="request-list">
              {requests.map((r) => (
                <li key={r.id} className={`request-item priority-${r.priority.toLowerCase()}`}>
                  <div className="request-header">
                    <strong>{r.title}</strong>
                    <span className="badge">{r.priority}</span>
                    <span className="badge status">{r.status.replace('_', ' ')}</span>
                  </div>
                  <p>{r.description}</p>
                  {r.photoUrl && <img src={r.photoUrl} alt={r.title} className="request-photo" />}
                  <ul className="status-history">
                    {r.statusHistory.map((h) => (
                      <li key={h.id}>
                        {h.status.replace('_', ' ')} by {h.changedBy.name} (
                        {h.changedBy.role.toLowerCase()}) —{' '}
                        {new Date(h.changedAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
