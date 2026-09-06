import { useState } from 'react';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';

const departments = [
  'Cabinet Division', 'Ministry of Education', 'Ministry of Health',
  'Ministry of Land', 'National Board of Revenue', 'Election Commission', 'Other'
];

const hotlines = [['৯৯৯', 'জরুরি সেবা'], ['৩৩৩', 'জাতীয় হেল্পলাইন'], ['১০৬', 'দুর্নীতি দমন'], ['১০৯', 'নারী ও শিশু'], ['১৬২৬৩', 'স্বাস্থ্য বাতায়ন'], ['১৬১২৩', 'কৃষি কল সেন্টার']];

export default function ContactPage() {
  const [form, setForm] = useState({ department: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState(null);
  const [error, setError] = useState('');

  function update(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await apiRequest('/api/contact', { method: 'POST', body: form });
      setTicketId(data.ticketId);
      setForm({ department: '', subject: '', message: '' });
      await alerts.success('বার্তা সফলভাবে পাঠানো হয়েছে!', `Ticket #${data.ticketId}`);
    } catch (requestError) {
      setError(requestError.message);
      await alerts.error(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CitizenShell>
      <header className="react-page-header"><div><h1>যোগাযোগ করুন</h1><p>Central Government Citizen Support</p></div></header>
      {ticketId && <div className="react-success-banner" role="status">Your message was recorded as ticket #{ticketId}.</div>}
      <div className="react-two-column">
        <section className="react-panel"><h2><i className="fas fa-paper-plane" /> Send a Message</h2>{error && <div className="react-dashboard-error" role="alert">{error}</div>}
          <form className="react-form-stack" onSubmit={submit}>
            <label>Department<select name="department" value={form.department} onChange={update} required><option value="">Select department</option>{departments.map(department => <option value={department} key={department}>{department}</option>)}</select></label>
            <label>Subject<input name="subject" value={form.subject} onChange={update} required /></label>
            <label>Message<textarea name="message" rows="7" value={form.message} onChange={update} required /></label>
            <button className="btn-primary" disabled={submitting} type="submit"><i className={`fas ${submitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} /> {submitting ? 'Sending…' : 'Send Message'}</button>
          </form>
        </section>
        <aside className="react-panel"><h2><i className="fas fa-phone-alt" /> জরুরি হটলাইন</h2><div className="react-hotline-grid">{hotlines.map(([number, label]) => <div key={number}><strong>{number}</strong><span>{label}</span></div>)}</div>
          <h3>বাংলাদেশ সচিবালয়</h3><p>আব্দুল গণি রোড, রমনা<br />ঢাকা-১০০০, বাংলাদেশ</p><p>info@gov.bd</p>
          <div className="react-link-list"><a href="https://bangladesh.gov.bd" target="_blank" rel="noreferrer">জাতীয় তথ্য বাতায়ন</a><a href="https://moedu.gov.bd" target="_blank" rel="noreferrer">শিক্ষা মন্ত্রণালয়</a><a href="https://minland.gov.bd" target="_blank" rel="noreferrer">ভূমি মন্ত্রণালয়</a><a href="https://epassport.gov.bd" target="_blank" rel="noreferrer">ই-পাসপোর্ট সেবা</a></div>
        </aside>
      </div>
    </CitizenShell>
  );
}
