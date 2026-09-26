import { ministryDesigns, ministryService } from './ministryDesigns.js';

export function NidCardPreview({ profile = {}, nid }) {
  const fields = [['নাম:', profile.name_bn], ['Name:', profile.name_en], ['পিতা:', profile.father_name], ['মাতা:', profile.mother_name], ['জন্ম তারিখ:', profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '—']];
  return <div className="nid-card-preview"><div className="nid-card-visual">
    <div className="card-header-visual"><span className="card-govt">গণপ্রজাতন্ত্রী বাংলাদেশ</span><span className="card-title-bn">জাতীয় পরিচয়পত্র</span><span className="card-title-en">National ID Card</span></div>
    <div className="card-body-visual"><div className="card-photo"><i className="fas fa-user" aria-hidden="true" /></div><div className="card-details">{fields.map(([label, value]) => <div className="detail-row" key={label}><span className="label">{label}</span><span className="value">{value || '—'}</span></div>)}</div></div>
    <div className="card-footer-visual"><div className="nid-number">NID: {nid || '—'}</div><div className="card-status">Status: {profile.profile_status || '—'}</div></div>
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
