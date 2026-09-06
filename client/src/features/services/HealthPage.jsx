import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { dateText, EmptyRow, formPayload, LocationFields, StatusBadge } from './ServiceUi.jsx';
import MedicineIdentifier from './MedicineIdentifier.jsx';

const API = '/api/health';
const sections = ['overview', 'health-card', 'vaccination', 'hospitals', 'appointments', 'ambulance', 'complaints', 'medicine-identifier'];
const vaccineTypes = ['COVID-19', 'Hepatitis B', 'BCG', 'Polio', 'DPT', 'Measles', 'TT', 'Pneumococcal', 'Influenza', 'Rabies', 'Typhoid', 'Cholera', 'Other'];
const departments = ['Medicine', 'Surgery', 'Gynecology', 'Pediatrics', 'Orthopedics', 'ENT', 'Eye', 'Dermatology', 'Cardiology', 'Neurology', 'Psychiatry', 'Dental', 'Emergency', 'Other'];

function toOptional(value) {
  return value === '' ? null : value;
}

export function healthPayload(kind, form) {
  const values = formPayload(form);
  if (kind === 'card') return { ...values, disability: values.disability || 'None' };
  if (kind === 'vaccine') return {
    vaccine_type: values.vaccine_type,
    vaccine_name: values.vaccine_name,
    dose_number: values.dose_number,
    vaccination_date: toOptional(values.vaccination_date),
    vaccination_center: toOptional(values.vaccination_center)
  };
  if (kind === 'appointment') return {
    hospital_id: toOptional(values.hospital_id), patient_name: values.patient_name,
    patient_age: toOptional(values.patient_age), patient_gender: toOptional(values.patient_gender),
    phone: values.phone, department: values.department, doctor_name: toOptional(values.doctor_name),
    appointment_date: values.appointment_date, appointment_time: toOptional(values.appointment_time),
    symptoms: toOptional(values.symptoms), urgency: values.urgency
  };
  if (kind === 'ambulance') return {
    patient_name: values.patient_name, phone: values.phone, emergency_type: values.emergency_type,
    division: values.division, district: values.district, pickup_address: values.pickup_address,
    destination_hospital: toOptional(values.destination_hospital), urgency: values.urgency,
    ambulance_type: values.ambulance_type
  };
  return {
    complaint_type: values.complaint_type, hospital_name: toOptional(values.hospital_name),
    division: toOptional(values.division), district: toOptional(values.district),
    description: values.description
  };
}

function TableShell({ children }) {
  return <div className="react-table-wrap"><table>{children}</table></div>;
}

export default function HealthPage() {
  const [params, setParams] = useSearchParams();
  const requestedSection = params.get('section');
  const [section, setSectionState] = useState(sections.includes(requestedSection) ? requestedSection : 'overview');
  const [data, setData] = useState({ stats: {}, activity: [], divisions: [], cards: [], vaccines: [], hospitals: [], appointments: [], ambulances: [], complaints: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [hospitalType, setHospitalType] = useState('');
  const { submitting, runLocked } = useSubmissionLock();

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [stats, activity, divisions, cards, vaccines, hospitals, appointments, ambulances, complaints] = await Promise.all([
        apiRequest(`${API}/my-stats`), apiRequest(`${API}/my-activity`), apiRequest(`${API}/locations/divisions`),
        apiRequest(`${API}/health-card/my`), apiRequest(`${API}/vaccination/my`), apiRequest(`${API}/hospitals`),
        apiRequest(`${API}/appointment/my`), apiRequest(`${API}/ambulance/my`), apiRequest(`${API}/complaint/my`)
      ]);
      setData({ stats: stats || {}, activity: activity || [], divisions: divisions || [], cards: cards || [], vaccines: vaccines || [], hospitals: hospitals || [], appointments: appointments || [], ambulances: ambulances || [], complaints: complaints || [] });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  function setSection(next) {
    setSectionState(next);
    const nextParams = new URLSearchParams(params);
    if (next === 'overview') nextParams.delete('section'); else nextParams.set('section', next);
    setParams(nextParams, { replace: true });
  }

  async function submit(event, kind, path) {
    event.preventDefault();
    const form = event.currentTarget;
    await runLocked(async () => {
      setError('');
      try {
        const response = await apiRequest(`${API}${path}`, { method: 'POST', body: healthPayload(kind, form) });
        form.reset();
        await alerts.success('Submitted', response.message || 'Request submitted successfully.');
        await loadAll();
      } catch (requestError) {
        setError(requestError.message);
        await alerts.error(requestError.message);
      }
    });
  }

  async function cancelAppointment(id) {
    await runLocked(async () => {
      try {
        await apiRequest(`${API}/appointment/cancel/${id}`, { method: 'PUT', body: {} });
        await loadAll();
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }

  const visibleHospitals = useMemo(() => data.hospitals.filter(row => {
    const term = hospitalSearch.trim().toLowerCase();
    return (!hospitalType || row.hospital_type === hospitalType)
      && (!term || String(row.name).toLowerCase().includes(term) || String(row.name_bn || '').toLowerCase().includes(term));
  }), [data.hospitals, hospitalSearch, hospitalType]);

  return (
    <CitizenShell>
      <header className="react-page-header"><div><h1>Health Services</h1><p>Health cards, vaccination, hospitals, appointments, ambulance, complaints, and medicine identification.</p></div><a className="btn-secondary react-auto-width" href="tel:999">Emergency 999</a></header>
      <nav className="react-service-tabs" aria-label="Health sections">{sections.map(value => <button type="button" className={section === value ? 'active' : ''} onClick={() => setSection(value)} key={value}>{value.replace('-', ' ')}</button>)}</nav>
      {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={loadAll}>Retry</button></div>}
      {loading ? <p className="react-empty-state">Loading health services…</p> : <>
        {section === 'overview' && <><div className="react-service-stats">{[['Health cards', data.stats.health_cards], ['Vaccinations', data.stats.vaccinations], ['Appointments', data.stats.appointments], ['Ambulance', data.stats.ambulance_requests], ['Complaints', data.stats.complaints]].map(([label, value]) => <article className="react-panel" key={label}><strong>{value || 0}</strong><span>{label}</span></article>)}</div><section className="react-panel"><h2>Recent activity</h2><div className="react-card-list">{data.activity.map((row, index) => <article key={`${row.type}-${row.created_at}-${index}`}><div><h3>{row.type}</h3><p>{dateText(row.created_at)}</p></div><StatusBadge value={row.status} /></article>)}{!data.activity.length && <p className="react-empty-state">No recent activity.</p>}</div></section></>}

        {section === 'health-card' && <div className="react-two-column"><section className="react-panel"><h2>Apply for health card</h2><form className="react-form-stack" onSubmit={event => submit(event, 'card', '/health-card/apply')}><div className="react-form-grid"><label>Full name<input name="full_name" required /></label><label>Father name<input name="father_name" /></label><label>Mother name<input name="mother_name" /></label><label>NID number<input name="nid_number" required /></label><label>Date of birth<input name="date_of_birth" type="date" required /></label><label>Gender<select name="gender" required defaultValue=""><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></label><label>Blood group<select name="blood_group" defaultValue=""><option value="">Select</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(value => <option key={value}>{value}</option>)}</select></label><label>Phone<input name="phone" required /></label><label>Emergency contact<input name="emergency_contact" /></label><LocationFields apiBase={API} divisions={data.divisions} /><label>Disability<select name="disability" defaultValue="None">{['None', 'Physical', 'Visual', 'Hearing', 'Intellectual', 'Multiple'].map(value => <option key={value}>{value}</option>)}</select></label></div><label>Address<textarea name="address" rows="2" /></label><label>Allergies<input name="allergies" /></label><label>Chronic diseases<input name="chronic_diseases" /></label><button className="btn-primary" disabled={submitting} type="submit">{submitting ? 'Submitting…' : 'Submit application'}</button></form></section><section className="react-panel"><h2>My health cards</h2><div className="react-card-list">{data.cards.map(card => <article key={card.id}><div><h3>{card.card_number}</h3><p>{card.full_name} · NID {card.nid_number}</p><p>{card.district}, {card.division} · {dateText(card.created_at)}</p>{card.admin_remarks && <p>Admin: {card.admin_remarks}</p>}</div><StatusBadge value={card.status} /></article>)}{!data.cards.length && <p className="react-empty-state">No health card application.</p>}</div></section></div>}

        {section === 'vaccination' && <div className="react-two-column"><section className="react-panel"><h2>Register vaccination</h2><form className="react-form-stack" onSubmit={event => submit(event, 'vaccine', '/vaccination/register')}><label>Vaccine type<select name="vaccine_type" required defaultValue=""><option value="">Select</option>{vaccineTypes.map(value => <option key={value}>{value}</option>)}</select></label><label>Vaccine name<input name="vaccine_name" required /></label><label>Dose number<select name="dose_number" defaultValue="1">{[1, 2, 3, 4].map(value => <option key={value}>{value}</option>)}</select></label><label>Vaccination date<input name="vaccination_date" type="date" /></label><label>Vaccination center<input name="vaccination_center" /></label><button className="btn-primary" disabled={submitting} type="submit">Register</button></form></section><section className="react-panel"><h2>Vaccination history</h2><TableShell><thead><tr><th>Vaccine</th><th>Dose</th><th>Date</th><th>Status</th></tr></thead><tbody>{data.vaccines.map(row => <tr key={row.id}><td>{row.vaccine_name}<small className="react-block">{row.vaccine_type}</small></td><td>{row.dose_number}</td><td>{dateText(row.vaccination_date)}</td><td><StatusBadge value={row.status} /></td></tr>)}{!data.vaccines.length && <EmptyRow columns={4}>No vaccination records.</EmptyRow>}</tbody></TableShell></section></div>}

        {section === 'hospitals' && <section className="react-panel"><div className="react-section-heading"><div><h2>Hospital directory</h2><p>{visibleHospitals.length} active facilities</p></div></div><div className="react-filter-grid"><label>Search<input aria-label="Search hospitals" value={hospitalSearch} onChange={event => setHospitalSearch(event.target.value)} /></label><label>Type<select aria-label="Hospital type" value={hospitalType} onChange={event => setHospitalType(event.target.value)}><option value="">All types</option>{[...new Set(data.hospitals.map(row => row.hospital_type))].map(value => <option key={value}>{value}</option>)}</select></label></div><div className="react-service-card-grid">{visibleHospitals.map(row => <article key={row.id}><h3>{row.name}</h3>{row.name_bn && <p>{row.name_bn}</p>}<p>{row.hospital_type} · {row.district}, {row.division}</p><p>{row.available_beds}/{row.total_beds} beds · {row.available_icu_beds}/{row.icu_beds} ICU</p>{row.phone && <a href={`tel:${row.phone}`}>{row.phone}</a>}</article>)}{!visibleHospitals.length && <p className="react-empty-state">No hospitals found.</p>}</div></section>}

        {section === 'appointments' && <div className="react-two-column"><section className="react-panel"><h2>Book appointment</h2><form className="react-form-stack" onSubmit={event => submit(event, 'appointment', '/appointment/book')}><label>Patient name<input name="patient_name" required /></label><div className="react-form-grid"><label>Age<input name="patient_age" type="number" min="0" max="150" /></label><label>Gender<select name="patient_gender" defaultValue=""><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></label><label>Phone<input name="phone" required /></label><label>Hospital<select name="hospital_id" defaultValue=""><option value="">Select</option>{data.hospitals.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label><label>Department<select name="department" required defaultValue=""><option value="">Select</option>{departments.map(value => <option key={value}>{value}</option>)}</select></label><label>Doctor<input name="doctor_name" /></label><label>Date<input name="appointment_date" type="date" required /></label><label>Time<input name="appointment_time" type="time" /></label><label>Urgency<select name="urgency" defaultValue="Normal"><option>Normal</option><option>Urgent</option><option>Emergency</option></select></label></div><label>Symptoms<textarea name="symptoms" rows="2" /></label><button className="btn-primary" disabled={submitting} type="submit">Book appointment</button></form></section><section className="react-panel"><h2>My appointments</h2><div className="react-card-list">{data.appointments.map(row => <article key={row.id}><div><h3>{row.hospital_name || 'Hospital pending'} — {row.department}</h3><p>{dateText(row.appointment_date)} {row.appointment_time || ''}</p><p>{row.patient_name} · {row.urgency}</p>{row.prescription && <pre className="react-safe-text">{row.prescription}</pre>}</div><div><StatusBadge value={row.status} />{row.status === 'Pending' && <button className="btn-danger react-service-action" disabled={submitting} type="button" onClick={() => cancelAppointment(row.id)}>Cancel</button>}</div></article>)}{!data.appointments.length && <p className="react-empty-state">No appointments.</p>}</div></section></div>}

        {section === 'ambulance' && <div className="react-two-column"><section className="react-panel"><h2>Request ambulance</h2><form className="react-form-stack" onSubmit={event => submit(event, 'ambulance', '/ambulance/request')}><label>Patient name<input name="patient_name" required /></label><label>Phone<input name="phone" required /></label><label>Emergency type<select name="emergency_type" required defaultValue=""><option value="">Select</option>{['Accident', 'Heart Attack', 'Stroke', 'Pregnancy', 'Burns', 'Breathing Difficulty', 'Unconscious', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><LocationFields apiBase={API} divisions={data.divisions} requireUpazila={false} /><label>Pickup address<textarea name="pickup_address" required /></label><label>Destination hospital<input name="destination_hospital" /></label><label>Urgency<select name="urgency" defaultValue="Urgent"><option>Normal</option><option>Urgent</option><option>Critical</option></select></label><label>Ambulance type<select name="ambulance_type" defaultValue="Basic"><option>Basic</option><option>Advanced</option><option>ICU</option></select></label><button className="btn-primary" disabled={submitting} type="submit">Request ambulance</button></form></section><section className="react-panel"><h2>My ambulance requests</h2><div className="react-card-list">{data.ambulances.map(row => <article key={row.id}><div><h3>{row.patient_name} — {row.emergency_type}</h3><p>{row.district}, {row.division} · {dateText(row.created_at)}</p></div><StatusBadge value={row.status} /></article>)}{!data.ambulances.length && <p className="react-empty-state">No ambulance requests.</p>}</div></section></div>}

        {section === 'complaints' && <div className="react-two-column"><section className="react-panel"><h2>Submit health complaint</h2><form className="react-form-stack" onSubmit={event => submit(event, 'complaint', '/complaint/submit')}><label>Complaint type<select name="complaint_type" required defaultValue=""><option value="">Select</option>{['Hospital Service', 'Doctor Conduct', 'Medicine Quality', 'Ambulance Delay', 'Corruption', 'Unsanitary Conditions', 'Staff Behavior', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><label>Hospital name<input name="hospital_name" /></label><LocationFields apiBase={API} divisions={data.divisions} required={false} requireUpazila={false} /><label>Description<textarea name="description" rows="4" required /></label><button className="btn-primary" disabled={submitting} type="submit">Submit complaint</button></form></section><section className="react-panel"><h2>My complaints</h2><div className="react-card-list">{data.complaints.map(row => <article key={row.id}><div><h3>{row.complaint_type}</h3><p>{row.hospital_name || 'General complaint'} · {dateText(row.created_at)}</p>{row.resolution && <p>{row.resolution}</p>}</div><StatusBadge value={row.status} /></article>)}{!data.complaints.length && <p className="react-empty-state">No complaints.</p>}</div></section></div>}
        {section === 'medicine-identifier' && <MedicineIdentifier />}
      </>}
    </CitizenShell>
  );
}
