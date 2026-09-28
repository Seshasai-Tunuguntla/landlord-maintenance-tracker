import { useEffect, useState } from 'react';
import { api } from '../api/client';
import RequestCard from '../components/RequestCard';

function summarize(requests, properties) {
  if (properties.length === 0) return 'Add your first property, then share its join code with your tenant.';
  const open = requests.filter((r) => r.status !== 'RESOLVED');
  if (open.length === 0) return 'Nothing needs attention right now.';
  const urgent = open.filter((r) => r.priority === 'URGENT').length;
  const openText = `${open.length} open ${open.length === 1 ? 'request' : 'requests'}`;
  return urgent ? `${openText}, ${urgent} urgent.` : `${openText}.`;
}

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
      setMessage('Property added. Share its join code with your tenant.');
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
      setError('Could not copy automatically. Select the code and copy it manually.');
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
    <div className="page">
      <header className="page-head">
        <h1>Repair requests</h1>
        <p className="page-sub">{summarize(requests, properties)}</p>
      </header>

      {error && <p className="flash flash-error" role="alert">{error}</p>}
      {message && <p className="flash flash-success" role="status">{message}</p>}

      <div className="layout layout-landlord">
        <section aria-label="Repair requests">
          {requests.length === 0 ? (
            <div className="empty">
              <p>No repair requests yet. When a tenant reports a problem, it shows up here.</p>
            </div>
          ) : (
            <ul className="ticket-list">
              {requests.map((r) => (
                <RequestCard key={r.id} request={r} onStatusChange={handleStatusChange} />
              ))}
            </ul>
          )}
        </section>

        <aside className="side">
          <section className="panel">
            <h2>Properties</h2>
            {properties.length === 0 ? (
              <p className="muted">No properties yet.</p>
            ) : (
              <ul className="property-list">
                {properties.map((p) => (
                  <li key={p.id} className="property">
                    <p className="property-address">{p.address}</p>
                    {p.unitName && <p className="property-unit">{p.unitName}</p>}
                    <p className="property-tenants">
                      {p.tenants?.length
                        ? `Tenants: ${p.tenants.map((t) => t.name).join(', ')}`
                        : 'No tenants yet'}
                    </p>
                    <div className="key-tag">
                      <span className="key-tag-hole" aria-hidden="true" />
                      <span className="key-tag-label">Join code</span>
                      <code className="key-tag-code">{p.joinCode}</code>
                      <button type="button" className="key-tag-copy" onClick={() => handleCopy(p)}>
                        {copiedId === p.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>Add a property</h2>
            <form onSubmit={handleCreateProperty} className="form">
              <label className="field">
                Address
                <input value={address} onChange={(e) => setAddress(e.target.value)} required />
              </label>
              <label className="field">
                <span>
                  Unit name <span className="optional">(optional)</span>
                </span>
                <input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="e.g. Flat 2B" />
              </label>
              <button type="submit" className="btn">Add property</button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
