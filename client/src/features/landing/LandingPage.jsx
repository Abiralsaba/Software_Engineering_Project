import { useEffect, useRef, useState } from 'react';
import CinematicHero from './CinematicHero.jsx';
import './landing.css';
import './cinematic.css';

const medicineUrl = '/health.html?section=medicine-identifier';
const services = [
  ['01', 'Identity & documents', 'Keep important records close. Manage your linked documents and identity applications.', '/documents.html', 'id-card'],
  ['02', 'Health & wellbeing', 'Explore health cards, vaccinations, hospitals and appointment services.', '/health.html', 'heart-pulse'],
  ['03', 'Education & opportunity', 'Look up examination results and explore stipend applications.', '/education.html', 'graduation-cap'],
  ['04', 'Land & property', 'Review land records and follow property service applications.', '/land.html', 'seedling'],
  ['05', 'Support & progress', 'Send a message to a department and follow your service history.', '/contact.html', 'comments']
];

function Arrow({ diagonal = false }) { return <span aria-hidden="true">{diagonal ? '↗' : '→'}</span>; }
function Brand() { return <span className="nx-brand"><span className="nx-mark" aria-hidden="true"><i /><i /><i /></span>Nation<span className="nx-brand-x">X</span></span>; }

export default function LandingPage() {
  const [menu, setMenu] = useState(false);
  const menuButton = useRef(null);
  const root = useRef(null);
  useEffect(() => {
    const oldTitle = document.title;
    document.title = 'NationX — Bangladesh, Connected.';
    document.body.classList.add('nx-landing-body');
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('nx-arrived'); observer.unobserve(entry.target); } });
    }, { threshold: 0.12 }) : null;
    root.current?.querySelectorAll('[data-reveal]').forEach(el => observer?.observe(el));
    return () => { observer?.disconnect(); document.body.classList.remove('nx-landing-body'); document.title = oldTitle; };
  }, []);
  useEffect(() => {
    const close = event => { if (event.key === 'Escape' && menu) { setMenu(false); menuButton.current?.focus(); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menu]);
  function anchor(event, id) {
    event.preventDefault(); setMenu(false);
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    target?.focus({ preventScroll: true });
    history.replaceState(history.state, '', `#${id}`);
  }
  return <div className="nx-landing" ref={root}>
    <a className="nx-skip" href="#main">Skip to content</a>
    <header className="nx-navigation">
      <a href="/index.html" aria-label="NationX home"><Brand /></a>
      <button className="nx-menu-toggle" ref={menuButton} type="button" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} aria-controls="nx-nav-links" onClick={() => setMenu(!menu)}>{menu ? 'Close −' : 'Menu +'}</button>
      <nav id="nx-nav-links" className={menu ? 'nx-nav-links nx-menu-open' : 'nx-nav-links'} aria-label="Main navigation">
        <a href="#services" onClick={e => anchor(e, 'services')}>Services</a>
        <a href="#journey" onClick={e => anchor(e, 'journey')}>How it works</a>
        <a href="#medicine" onClick={e => anchor(e, 'medicine')}>Medicine Identifier</a>
        <a href="#about" onClick={e => anchor(e, 'about')}>About</a>
        <a className="nx-nav-signin" href="/index.html#signin">Sign in <Arrow diagonal /></a>
      </nav>
    </header>

    <main id="main" tabIndex={-1}>
      <CinematicHero anchor={anchor} />
      <div className="nx-hero-baseline"><span>Rivers. Roots. Possibilities.</span><span lang="bn">আমাদের বাংলাদেশ</span><span>A unified civic-services prototype</span></div>

      <section id="services" tabIndex={-1} className="nx-services nx-section" aria-labelledby="nx-services-title">
        <div className="nx-section-intro" data-reveal><p className="nx-eyebrow">01 / A more connected everyday</p><h2 id="nx-services-title">Different needs.<br /><em>One starting point.</em></h2><p>Your documents, your wellbeing, your next opportunity. Find the service that matters to you, without losing the bigger picture.</p><span className="nx-thread-art" aria-hidden="true"><i /><i /><i /><i /></span><a className="nx-text-link" href="/history.html">Follow your service history <Arrow diagonal /></a></div>
        <div className="nx-service-list">{services.map(([number, name, desc, href, icon]) => <a className="nx-service-row" href={href} key={number} data-reveal><span className="nx-service-number">{number}</span><i className={`fas fa-${icon}`} aria-hidden="true" /><div><h3>{name}</h3><p>{desc}</p></div><Arrow diagonal /></a>)}</div>
      </section>

      <section id="medicine" tabIndex={-1} className="nx-medicine" aria-labelledby="nx-medicine-title">
        <div className="nx-medicine-inner nx-section">
          <div className="nx-medicine-art" data-reveal>
            <span className="nx-illustration-label">ILLUSTRATIVE PREVIEW</span>
            <div className="nx-label-sheet"><div className="nx-label-sheet-header"><span>Label review</span><i className="fas fa-prescription-bottle-medical" aria-hidden="true" /></div><span className="nx-label-small">EXAMPLE PACKAGE</span><strong>Medicine name</strong><div className="nx-scan-line" /><div className="nx-label-details"><span>Strength</span><span>Dosage form</span><span>Manufacturer</span></div><p>Review the visible information.<br />Confirm what matches your label.</p><span className="nx-review-tag"><i className="fas fa-check" aria-hidden="true" /> Your confirmation matters</span></div>
            <div className="nx-comparison"><div><span className="nx-comparison-icon" aria-hidden="true">↔</span><strong>Compare with care</strong></div><p>Confirmed medicine <span>Reviewed by you</span></p><p>Matching specifications <span>Dataset records</span></p><p>Available prices <span>Check with a pharmacist</span></p><small>Illustrative layout · No live prices shown</small></div>
            <span className="nx-medicine-weave" aria-hidden="true" />
          </div>
          <div className="nx-medicine-copy" data-reveal><p className="nx-eyebrow">02 / A little clarity goes a long way</p><h2 id="nx-medicine-title">Read the label.<br /><em>Understand<br />the options.</em></h2><p>Turn a prescription or medicine package into information you can review. Confirm extracted details, then compare matching records and dataset prices.</p><ol className="nx-medicine-steps">{['Upload', 'Review', 'Confirm', 'Compare'].map((step, i) => <li key={step}><span>0{i + 1}</span>{step}</li>)}</ol><a className="nx-button nx-button-light" href={medicineUrl}>Explore Medicine Identifier <Arrow /></a><p className="nx-medicine-note">Extraction can make mistakes. Always confirm the information. Comparisons come from a dataset; consult your doctor or pharmacist before changing medicine.</p></div>
        </div>
      </section>

      <section id="journey" tabIndex={-1} className="nx-journey nx-section" aria-labelledby="nx-journey-title"><div className="nx-journey-heading" data-reveal><p className="nx-eyebrow">03 / From a question to a next step</p><h2 id="nx-journey-title">Less searching.<br /><em>More moving forward.</em></h2></div><ol className="nx-journey-steps">{[
        ['Find your service', 'Start with what you need. Explore a department or open your citizen dashboard.'],
        ['Make it yours', 'Sign in, then submit or review the information and documents the service requires.'],
        ['Stay in the picture', 'Return to your history to follow requests, status changes and next steps.']
      ].map(([title, text], index) => <li key={title} data-reveal><span className="nx-step-number">0{index + 1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol></section>

      <section id="about" tabIndex={-1} className="nx-about nx-section" aria-labelledby="nx-about-title"><div className="nx-about-symbol" aria-hidden="true"><span /><span /><span /><span /><span /></div><div data-reveal><p className="nx-eyebrow">Built with purpose</p><h2 id="nx-about-title">A shared idea.<br /><em>A connected Bangladesh.</em></h2><p>NationX is an academic software-engineering project exploring how civic services can work together. It brings citizen applications, documents and administrative workflows into one prototype.</p><p className="nx-about-disclaimer">Created for learning and demonstration. Not an official government service or a publicly deployed national platform.</p></div></section>

      <section className="nx-closing"><div className="nx-closing-pattern" aria-hidden="true" /><p className="nx-eyebrow" lang="bn">একসাথে, আরও কাছে</p><h2>Your next step.<br /><em>A little more connected.</em></h2><a className="nx-button" href="/index.html#signin">Start with NationX <Arrow /></a></section>
    </main>
    <footer className="nx-footer"><a href="/index.html" aria-label="NationX home"><Brand /></a><p>A civic-services prototype, rooted in Bangladesh.</p><nav aria-label="Footer"><a href="#services" onClick={e => anchor(e, 'services')}>Services</a><a href={medicineUrl}>Medicine Identifier</a><a href="/index.html#admin">Admin sign in</a></nav><div className="nx-footer-bottom"><span>NationX · Academic project</span><span>Thoughtfully connected.</span></div></footer>
  </div>;
}
