import { useCallback, useEffect, useState } from 'react';
import CitizenShell, { resolveAssetUrl } from '../../layouts/CitizenShell.jsx';
import Modal from '../../components/Modal.jsx';
import RouteLoading from '../../components/RouteLoading.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';

const officialConfig = [
  ['NID', 'National ID', 'id-card', 'nid', 'nid_number'],
  ['Passport', 'Passport', 'passport', 'passport', 'passport_number'],
  ['Tax', 'Tax TIN', 'file-invoice-dollar', 'tax', 'tin_number']
];

export default function DocumentsPage() {
  const [official, setOfficial] = useState({ nid: null, passport: null, tax: null, land: [] });
  const [personal, setPersonal] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [officialRows, personalRows] = await Promise.all([
        apiRequest('/api/dashboard/documents'),
        apiRequest('/api/dashboard/documents/user')
      ]);
      setOfficial(officialRows);
      setPersonal(Array.isArray(personalRows) ? personalRows : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function uploadPersonal(event) {
    event.preventDefault();
    setSubmitting(true);
    const formElement = event.currentTarget;
    const values = new FormData(formElement);
    const file = formElement.elements.document.files[0];
    const body = new FormData();
    body.append('docType', values.get('docType'));
    body.append('docName', values.get('docName'));
    if (file) body.append('document', file);
    try {
      await apiRequest(modal.document?.id ? `/api/dashboard/documents/update/${modal.document.id}` : '/api/dashboard/documents/upload', { method: modal.document?.id ? 'PUT' : 'POST', body });
      await alerts.success(modal.document?.id ? 'Updated!' : 'Uploaded!', 'Your document has been submitted for verification.');
      setModal(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
      await alerts.error(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadOfficial(event) {
    event.preventDefault();
    setSubmitting(true);
    const formElement = event.currentTarget;
    const values = new FormData(formElement);
    const body = new FormData();
    body.append('docCategory', modal.category);
    body.append('identityNumber', values.get('identityNumber'));
    body.append('document', formElement.elements.document.files[0]);
    try {
      await apiRequest('/api/dashboard/documents/upload-official', { method: 'POST', body });
      await alerts.success('Submitted!', 'Your official document has been sent for verification.');
      setModal(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
      await alerts.error(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CitizenShell pageStyles={['/css/documents.css']}>
      <header className="react-page-header"><div><h1>My Official Documents</h1><p>Manage linked government records and personal files.</p></div></header>
      {error && <div className="react-dashboard-error" role="alert">{error}</div>}
      {loading ? <RouteLoading label="Loading documents…" /> : <>
        <div className="doc-grid react-doc-grid">{officialConfig.map(([category, title, icon, key, numberKey]) => <OfficialCard category={category} title={title} icon={icon} document={official[key]} numberKey={numberKey} onUpload={() => setModal({ type: 'official', category })} key={category} />)}{(official.land || []).map(record => <article className="doc-card" key={record.id}><div className="doc-header"><div className="doc-title">Land Record</div><i className="fas fa-landmark doc-icon" /></div><div className="doc-body"><p><strong>Khatian:</strong> {record.khatian_no || 'N/A'}</p><p><strong>Dag No:</strong> {record.dag_no || 'N/A'}</p><p><strong>Area:</strong> {record.land_size || 0} Acres</p></div><div className="btn-group"><button className="btn-sm btn-view" type="button" onClick={() => setModal({ type: 'land', record })}>View Details</button></div></article>)}</div>
        <div className="react-section-heading"><div><h2>My Personal Documents</h2><p>PDF and image files, up to 5MB.</p></div><button className="btn-primary" type="button" onClick={() => setModal({ type: 'personal' })}><i className="fas fa-plus" /> Add New</button></div>
        <div className="doc-grid react-doc-grid">{personal.map(document => <article className="doc-card" key={document.id}><div className="doc-header"><div className="doc-title">{document.doc_name}</div><i className={`fas ${document.doc_type === 'PDF' ? 'fa-file-pdf' : 'fa-image'} doc-icon`} /></div><div className="doc-body"><p><strong>Type:</strong> {document.doc_type}</p><p><strong>Uploaded:</strong> {new Date(document.created_at).toLocaleDateString()}</p><span className={`status-badge react-status ${String(document.status).toLowerCase()}`}>{document.status}</span></div><div className="btn-group"><a className="btn-sm btn-view" href={resolveAssetUrl(document.file_path)} target="_blank" rel="noreferrer">View</a><button className="btn-sm btn-renew" type="button" onClick={() => setModal({ type: 'personal', document })}>Edit / Re-upload</button></div></article>)}{!personal.length && <p className="react-empty-state">No personal documents uploaded yet.</p>}</div>
      </>}
      {modal?.type === 'personal' && <Modal title={modal.document ? 'Edit Document' : 'Upload Document'} onClose={() => setModal(null)}><form className="react-form-stack" onSubmit={uploadPersonal}><label>Document Type<select name="docType" defaultValue={modal.document?.doc_type || 'Picture'} required><option>Picture</option><option>PDF</option><option>Other</option></select></label><label>Document Name<input name="docName" defaultValue={modal.document?.doc_name || ''} required /></label><label>File<input name="document" type="file" accept=".pdf,.jpg,.jpeg,.png" required={!modal.document} /></label><button className="btn-primary" disabled={submitting} type="submit">{submitting ? 'Processing…' : modal.document ? 'Update' : 'Upload'}</button></form></Modal>}
      {modal?.type === 'official' && <Modal title={`Add ${modal.category}`} onClose={() => setModal(null)}><form className="react-form-stack" onSubmit={uploadOfficial}><label>Identity Number<input name="identityNumber" required /></label><label>PDF or Image<input name="document" type="file" accept=".pdf,.jpg,.jpeg,.png" required /></label><button className="btn-primary" disabled={submitting} type="submit">{submitting ? 'Uploading…' : 'Upload for Verification'}</button></form></Modal>}
      {modal?.type === 'land' && <Modal title="Land Record Details" onClose={() => setModal(null)}><div className="react-detail-grid">{Object.entries({ Division: modal.record.division, District: modal.record.district, Upazila: modal.record.upazila, Mouza: modal.record.mouza, 'Khatian No': modal.record.khatian_no, 'Dag No': modal.record.dag_no, 'JL No': modal.record.jl_no, 'Hold No': modal.record.hold_no, 'Land Size': `${modal.record.land_size || 0} Acres`, Price: modal.record.land_price, 'Deed No': modal.record.deed_no, Owner: modal.record.owner_name }).map(([label, value]) => <p key={label}><strong>{label}</strong>{value || 'N/A'}</p>)}</div></Modal>}
    </CitizenShell>
  );
}

function OfficialCard({ category, title, icon, document, numberKey, onUpload }) {
  const expiry = document?.expiry_date && document.expiry_date !== 'Valid' ? new Date(document.expiry_date) : null;
  const expired = expiry && !Number.isNaN(expiry.getTime()) && expiry < new Date();
  const status = expired ? 'Expired' : document?.status || 'Active';
  return <article className={`doc-card ${document ? '' : 'react-empty-doc'}`}><div className="doc-header"><div className="doc-title">{title}</div><i className={`fas fa-${icon} doc-icon`} /></div><div className="doc-body">{document ? <><p><strong>Number:</strong> {document[numberKey] || 'N/A'}</p>{expiry && <p><strong>Expiry:</strong> {expiry.toLocaleDateString()}</p>}<span className={`status-badge react-status ${String(status).toLowerCase()}`}>{status}</span></> : <p>No {title} linked.</p>}</div><div className="btn-group">{document?.file_path && <a className="btn-sm btn-view" href={resolveAssetUrl(document.file_path)} target="_blank" rel="noreferrer">View</a>}<button className="btn-sm btn-renew" type="button" onClick={onUpload}>{document ? 'Edit / Re-upload' : `Add ${category}`}</button></div></article>;
}
