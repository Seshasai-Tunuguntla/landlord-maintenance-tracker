import { useEffect, useState } from 'react';
import { api } from '../api/client';
import RequestCard from '../components/RequestCard';
import Loading from '../components/Loading';
import { PRIORITY_LABELS } from '../labels';

const SELECTABLE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
const PAGE_SIZE = 20;
// Mirrors the server's rules so a bad file is caught before a slow upload.
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export default function TenantDashboard() {
  const [properties, setProperties] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [requests, setRequests] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [photo, setPhoto] = useState(null); // { file, previewUrl }
  const [photoError, setPhotoError] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  function showRequests(data, pageLoaded) {
    setRequests((current) => (pageLoaded === 1 ? data.requests : [...current, ...data.requests]));
    setTotal(data.total);
    setPage(pageLoaded);
  }

  async function loadRequests(pageToLoad = 1) {
    showRequests(await api.listRequests({ page: pageToLoad, pageSize: PAGE_SIZE }), pageToLoad);
  }

  function fetchAll() {
    return Promise.all([api.listProperties(), api.listRequests({ page: 1, pageSize: PAGE_SIZE })]);
  }

  function showAll([propData, reqData]) {
    setProperties(propData.properties);
    showRequests(reqData, 1);
  }

  async function loadAll() {
    showAll(await fetchAll());
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
    fetchAll()
      .then(showAll)
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  // Free the preview image's memory when the photo changes or the page closes.
  useEffect(() => () => photo && URL.revokeObjectURL(photo.previewUrl), [photo]);

  function clearPhoto() {
    setPhoto(null);
    setFileInputKey((k) => k + 1);
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    setPhotoError('');
    if (!file) return setPhoto(null);

    if (!PHOTO_TYPES.includes(file.type)) {
      setPhotoError('That file type isn’t supported. Choose a JPEG, PNG, WebP or GIF photo.');
      return clearPhoto();
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError(`That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. Photos can be up to 5 MB.`);
      return clearPhoto();
    }
    setPhoto({ file, previewUrl: URL.createObjectURL(file) });
  }

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
      if (photo) formData.append('photo', photo.file);

      await api.createRequest(formData);
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      clearPhoto();
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
                accept={PHOTO_TYPES.join(',')}
                onChange={handlePhotoChange}
                aria-describedby={photoError ? 'photo-error' : undefined}
              />
            </label>
            {photoError && (
              <p className="field-error" id="photo-error" role="alert">
                {photoError}
              </p>
            )}
            {photo && (
              <div className="photo-preview">
                <img src={photo.previewUrl} alt="The photo you chose" />
                <button type="button" className="btn-link" onClick={clearPhoto}>
                  Remove photo
                </button>
              </div>
            )}
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
