import { useEffect, useRef, useState } from 'react';
import poster from '../features/landing/landscape.svg';
import './village-illustration.css';

// The same small scene is shared by the seasonal story and the login courtyard.
// Mount only near the viewport, release everything on navigation, pause offscreen.
export default function VillageIllustration({ mood = 'spring', paused = false, className = '', theme }) {
  const host = useRef(null), canvas = useRef(null), controller = useRef(null);
  const settings = useRef({ mood, paused }); settings.current = { mood, paused };
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver !== 'function' || typeof matchMedia !== 'function') return;
    let dead = false, started = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => { controller.current?.setPaused(reduced.matches || settings.current.paused); controller.current?.setMood(settings.current.mood); };
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || started) return;
      started = true;
      import('../features/dashboard/villageScene.js').then(({ mountVillage }) => {
        if (dead) return;
        controller.current = mountVillage(canvas.current, () => !dead && setReady(true), () => !dead && setReady(false), { detailed: true, theme });
        apply();
      }).catch(() => { /* The illustrated landscape remains available. */ });
    }, { rootMargin: '150px' });
    observer.observe(host.current); reduced.addEventListener('change', apply);
    return () => { dead = true; observer.disconnect(); reduced.removeEventListener('change', apply); controller.current?.dispose(); controller.current = null; };
  }, [theme]);
  useEffect(() => { controller.current?.setMood(mood); }, [mood]);
  useEffect(() => { controller.current?.setPaused(paused || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)); }, [paused]);
  return <div ref={host} className={`nx-village-art ${ready ? 'is-rendered' : ''} ${paused ? 'is-paused' : ''} ${className}`} data-mood={mood} aria-hidden="true">
    <div className="nx-village-orbit" /><div className="nx-village-sun" />
    <img className="nx-village-poster" src={poster} alt="" width="1600" height="1000" />
    <canvas ref={canvas} className="nx-village-canvas" />
    <div className="nx-village-weather">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--n': i, left: `${(i * 31 + 5) % 100}%` }} />)}</div>
  </div>;
}
