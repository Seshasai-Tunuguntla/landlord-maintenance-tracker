import { useEffect, useState } from 'react';
import { api } from '../api/client';
import RequestCard from '../components/RequestCard';
import Loading from '../components/Loading';
import { PRIORITY_LABELS } from '../labels';

const SELECTABLE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
const PAGE_SIZE = 20;

export default function TenantDashboard() {
  const [properties, setProperties] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [requests, setRequests] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [photo, setPhoto] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadRequests(pageToLoad = 1) {
    const data = await api.listRequests({ page: pageToLoad, pageSize: PAGE_SIZE });
    setRequests((current) => (pageToLoad === 1 ? data.requests : [...current, ...data.requests]));
    setTotal(data.total);
    setPage(pageToLoad);
  }

  async function loadAll() {
    const [propData] = await Promise.all([api.listProperties(), loadRequests(1)]);
    setProperties(propData.properties);
  }

  async function handleShowMore() {
    setLoadingMore(true);
    try {
      await loadRequests(page + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadAll()
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.joinProperty(joinCode);
      setJoinCode('');
      setMessage('You joined your property. You can report problems now.');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmitRequest(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
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
      setFileInputKey((k) => k + 1);
      setMessage('Request sent to your landlord.');
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const property = properties[0];

  if (!loaded) return <Loading />;

  if (!property) {
    return (
      <div className="page page-narrow">
        <header className="page-head">
          <h1>Join your home</h1>
          <p className="page-sub">
            Ask your landlord for your unit's join code. It's 8 characters, like <code>A7D556BC</code>, and
            appears on their dashboard.
          </p>
        </header>
        {error && <p className="flash flash-error" role="alert">{error}</p>}
        <form onSubmit={handleJoin} className="panel join-form">
          <label className="field">
            Join code
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="A7D556BC"
              autoComplete="off"
              required
            />
          </label>
          <button type="submit" className="btn">Join</button>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Your repairs</h1>
        <p className="page-sub">
          {property.unitName ? `${property.unitName}, ` : ''}
          {property.address}
        </p>
      </header>

      {error && <p className="flash flash-error" role="alert">{error}</p>}
      {message && <p className="flash flash-success" role="status">{message}</p>}

      <div className="layout layout-tenant">
        <section className="panel">
          <h2>Report a problem</h2>
          <form onSubmit={handleSubmitRequest} className="form">
            <label className="field">
              What's wrong?
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Kitchen tap is leaking"
                required
              />
            </label>
            <label className="field">
              Details
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Where is it, when did it start, how bad is it?"
                rows={4}
                required
              />
            </label>
            <fieldset className="priority-picker">
              <legend>Priority</legend>
              <div className="priority-options">
                {SELECTABLE_PRIORITIES.map((p) => (
                  <label key={p} className={`priority-option priority-option-${p.toLowerCase()}`}>
                    <input
                      type="radio"
                      name="priority"
                      value={p}
                      checked={priority === p}
                      onChange={() => setPriority(p)}
                    />
                    <span>{PRIORITY_LABELS[p]}</span>
                  </label>
                ))}
              </div>
              <p className="hint">
                Mentions of things like "no heat", "gas smell" or "flood" are marked Urgent automatically.
              </p>
            </fieldset>
            <label className="field">
              <span>
                Photo <span className="optional">(optional, JPEG, PNG, WebP or GIF, up to 5MB)</span>
              </span>
              <input
                key={fileInputKey}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => setPhoto(e.target.files[0] || null)}
              />
            </label>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send request'}
            </button>
          </form>
        </section>

        <section aria-label="Your requests">
          {requests.length === 0 ? (
            <div className="empty">
              <p>Nothing reported yet. Use the form to tell your landlord about a problem.</p>
            </div>
          ) : (
            <>
              <ul className="ticket-list">
                {requests.map((r) => (
                  <RequestCard key={r.id} request={r} />
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
      </div>
    </div>
  );
}
