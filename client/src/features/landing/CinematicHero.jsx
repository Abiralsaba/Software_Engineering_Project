import { useEffect, useRef, useState } from 'react';
import Landscape from './Landscape.jsx';
import { attachTimeline } from './sceneTimeline.js';

export default function CinematicHero({ anchor }) {
  const section = useRef(null), stage = useRef(null);
  const timeline = useRef({ progress: 0, motion: false, compact: false, listeners: new Set() });
  const [ready, setReady] = useState(false);
  const [preferences, setPreferences] = useState(() => ({ compact: typeof matchMedia === 'function' && matchMedia('(max-width: 900px)').matches, reduced: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches }));
  const motion = ready && !preferences.compact && !preferences.reduced;
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const small = matchMedia('(max-width: 900px)'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPreferences({ compact: small.matches, reduced: reduced.matches });
    small.addEventListener('change', update); reduced.addEventListener('change', update);
    return () => { small.removeEventListener('change', update); reduced.removeEventListener('change', update); };
  }, []);
  useEffect(() => {
    timeline.current.compact = preferences.compact;
    if (typeof ResizeObserver !== 'function') return;
    return attachTimeline(section.current, stage.current, timeline.current, motion);
  }, [motion, preferences.compact]);
  return <section ref={section} className="nx-cinematic" data-motion={motion} aria-label="Bangladesh, connected — a landscape journey">
    <div className="nx-stage" ref={stage} data-chapter="1">
      <Landscape timeline={timeline.current} compact={preferences.compact} reduced={preferences.reduced} onStatus={setReady} />
      <div className="nx-stage-shade" aria-hidden="true" /><div className="nx-stage-grain" aria-hidden="true" />
      <div className="nx-scene-panels">
        <div className="nx-scene-panel nx-arrival" data-scene-panel>
          <p className="nx-eyebrow"><span className="nx-red-dot" /><span lang="bn">বাংলাদেশের জন্য</span> / A shared tomorrow</p>
          <h1 id="nx-title">Bangladesh,<br /><em>connected.</em></h1>
          <p className="nx-hero-description">A thousand everyday journeys.<br />One place to take your next step.</p>
          <div className="nx-hero-actions"><a className="nx-button" href="#services" onClick={e => anchor(e, 'services')}>Explore services <span aria-hidden="true">↗</span></a><a className="nx-text-link" href="/index.html#signin">Sign in to NationX <span aria-hidden="true">→</span></a></div>
        </div>
        <div className="nx-scene-panel nx-river-copy" data-scene-panel aria-hidden="true" inert><p className="nx-eyebrow">01 / Follow what brings us together</p><h2>Life flows.<br /><em>Possibility follows.</em></h2><p>From our rivers to our communities.<br />Every connection begins with people.</p></div>
        <div className="nx-scene-panel nx-connected-copy" data-scene-panel aria-hidden="true" inert><p className="nx-eyebrow">02 / Different needs. Shared connections.</p><h2>Closer to<br /><em>what matters.</em></h2><p>Your identity. Your wellbeing.<br />Your next opportunity.</p></div>
        <div className="nx-scene-panel nx-resolution-copy" data-scene-panel aria-hidden="true" inert><p className="nx-eyebrow">03 / NationX — Bangladesh, connected</p><h2>Every path.<br /><em>A possibility.</em></h2><a className="nx-text-link" href="#services" onClick={e => anchor(e, 'services')}>Find your next step <span aria-hidden="true">↓</span></a></div>
      </div>
      <div className="nx-place-labels" aria-label="Connected services">{[['Identity', '/documents.html'], ['Health', '/health.html'], ['Education', '/education.html']].map(([name, href], i) => <a key={name} href={href} className="nx-place" data-place={i} aria-hidden="true" tabIndex={-1}><span className="nx-place-dot" /><span><small>0{i + 1} / CITIZEN SERVICES</small>{name} <b aria-hidden="true">↗</b></span></a>)}</div>
      <div className="nx-stage-footer"><span className="nx-stage-note">A civic-services prototype.<br /><span>Rooted in Bangladesh.</span></span><a href="#services" onClick={e => anchor(e, 'services')} className="nx-scroll-cue"><span>{motion ? 'Scroll to follow the river' : 'Discover the connections'}</span><span aria-hidden="true">↓</span></a><span className="nx-stage-bangla" lang="bn">একসাথে, আরও কাছে</span></div>
      <div className="nx-progress" aria-hidden="true"><span /><span /><span /><span /><i /></div>
    </div>
  </section>;
}
