import { useState } from 'react';
import VillageIllustration from '../../components/VillageIllustration.jsx';
import './village-story.css';

const seasons = [
  ['summer', 'গ্রীষ্ম', 'Summer', 'Long days. Endless possibility.', 'A kite above the courtyard. Shade beneath the palms. A little time to plan what comes next.', 'Sunlit courtyards & open skies', 'sun'],
  ['monsoon', 'বর্ষা', 'Monsoon', 'When the rain brings us closer.', 'Rain on a tin roof, ripples on the river, and a boat finding its way home. A familiar world, always in motion.', 'Rain on rooftops & river journeys', 'cloud-rain'],
  ['autumn', 'শরৎ', 'Autumn', 'A little room to look ahead.', 'Soft clouds, a brighter sky, and the river winding past the village. Space to breathe. Space for a new beginning.', 'Clear skies & quiet riverbanks', 'cloud-sun'],
  ['harvest', 'হেমন্ত', 'Late autumn', 'Good things grow with care.', 'Golden fields and a busy courtyard. The season of bringing things home, sharing what we have, and looking forward.', 'Golden paddies & harvest stories', 'wheat-awn'],
  ['winter', 'শীত', 'Winter', 'The warmth of belonging.', 'A veil of morning mist. The glow of a window. A slow start to a day filled with familiar faces and small possibilities.', 'Misty mornings & warm welcomes', 'mug-hot'],
  ['spring', 'বসন্ত', 'Spring', 'Every beginning belongs here.', 'New leaves, a splash of colour, and a breeze through the washing line. A fresh chapter, rooted in the places we call home.', 'Fresh leaves & new beginnings', 'seedling']
];

export function VillageStory() {
  const [selected, setSelected] = useState(5), [paused, setPaused] = useState(false);
  const [id, bn, , title, detail, note, icon] = seasons[selected];
  function chooseWithKeys(event, index) {
    const next = event.key === 'ArrowRight' ? (index + 1) % 6 : event.key === 'ArrowLeft' ? (index + 5) % 6 : event.key === 'Home' ? 0 : event.key === 'End' ? 5 : null;
    if (next === null) return;
    event.preventDefault(); setSelected(next); event.currentTarget.parentElement.children[next].focus();
  }
  return <section id="village" className="nx-village-story" tabIndex={-1} aria-labelledby="nx-village-title">
    <div className="nx-village-intro" data-reveal><p className="nx-eyebrow"><span className="nx-red-dot" /> A little closer to our roots</p><h2 id="nx-village-title">Six seasons.<br /><em>One place to belong.</em></h2><p>Before the next step, a moment for home. Explore a tiny Bangladesh, brought to life in the colours of its seasons.</p></div>
    <div className="nx-season-selector" role="tablist" aria-label="Seasons of Bangladesh">{seasons.map(([key, bangla, english], index) => <button key={key} id={`season-${key}`} role="tab" type="button" aria-selected={index === selected} aria-controls="nx-season-panel" tabIndex={index === selected ? 0 : -1} onKeyDown={event => chooseWithKeys(event, index)} onClick={() => setSelected(index)}><span lang="bn">{bangla}</span><small>{english}</small></button>)}</div>
    <div className="nx-season-panel" id="nx-season-panel" role="tabpanel" aria-labelledby={`season-${id}`} data-season={id}>
      <div className="nx-season-copy"><span className="nx-season-number">0{selected + 1} <i /> 06</span><p className="nx-season-bangla" lang="bn">{bn}</p><div aria-live="polite" aria-atomic="true"><h3>{title}</h3><p>{detail}</p></div><span className="nx-season-note"><i className={`fas fa-${icon}`} aria-hidden="true" />{note}</span></div>
      <div className="nx-season-scene"><VillageIllustration mood={id} paused={paused} /><span className="nx-season-caption"><i /> A small world, full of life</span><button type="button" className="nx-season-pause" onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? 'Play village animation' : 'Pause village animation'}><i className={`fas fa-${paused ? 'play' : 'pause'}`} aria-hidden="true" /></button></div>
    </div>
    <div className="nx-village-footnote"><span>Made of rivers, roots and everyday stories.</span><span lang="bn">ছয় ঋতুর বাংলাদেশ</span></div>
  </section>;
}

function LifeArt({ type }) {
  return <svg viewBox="0 0 360 160" fill="none" aria-hidden="true" className="nx-life-art">
    <circle cx="280" cy="50" r="30" fill="currentColor" opacity=".13" />
    <path d="M0 130Q80 100 175 129T360 115M0 147Q110 116 210 145T380 130" stroke="currentColor" opacity=".18" />
    {type === 'field' ? <g stroke="currentColor" strokeWidth="2"><path d="M120 135V45m45 90V30m45 105V55" />{[120,165,210].map((x, i) => <g key={x}>{[0,1,2,3].map(j => <g key={j}><path d={`M${x} ${65 + j * 15 - i * 5}q-28-1-25-19 23 1 25 19Z`} fill="currentColor" opacity=".6" /><path d={`M${x} ${72 + j * 15 - i * 5}q28-1 25-19-23 1-25 19Z`} fill="currentColor" opacity=".4" /></g>)}</g>)}</g> : type === 'home' ? <g><path d="M113 127V64l62-38 70 38v65Z" fill="currentColor" opacity=".25" /><path d="m94 69 78-53 95 54-15 12-80-45-63 44Z" fill="currentColor" opacity=".7" /><path d="M153 127V86h33v41M207 82h21v23h-21M126 83h17v21h-17" fill="currentColor" /><path d="M95 134h171" stroke="currentColor" strokeWidth="3" /></g> : type === 'book' ? <g><path d="M180 127q-49-29-95-12V39q48-12 95 14 47-26 95-14v76q-46-17-95 12Z" fill="currentColor" opacity=".2" /><path d="M180 53v74M105 64q29-3 55 10m-55 10q29-3 55 10m-55 10q29-3 55 10M200 74q26-13 55-10m-55 30q26-13 55-10m-55 30q26-13 55-10" stroke="currentColor" strokeWidth="2" /></g> : <g><path d="M90 112q92 26 177-8-15 39-103 33Z" fill="currentColor" opacity=".7" /><path d="M176 110V25l-65 72Z" fill="currentColor" opacity=".2" /><path d="m184 30 1 78 61-13Z" fill="currentColor" opacity=".45" /><path d="M179 23v90" stroke="currentColor" strokeWidth="3" /></g>}
  </svg>;
}

export function EverydayStories() {
  const stories = [
    ['field', '01 / GROWING TOGETHER', 'From the field, forward.', 'Crop reports, agricultural support and market information for the work that feeds our communities.', 'Explore agriculture', '/agriculture.html'],
    ['home', '02 / ROOTED IN BELONGING', 'A place to call your own.', 'Keep track of land records, property applications and the documents that connect you to home.', 'Visit land services', '/land.html'],
    ['book', '03 / ROOM TO DREAM', 'Small steps. Bigger futures.', 'Discover examination results, stipend opportunities and the next chapter of your education.', 'Explore education', '/education.html'],
    ['boat', '04 / EVERYDAY ESSENTIALS', 'Care that reaches home.', 'Find water services, review connection requests and follow the things your household depends on.', 'Visit water services', '/water.html']
  ];
  return <section className="nx-everyday nx-section" aria-labelledby="nx-everyday-title"><header data-reveal><p className="nx-eyebrow">Built around everyday life</p><h2 id="nx-everyday-title">Big possibilities.<br /><em>Familiar beginnings.</em></h2><p>Life doesn’t happen in departments. It happens in homes, classrooms, fields and communities. Start with what matters to you.</p></header><div className="nx-life-grid">{stories.map(([art, label, title, detail, link, href]) => <a className={`nx-life-card nx-life-${art}`} href={href} key={art} data-reveal><LifeArt type={art} /><span className="nx-life-label">{label}</span><h3>{title}</h3><p>{detail}</p><span className="nx-life-link">{link}<b aria-hidden="true">↗</b></span></a>)}</div></section>;
}

export function LandingQuestions() {
  return <section className="nx-questions nx-section" aria-labelledby="nx-questions-title"><div data-reveal><p className="nx-eyebrow">Before you begin</p><h2 id="nx-questions-title">A few things,<br /><em>made clearer.</em></h2><p>A little guidance for your first visit.</p><span className="nx-question-bangla" lang="bn" aria-hidden="true">জানতে চাই</span></div><div className="nx-question-list">{[
    ['Where should I start?', <>Explore a service that matches your needs, or <a href="/index.html#signin">sign in</a> to open your citizen dashboard. Your dashboard brings requests, documents and notifications together.</>],
    ['Can I register without an NID?', <>Yes. Choose the applicant option when you <a href="/register.html">create an account</a>. On your next visit, turn on “Applicant login” to access the applicant workspace.</>],
    ['How do I follow an application?', <>After signing in, open your dashboard or <a href="/history.html">service history</a> to review your requests and available status updates.</>],
    ['Is NationX an official government website?', <>NationX is an academic project for learning and demonstration. It explores connected government-service workflows; it is not an official government platform.</>]
  ].map(([question, answer], index) => <details key={question}><summary><span>0{index + 1}</span>{question}<i aria-hidden="true">+</i></summary><p>{answer}</p></details>)}</div></section>;
}
