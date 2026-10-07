import { useEffect, useState } from 'react';
import { api } from '../api/client';
import RequestCard from '../components/RequestCard';
import Loading from '../components/Loading';

const PAGE_SIZE = 20;
const NO_FILTERS = { status: '', priority: '' };

const STATUS_FILTERS = [
  ['', 'All'],
  ['OPEN', 'Open'],
  ['IN_PROGRESS', 'In progress'],
  ['RESOLVED', 'Resolved'],
];
const PRIORITY_FILTERS = [
  ['', 'Any'],
  ['URGENT', 'Urgent'],
  ['HIGH', 'High'],
  ['MEDIUM', 'Medium'],
  ['LOW', 'Low'],
];

function summarize(summary, properties) {
  if (properties.length === 0) return 'Add your first property, then share its join code with your tenant.';
  if (!summary || summary.open === 0) return 'Nothing needs attention right now.';
  const openText = `${summary.open} open ${summary.open === 1 ? 'request' : 'requests'}`;
  return summary.urgent ? `${openText}, ${summary.urgent} urgent.` : `${openText}.`;
}

function FilterGroup({ label, name, options, value, onChange }) {
  return (
    <div className="filter-row">
      <span className="filter-label" id={`filter-${name}`}>
        {label}
      </span>
      <div className="segmented" role="group" aria-labelledby={`filter-${name}`}>
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue || 'all'}
            type="button"
            className="segment"
            aria-pressed={value === optionValue}
            onClick={() => onChange(optionValue)}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LandlordDashboard() {
  const [properties, setProperties] = useState([]);
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [address, setAddress] = useState('');
  const [unitName, setUnitName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchRequests = (activeFilters, pageToLoad) =>
    api.listRequests({ ...activeFilters, page: pageToLoad, pageSize: PAGE_SIZE });

  function showRequests(data, pageLoaded) {
    setRequests((current) => (pageLoaded === 1 ? data.requests : [...current, ...data.requests]));
    setTotal(data.total);
    setPage(pageLoaded);
    setSummary(data.summary);
  }

  async function loadRequests(activeFilters, pageToLoad = 1) {
    showRequests(await fetchRequests(activeFilters, pageToLoad), pageToLoad);
  }

  async function loadProperties() {
    const data = await api.listProperties();
    setProperties(data.properties);
  }

  useEffect(() => {
    Promise.all([api.listProperties(), fetchRequests(NO_FILTERS, 1)])
      .then(([propData, reqData]) => {
        setProperties(propData.properties);
        showRequests(reqData, 1);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  async function handleFilterChange(key, value) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setError('');
    try {
      await loadRequests(next);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleShowMore() {
    setLoadingMore(true);
    try {
      await loadRequests(filters, page + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleCreateProperty(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.createProperty({ address, unitName });
      setAddress('');
      setUnitName('');
      setMessage('Property added. Share its join code with your tenant.');
      await loadProperties();
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
      await loadRequests(filters);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!loaded) return <Loading />;

  const filtering = filters.status !== '' || filters.priority !== '';

  return (
    <div className="page">
      <header className="page-head">
        <h1>Repair requests</h1>
        <p className="page-sub">{summarize(summary, properties)}</p>
      </header>

      {error && <p className="flash flash-error" role="alert">{error}</p>}
      {message && <p className="flash flash-success" role="status">{message}</p>}

      <div className="layout layout-landlord">
        <section aria-label="Repair requests">
          {(total > 0 || filtering) && (
            <div className="filters">
              <FilterGroup
                label="Status"
                name="status"
                options={STATUS_FILTERS}
                value={filters.status}
                onChange={(v) => handleFilterChange('status', v)}
              />
              <FilterGroup
                label="Priority"
                name="priority"
                options={PRIORITY_FILTERS}
                value={filters.priority}
                onChange={(v) => handleFilterChange('priority', v)}
              />
            </div>
          )}

          {requests.length === 0 ? (
            <div className="empty">
              {filtering ? (
                <>
                  <p>No requests match these filters.</p>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      setFilters(NO_FILTERS);
                      loadRequests(NO_FILTERS).catch((err) => setError(err.message));
                    }}
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <p>No repair requests yet. When a tenant reports a problem, it shows up here.</p>
              )}
            </div>
          ) : (
            <>
              <ul className="ticket-list">
                {requests.map((r) => (
                  <RequestCard key={r.id} request={r} onStatusChange={handleStatusChange} />
                ))}
              </ul>
              {requests.length < total && (
                <button type="button" className="btn-more" onClick={handleShowMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : `Show more (${total - requests.length} left)`}
                </button>
              )}
            </>
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
