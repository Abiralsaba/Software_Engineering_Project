import './river-journey.css';

// CSS geometry is available immediately, even while the WebGL bundle loads.
export default function RiverJourney({ success = false, label = 'Loading NationX…', onContinue }) {
  return <section className={`nx-river-journey ${success ? 'is-arriving' : ''}`} role="status" aria-live="polite">
    <div className="nx-journey-wordmark">Nation<span>X</span><small>ROOTED IN BANGLADESH</small></div>
    <div className="nx-journey-landscape" aria-hidden="true">
      <div className="nx-journey-sun" />
      <div className="nx-journey-birds">⌁　⌁　⌁</div>
      <div className="nx-journey-bank nx-bank-far" />
      <div className="nx-journey-homestead"><div className="nx-journey-house"><i /><b /><span /></div><div className="nx-journey-tree"><i /><i /><i /><i /><i /></div><div className="nx-journey-flag"><i /></div></div>
      <div className="nx-journey-water">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--r': i }} />)}</div>
      <div className="nx-journey-boat"><span className="nx-journey-sail" /><span className="nx-journey-mast" /><span className="nx-journey-hull" /><span className="nx-journey-reflection" /></div>
      <div className="nx-journey-bank nx-bank-near" />
      <span className="nx-journey-reeds">╱╱╱</span>
    </div>
    <div className="nx-journey-copy"><p lang="bn">{success ? 'আপন আঙিনায় স্বাগত' : 'নদীর পথে, আপনার কাছে'}</p><h2>{success ? 'Welcome home.' : label}</h2><span>{success ? 'Signed in successfully. Your next chapter begins here.' : 'Bringing your services a little closer.'}</span><div className="nx-journey-line"><i /></div>{onContinue && <button type="button" onClick={onContinue} autoFocus>Continue to your workspace <span aria-hidden="true">→</span></button>}</div>
    <small className="nx-journey-foot">Rivers. Roots. Possibilities.</small>
  </section>;
}
