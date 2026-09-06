import { useStylesheets } from '../hooks/useStylesheets.js';

export default function AuthShell({ children, icons = ['landmark', 'id-card', 'file-alt', 'university'] }) {
  useStylesheets(['/css/auth.css']);

  return (
    <>
      <div className="animated-bg" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <div className="particle" key={index} />)}
        <div className="wave-container">
          <div className="wave" />
          <div className="wave" />
        </div>
      </div>
      <div className="floating-icons" aria-hidden="true">
        {icons.map(icon => <i className={`fas fa-${icon} floating-icon`} key={icon} />)}
      </div>
      <div className="auth-container">
        <div className="auth-card">
          <div className="corner-decoration top-left" />
          <div className="corner-decoration bottom-right" />
          {children}
        </div>
      </div>
    </>
  );
}

export function AuthHeader({ admin = false, title, subtitle }) {
  return (
    <div className="auth-header">
      <div className="flag-emblem"><div className="flag-circle" /></div>
      <h1>{title || (admin ? 'Admin Portal' : 'গণপ্রজাতন্ত্রী বাংলাদেশ')}</h1>
      <p>{subtitle || (admin ? 'Access the Admin Panel' : 'Government e-Service Portal')}</p>
      <div className="govt-badge">
        <i className={`fas ${admin ? 'fa-user-shield' : 'fa-shield-halved'}`} />
        <span>{admin ? 'Administrator Access' : 'Secure Government Login'}</span>
      </div>
    </div>
  );
}

export function FormField({ label, icon, as = 'input', children, ...props }) {
  const Element = as;
  return (
    <div className="form-group">
      <label htmlFor={props.id}><i className={`fas fa-${icon}`} /> {label}</label>
      <div className="input-wrapper">
        <Element className="form-control" {...props}>{children}</Element>
        {as === 'input' && <i className={`fas fa-${icon} input-icon`} aria-hidden="true" />}
      </div>
    </div>
  );
}
