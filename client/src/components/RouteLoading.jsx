export default function RouteLoading({ label = 'Loading NationX…' }) {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
