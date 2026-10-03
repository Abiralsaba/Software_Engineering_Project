import { useEffect, useRef, useState } from 'react';
import './bengali-backdrop.css';

// The illustration stays available while WebGL loads, or when it is unavailable.
function VillageSilhouette() {
  return <svg className="bengal-fallback" viewBox="0 0 700 420" fill="none">
    <ellipse cx="370" cy="320" rx="255" ry="62" fill="#0a4539" />
    <path d="M125 316Q235 243 365 301T622 302L603 335Q464 380 338 330T125 338Z" fill="#15776a" />
    <path d="M273 270V194L325 163L388 192V267Z" fill="#36896b" />
    <path d="m253 199 69-65 89 57-24 13-65-39-47 43Z" fill="#bd5260" />
    <path d="M320 270v-54h27v53M281 212h23v25h-23M359 212h19v25h-19" fill="#072d28" />
    <path d="M468 268q-25-95 2-156" stroke="#6b8863" strokeWidth="10" />
    <path d="M468 116q-64-56-101 10 57-27 101-10Zm0 0q56-57 95-5-52-18-95 5Zm0 0q-28-75-59-40 39 8 59 40Zm0 0q45-84 62-44-36 3-62 44Zm0 0q-35 5-37 54 25-39 37-54Zm0 0q52 5 63 45-35-24-63-45Z" fill="#279874" />
    <path d="M190 292v-91" stroke="#95ae86" strokeWidth="3" /><path d="M192 202h51v32h-51Z" fill="#008b65" /><circle cx="217" cy="218" r="10" fill="#ed5669" />
    <path d="M421 327q46 14 90-13-7 37-60 33Z" fill="#aa6c57" /><path d="m464 326 1-54 32 41Z" fill="#d9b982" />
    <path d="M219 280h39l11 12-6 8h-9v16h-5v-16h-22v16h-5v-18Z" fill="#bbcfba" />
    <path d="M214 281q-10 1-7 18" stroke="#bbcfba" strokeWidth="3" />
  </svg>;
}

export default function BengaliBackdrop() {
  const canvas = useRef(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const controller = useRef(null);
  const motionPaused = useRef(false);
  motionPaused.current = paused || reduced;
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    update(); preference.addEventListener('change', update);
    let disposed = false;
    // Keep Three.js out of the initial dashboard bundle.
    import('./villageScene.js').then(({ mountVillage }) => {
      if (disposed) return;
      controller.current = mountVillage(canvas.current, () => !disposed && setReady(true), () => !disposed && setReady(false));
      controller.current?.setPaused(preference.matches || motionPaused.current);
    }).catch(() => { /* The illustrated fallback is intentionally always present. */ });
    return () => {
      disposed = true;
      preference.removeEventListener('change', update);
      controller.current?.dispose(); controller.current = null;
    };
  }, []);
  useEffect(() => { controller.current?.setPaused(paused || reduced); }, [paused, reduced]);

  return <>
    <div className={`bengal-backdrop ${ready ? 'is-ready' : ''} ${paused || reduced ? 'is-still' : ''}`} aria-hidden="true">
      <div className="bengal-aura bengal-aura-green" /><div className="bengal-aura bengal-aura-red" />
      <div className="bengal-sun" />
      <div className="bengal-village"><VillageSilhouette /><canvas ref={canvas} /></div>
      <div className="bengal-words" lang="bn"><span>আমার বাংলাদেশ</span><span>অ</span><span>ক</span><span>নদী</span><span>সবুজ</span><span>মাটির টানে</span><span>বাংলা</span></div>
      <svg className="bengal-river" viewBox="0 0 1400 500" preserveAspectRatio="none" fill="none">
        <path d="M-100 390C240 90 460 570 830 280S1310 100 1530 190" stroke="#37bc94" strokeWidth="100" opacity=".035" />
        {[0, 1, 2, 3, 4, 5].map(i => <path key={i} d={`M-100 ${365 + i * 22}C240 ${65 + i * 22} 460 ${545 + i * 22} 830 ${255 + i * 22}S1310 ${75 + i * 22} 1530 ${165 + i * 22}`} stroke={i % 2 ? '#df6873' : '#39b891'} opacity={.1 - i * .01} />)}
      </svg>
      <div className="bengal-fireflies">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--i': i, left: `${(i * 37 + 11) % 100}%`, top: `${(i * 23 + 7) % 100}%` }} />)}</div>
      <div className="bengal-grain" />
    </div>
    <button className="bengal-motion-toggle" type="button" aria-label={paused || reduced ? 'Play background animation' : 'Pause background animation'} aria-pressed={paused || reduced} disabled={reduced} title={reduced ? 'Background motion is off to match your device preference' : undefined} onClick={() => setPaused(value => !value)}>
      <i className={`fas fa-${paused || reduced ? 'play' : 'pause'}`} aria-hidden="true" /><span>{paused || reduced ? 'Scene paused' : 'Living Bangladesh'}</span>
    </button>
  </>;
}
