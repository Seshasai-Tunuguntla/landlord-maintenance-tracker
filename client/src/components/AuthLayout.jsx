export default function AuthLayout({ children }) {
  return (
    <div className="auth">
      <section className="auth-brand">
        <h2 className="auth-brand-title">Repairs, tracked from report to done.</h2>
        <p>
          Tenants report a problem with a photo. Landlords see what's urgent first and update progress as the work
          happens.
        </p>
        <div className="auth-preview" aria-hidden="true">
          <div className="ticket priority-urgent status-in_progress">
            <div className="ticket-head">
              <span className="ticket-title">No heat in the flat</span>
              <div className="chips">
                <span className="chip chip-priority-urgent">Urgent</span>
                <span className="chip chip-status-in_progress">In progress</span>
              </div>
            </div>
            <p className="ticket-meta">Flat 3B, 14 Lake View Road</p>
          </div>
          <div className="key-tag">
            <span className="key-tag-hole" />
            <span className="key-tag-label">Join code</span>
            <code className="key-tag-code">A7D556BC</code>
          </div>
        </div>
      </section>
      <div className="panel auth-panel">{children}</div>
    </div>
  );
}
