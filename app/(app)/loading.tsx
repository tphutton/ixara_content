export default function Loading() {
  return (
    <div className="page-shell">
      <section className="quiet-panel route-loading">
        <span className="route-loading__ring" />
        <div>
          <p className="kicker">Loading</p>
          <h3>Preparing workspace</h3>
        </div>
      </section>
    </div>
  );
}
