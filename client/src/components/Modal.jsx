import { useEffect } from 'react';

export default function Modal({ title, onClose, children, width = '650px' }) {
  useEffect(() => {
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-overlay react-modal-visible" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="modal-content" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }}>
        <div className="modal-header"><h2>{title}</h2><button className="close-btn" type="button" aria-label="Close" onClick={onClose}><i className="fas fa-times" /></button></div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
