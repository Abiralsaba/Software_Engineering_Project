import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStylesheets } from '../../hooks/useStylesheets.js';
import VillageIllustration from '../../components/VillageIllustration.jsx';
import './village-login.css';

export default function VillageLoginShell({ children, admin = false, registering = false }) {
  useStylesheets(['/css/auth.css']);
  const [dusk, setDusk] = useState(false), [paused, setPaused] = useState(false);
  useEffect(() => {
    const title = document.title;
    document.title = 'Welcome home — NationX';
    document.body.classList.add('nx-village-login-body');
    return () => { document.body.classList.remove('nx-village-login-body'); document.title = title; };
  }, []);
  return <main className={`nx-village-login ${dusk ? 'is-dusk' : ''}`}>
    <section className="nx-login-courtyard" aria-label="Welcome to NationX">
      <Link className="nx-login-brand" to="/index.html" state={null} aria-label="NationX home"><span className="nx-login-mark" aria-hidden="true"><i /></span>Nation<span>X</span><small>ROOTED IN BANGLADESH</small></Link>
      <div className="nx-courtyard-copy"><span className="nx-courtyard-eyebrow"><i /> A little closer to home</span><h2>Your world.<br /><em>Your courtyard.</em></h2><p>Where your everyday journeys<br />find a place to begin.</p></div>
      <div className="nx-courtyard-window"><div className="nx-window-rings" aria-hidden="true" /><span className="nx-window-bangla" lang="bn">আমার সোনার বাংলা</span><VillageIllustration mood={dusk ? 'dusk' : 'summer'} paused={paused} /><div className="nx-window-sill" aria-hidden="true" /></div>
      <div className="nx-courtyard-controls"><span lang="bn">আপন আঙিনায় স্বাগতম</span><div className="nx-day-switch" aria-label="Village lighting"><button type="button" aria-pressed={!dusk} onClick={() => setDusk(false)}><i className="fas fa-sun" aria-hidden="true" /> Dawn</button><button type="button" aria-pressed={dusk} onClick={() => setDusk(true)}><i className="fas fa-moon" aria-hidden="true" /> Dusk</button></div><button className="nx-login-pause" type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? 'Play courtyard animation' : 'Pause courtyard animation'}><i className={`fas fa-${paused ? 'play' : 'pause'}`} aria-hidden="true" /></button></div>
      <div className="nx-courtyard-footer"><span>Rivers. Roots. Possibilities.</span><span>01 / YOUR NEXT CHAPTER</span></div>
    </section>
    <section className="nx-login-form-side" aria-label={admin ? 'Administrator sign in' : 'Citizen sign in'}>
      <Link className="nx-back-home" to="/index.html" state={null}><span aria-hidden="true">←</span> Back to Bangladesh, connected</Link>
      <div className="nx-login-form-wrap"><p className="nx-login-kicker">{admin ? 'THE ADMINISTRATOR WORKSPACE' : 'YOUR CITIZEN WORKSPACE'}</p><h2 className="nx-login-welcome">{registering ? 'Make a difference.' : 'Welcome back.'}</h2><p className="nx-login-intro">{registering ? 'Request access to serve your community.' : 'A familiar place. A new possibility. Sign in to continue.'}</p>{children}</div>
      <footer className="nx-login-fineprint"><span><i className="fas fa-seedling" aria-hidden="true" /> Made for a more connected everyday.</span><span>NationX · Academic prototype</span></footer>
    </section>
  </main>;
}
