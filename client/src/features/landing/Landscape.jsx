import { Component, lazy, Suspense, useEffect, useState } from 'react';
import poster from './landscape.svg';

const Scene = lazy(() => import('./LandscapeScene.jsx'));
class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure('scene-error'); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function Landscape({ timeline, compact, reduced, onStatus }) {
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState('');
  useEffect(() => { setReady(false); }, [compact, reduced]);
  useEffect(() => { onStatus(ready && !failure && !reduced); }, [ready, failure, reduced, onStatus]);
  function fail(reason) { console.warn(`[NationX landscape] ${reason}; showing the static composition.`); setFailure(reason); setReady(false); }
  const live = ready && !failure && !reduced;
  return <div className={`nx-landscape ${live ? 'nx-scene-ready' : ''}`} data-renderer={live ? 'webgl' : reduced ? 'reduced-motion' : failure || 'loading'}>
    <img className="nx-landscape-poster" src={poster} width="1600" height="1000" alt="An atmospheric Bangladesh-inspired river landscape, with fields, a sailing boat and contemporary terracotta civic architecture." />
    {!reduced && !failure && <SceneBoundary onFailure={fail}><Suspense fallback={null}><Scene timeline={timeline} compact={compact} onReady={() => setReady(true)} onFailure={fail} /></Suspense></SceneBoundary>}
    {(failure || reduced) && <span className="nx-static-note">{reduced ? 'Reduced motion · Still landscape' : '3D unavailable · Still landscape'}</span>}
  </div>;
}
