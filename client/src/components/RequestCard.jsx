import { PRIORITY_LABELS, STATUSES, STATUS_LABELS, formatDate } from '../labels';

// Passing onStatusChange switches the card to the landlord view (location, tenant, status buttons).
export default function RequestCard({ request: r, onStatusChange }) {
  const isLandlordView = Boolean(onStatusChange);
  const priority = r.priority.toLowerCase();
  const status = r.status.toLowerCase();

  return (
    <li className={`ticket priority-${priority} status-${status}`}>
      <div className="ticket-head">
        <h3 className="ticket-title">{r.title}</h3>
        <div className="chips">
          <span className={`chip chip-priority-${priority}`}>{PRIORITY_LABELS[r.priority]}</span>
          {!isLandlordView && <span className={`chip chip-status-${status}`}>{STATUS_LABELS[r.status]}</span>}
        </div>
      </div>

      <p className="ticket-desc">{r.description}</p>

      {isLandlordView && (
        <p className="ticket-meta">
          {r.property.unitName ? `${r.property.unitName}, ` : ''}
          {r.property.address}. Reported by {r.tenant.name}.
        </p>
      )}

      {r.photoUrl && (
        <a href={r.photoUrl} target="_blank" rel="noreferrer" className="ticket-photo-link">
          <img src={r.photoUrl} alt={`Photo for ${r.title}`} className="ticket-photo" />
        </a>
      )}

      {isLandlordView && (
        <div className="status-control" role="group" aria-label={`Status of ${r.title}`}>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`status-option status-option-${s.toLowerCase()}`}
              aria-pressed={r.status === s}
              onClick={() => r.status !== s && onStatusChange(r.id, s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      <ol className="timeline" aria-label="Status history">
        {r.statusHistory.map((h) => (
          <li key={h.id}>
            <span className={`timeline-dot dot-${h.status.toLowerCase()}`} aria-hidden="true" />
            <span>
              <strong>{STATUS_LABELS[h.status]}</strong> by {h.changedBy.name} ({h.changedBy.role.toLowerCase()})
            </span>
            <time dateTime={h.changedAt}>{formatDate(h.changedAt)}</time>
          </li>
        ))}
      </ol>
    </li>
  );
}
