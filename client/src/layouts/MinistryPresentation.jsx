import { ministryDesigns, ministryService } from './ministryDesigns.js';
import { useState } from 'react';
import VillageIllustration from '../components/VillageIllustration.jsx';
import './ministry-village.css';

export function NidCardPreview({ profile = {}, nid }) {
  profile = profile || {};
  const fields = [['নাম:', profile.name_bn], ['Name:', profile.name_en], ['পিতা:', profile.father_name_bn || profile.father_name_en || profile.father_name], ['মাতা:', profile.mother_name_bn || profile.mother_name_en || profile.mother_name], ['জন্ম তারিখ:', profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '—']];
  const photo = profile.photo_url;
  const photoSrc = photo && (photo.startsWith('/') || /^https?:\/\//.test(photo) ? photo : `/${photo}`);
  return <div className="nid-card-preview"><div className="nid-card-visual">
    <div className="card-header-visual"><span className="card-govt">গণপ্রজাতন্ত্রী বাংলাদেশ</span><span className="card-title-bn">জাতীয় পরিচয়পত্র</span><span className="card-title-en">National ID Card</span></div>
    <div className="card-body-visual"><div className="card-photo">{photoSrc ? <img src={photoSrc} alt="Citizen portrait" /> : <i className="fas fa-user" aria-hidden="true" />}</div><div className="card-details">{fields.map(([label, value]) => <div className="detail-row" key={label}><span className="label">{label}</span><span className="value">{value || '—'}</span></div>)}</div></div>
    <div className="card-footer-visual"><div className="nid-number">NID: {nid || profile.nid_number || '—'}</div><div className="card-status">Status: {profile.profile_status || (profile.has_full_profile === false ? 'Profile incomplete' : '—')}</div></div>
    {profile.has_full_profile === false && <p className="nx-nid-completion">Complete My NID Profile to add your Bangla name and family details.</p>}
  </div></div>;
}

const healthCards = {
  'health-card': ['id-card', 'Digital Health Card', 'Apply for your digital health card — স্বাস্থ্য কার্ডের জন্য আবেদন করুন', 'Apply Now'],
  vaccination: ['syringe', 'Vaccination', 'Register for vaccinations — টিকাদান কর্মসূচিতে নিবন্ধন করুন', 'Register'],
  hospitals: ['hospital', 'Find Hospitals', 'Search government hospitals & clinics — সরকারি হাসপাতাল খুঁজুন', 'Search'],
  appointments: ['user-doctor', 'Book Appointment', 'Schedule a doctor appointment — ডাক্তার অ্যাপয়েন্টমেন্ট বুক করুন', 'Book Now'],
  'medicine-identifier': ['pills', 'Medicine Identifier', 'Scan medicine packaging or a prescription and review the catalogue matches.', 'Open service']
};

export function MinistryBanner({ design, id }) {
  const [paused, setPaused] = useState(false);
  const scenes = { nid: ['পরিচয়ের শিকড়', 'The village union office', 'Identity begins at home.'], passport: ['ঘর থেকে বিশ্বে', 'The departure ghat', 'Every journey starts with a place to call home.'], health: ['সুস্থ গ্রাম, সুস্থ দেশ', 'The community clinic', 'Care, closer to your community.'], education: ['আলোর পথে', 'The village school', 'A brighter tomorrow begins here.'] };
  const scene = scenes[id];
  if (scene) return <header className="nx-ministry-banner nx-service-village-banner">
    <div className="nx-service-village-copy"><span className="nx-service-chapter" lang="bn">{scene[0]}</span><h1>{design.title}</h1><p className="bangla-text" lang="bn">{design.bn}</p><p className="subtitle">{scene[2]}</p>{id === 'health' && <a className="nx-emergency-link" href="tel:999">Emergency 999</a>}</div>
    <div className="nx-service-village-art"><VillageIllustration theme={id} mood={id === 'education' ? 'spring' : 'harvest'} paused={paused} /><div className="nx-service-scene-caption"><span>{scene[1]}</span><button type="button" aria-label={paused ? 'Play village scene' : 'Pause village scene'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? '▶' : 'Ⅱ'}</button></div></div>
  </header>;
  return <header className={`${design.prefix}-banner nx-ministry-banner`}>
    {id === 'nid' && <div className="banner-emblem"><img src="/images/bd_flag.svg" alt="Bangladesh flag" height="40" /></div>}
    <h1><i className={`fas fa-${design.icon}`} aria-hidden="true" /> {design.title}</h1>
    <p className="bangla-text" lang={id === 'water' ? 'en' : 'bn'}>{design.bn}</p>
    <p className="subtitle">{design.subtitle}</p>
    {id === 'health' && <a className="nx-emergency-link" href="tel:999"><i className="fas fa-phone" aria-hidden="true" /> Emergency 999</a>}
  </header>;
}

export function MinistryActions({ ministry, onSectionChange }) {
  const design = ministryDesigns[ministry];
  if (!design.actions.length) return null;
  return <div className={`${design.prefix}-action-grid nx-ministry-actions`} aria-label="Quick services">
    {design.actions.map(id => {
      const item = ministryService(id);
      const health = ministry === 'health' && healthCards[id];
      return <article className={`${design.prefix}-action-card`} key={id}>
        <span className="action-icon" aria-hidden="true">{<i className={`fas fa-${health ? health[0] : item.icon}`} />}</span>
        <h2>{health ? health[1] : item.label}</h2><p>{health ? health[2] : item.description}</p>
        <button type="button" className={`btn-${design.prefix}`} onClick={() => onSectionChange(id)}>
          {health ? health[3] : 'Open service'} <i className="fas fa-arrow-right" aria-hidden="true" /><span className="nx-visually-hidden">: {item.label}</span>
        </button>
      </article>;
    })}
  </div>;
}
