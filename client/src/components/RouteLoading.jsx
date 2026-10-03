import RiverJourney from './RiverJourney.jsx';

export default function RouteLoading({ label = 'Loading NationX…' }) {
  return (
    <div className="route-loading">
      <RiverJourney label={label} />
    </div>
  );
}
