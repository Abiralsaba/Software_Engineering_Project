import { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { serviceCategories, serviceTypes } from './serviceTypes.js';

const initialForm = {
  category: '', subCategory: '', uniqueId: '', evidenceLink: '', description: ''
};

export default function ServiceRequestModal({ onClose, onSubmitted }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function update(event) {
    const { name, value } = event.target;
    setForm(current => ({
      ...current,
      [name]: value,
      ...(name === 'category' ? { subCategory: '' } : {})
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/api/dashboard/services/request', {
        method: 'POST',
        body: {
          category: form.category,
          subCategory: `req_${form.subCategory}`,
          uniqueId: form.uniqueId,
          evidenceLink: form.evidenceLink,
          description: form.description
        }
      });
      await alerts.success('Request Submitted', 'Your request has been filed successfully.');
      onSubmitted();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
      await alerts.error(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New Service Request" onClose={onClose}>
      {error && <div className="react-dashboard-error" role="alert">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-group"><label htmlFor="service-category">Category</label><select id="service-category" name="category" className="form-control" value={form.category} onChange={update} required><option value="">Select Category</option>{serviceCategories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
        <div className="form-group"><label htmlFor="service-subtype">Service Type</label><select id="service-subtype" name="subCategory" className="form-control" value={form.subCategory} onChange={update} disabled={!form.category} required><option value="">Select Service Type</option>{(serviceTypes[form.category] || []).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
        <div className="form-group"><label htmlFor="service-id">Unique Number / ID</label><input id="service-id" name="uniqueId" className="form-control" value={form.uniqueId} onChange={update} required /></div>
        <div className="form-group"><label htmlFor="service-evidence">Evidence (Google Drive Link)</label><input id="service-evidence" name="evidenceLink" type="url" className="form-control" value={form.evidenceLink} onChange={update} placeholder="https://drive.google.com/…" required /></div>
        <div className="form-group"><label htmlFor="service-description">Description & Requirements</label><textarea id="service-description" name="description" className="form-control" rows="4" value={form.description} onChange={update} required /></div>
        <div className="modal-footer"><button className="btn-secondary" type="button" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={submitting} type="submit">{submitting ? 'Sending…' : 'Submit Request'}</button></div>
      </form>
    </Modal>
  );
}
