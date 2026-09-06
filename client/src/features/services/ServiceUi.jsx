import { useState } from 'react';
import { apiRequest } from '../../services/api.js';

export function StatusBadge({ value }) {
  return <span className={`react-status ${String(value || 'Pending').toLowerCase().replace(/\s+/g, '-')}`}>{value || 'Pending'}</span>;
}

export function EmptyRow({ columns, children }) {
  return <tr><td className="react-empty-state" colSpan={columns}>{children}</td></tr>;
}

export function LocationFields({ apiBase, divisions, names = { division: 'division', district: 'district', upazila: 'upazila' }, required = true, requireUpazila = true }) {
  const [districts, setDistricts] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [error, setError] = useState('');

  async function divisionChanged(event) {
    const division = divisions.find(row => row.name === event.target.value);
    setDistricts([]);
    setUpazilas([]);
    setError('');
    if (!division) return;
    try {
      const rows = await apiRequest(`${apiBase}/locations/districts/${division.id}`);
      setDistricts(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function districtChanged(event) {
    const district = districts.find(row => row.name === event.target.value);
    setUpazilas([]);
    setError('');
    if (!district) return;
    try {
      const rows = await apiRequest(`${apiBase}/locations/upazilas/${district.id}`);
      setUpazilas(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <label>Division<select name={names.division} required={required} defaultValue="" onChange={divisionChanged}><option value="">Select division</option>{divisions.map(row => <option value={row.name} key={row.id}>{row.name}</option>)}</select></label>
      <label>District<select name={names.district} required={required} defaultValue="" onChange={districtChanged}><option value="">Select district</option>{districts.map(row => <option value={row.name} key={row.id}>{row.name}</option>)}</select></label>
      {requireUpazila && <label>Upazila<select name={names.upazila} required={required} defaultValue=""><option value="">Select upazila</option>{upazilas.map(row => <option value={row.name} key={row.id}>{row.name}</option>)}</select></label>}
      {error && <p className="react-inline-error" role="alert">Location error: {error}</p>}
    </>
  );
}

export function LocationIdFields({ apiBase, divisions, names = { division: 'division_id', district: 'district_id', upazila: 'upazila_id' }, required = true }) {
  const [districts, setDistricts] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [error, setError] = useState('');

  async function divisionChanged(event) {
    setDistricts([]); setUpazilas([]); setError('');
    if (!event.target.value) return;
    try { setDistricts(await apiRequest(`${apiBase}/locations/districts/${event.target.value}`)); }
    catch (requestError) { setError(requestError.message); }
  }

  async function districtChanged(event) {
    setUpazilas([]); setError('');
    if (!event.target.value) return;
    try { setUpazilas(await apiRequest(`${apiBase}/locations/upazilas/${event.target.value}`)); }
    catch (requestError) { setError(requestError.message); }
  }

  return <>
    <label>Division<select name={names.division} required={required} defaultValue="" onChange={divisionChanged}><option value="">Select division</option>{divisions.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label>
    <label>District<select name={names.district} required={required} defaultValue="" onChange={districtChanged}><option value="">Select district</option>{districts.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label>
    <label>Upazila<select name={names.upazila} required={required} defaultValue=""><option value="">Select upazila</option>{upazilas.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label>
    {error && <p className="react-inline-error" role="alert">Location error: {error}</p>}
  </>;
}

export function formPayload(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function dateText(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-GB');
}
