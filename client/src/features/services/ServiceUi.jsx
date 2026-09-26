import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api.js';

export function StatusBadge({ value }) {
  return <span className={`react-status ${String(value || 'Pending').toLowerCase().replace(/\s+/g, '-')}`}>{value || 'Pending'}</span>;
}

export function EmptyRow({ columns, children }) {
  return <tr><td className="react-empty-state" colSpan={columns}>{children}</td></tr>;
}

export function locationLabel(row) {
  if (!row) return '';
  return row.name_bn ? `${row.name_bn} (${row.name})` : row.name;
}

export function officialLocations(rows = []) {
  const official = rows.filter(row => row.geo_code);
  return official.length ? official : rows;
}

export function LocationFields({ apiBase, divisions, names = { division: 'division', district: 'district', upazila: 'upazila' }, required = true, requireUpazila = true }) {
  const [divisionValue, setDivisionValue] = useState('');
  const [districtValue, setDistrictValue] = useState('');
  const [upazilaValue, setUpazilaValue] = useState('');
  const [districts, setDistricts] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingUpazilas, setLoadingUpazilas] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (divisionValue && !divisions.some(row => row.name === divisionValue)) {
      setDivisionValue(''); setDistrictValue(''); setUpazilaValue(''); setDistricts([]); setUpazilas([]);
    }
  }, [divisionValue, divisions]);

  async function divisionChanged(event) {
    const nextValue = event.target.value;
    const division = divisions.find(row => row.name === nextValue);
    setDivisionValue(nextValue);
    setDistrictValue('');
    setUpazilaValue('');
    setDistricts([]);
    setUpazilas([]);
    setError('');
    if (!division) return;
    setLoadingDistricts(true);
    try {
      const rows = await apiRequest(`${apiBase}/locations/districts/${division.id}`);
      setDistricts(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingDistricts(false);
    }
  }

  async function districtChanged(event) {
    const nextValue = event.target.value;
    const district = districts.find(row => row.name === nextValue);
    setDistrictValue(nextValue);
    setUpazilaValue('');
    setUpazilas([]);
    setError('');
    if (!district) return;
    setLoadingUpazilas(true);
    try {
      const rows = await apiRequest(`${apiBase}/locations/upazilas/${district.id}`);
      setUpazilas(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingUpazilas(false);
    }
  }

  return (
    <>
      <label>Division<select name={names.division} required={required} value={divisionValue} onChange={divisionChanged} disabled={!divisions.length}><option value="">{divisions.length ? 'Select division' : 'Loading divisions…'}</option>{officialLocations(divisions).map(row => <option value={row.name} key={row.id}>{locationLabel(row)}</option>)}</select></label>
      <label>District<select name={names.district} required={required} value={districtValue} onChange={districtChanged} disabled={!divisionValue || loadingDistricts}><option value="">{loadingDistricts ? 'Loading districts…' : 'Select district'}</option>{districts.map(row => <option value={row.name} key={row.id}>{locationLabel(row)}</option>)}</select></label>
      {requireUpazila && <label>Upazila<select name={names.upazila} required={required} value={upazilaValue} onChange={event => setUpazilaValue(event.target.value)} disabled={!districtValue || loadingUpazilas}><option value="">{loadingUpazilas ? 'Loading upazilas…' : 'Select upazila'}</option>{upazilas.map(row => <option value={row.name} key={row.id}>{locationLabel(row)}</option>)}</select></label>}
      {error && <p className="react-inline-error" role="alert">Location error: {error}</p>}
    </>
  );
}

export function LocationIdFields({ apiBase, divisions, names = { division: 'division_id', district: 'district_id', upazila: 'upazila_id' }, required = true }) {
  const [divisionId, setDivisionId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [upazilaId, setUpazilaId] = useState('');
  const [districts, setDistricts] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingUpazilas, setLoadingUpazilas] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (divisionId && !divisions.some(row => String(row.id) === divisionId)) {
      setDivisionId(''); setDistrictId(''); setUpazilaId(''); setDistricts([]); setUpazilas([]);
    }
  }, [divisionId, divisions]);

  async function divisionChanged(event) {
    const nextId = event.target.value;
    setDivisionId(nextId); setDistrictId(''); setUpazilaId('');
    setDistricts([]); setUpazilas([]); setError('');
    if (!nextId) return;
    setLoadingDistricts(true);
    try {
      const rows = await apiRequest(`${apiBase}/locations/districts/${nextId}`);
      setDistricts(Array.isArray(rows) ? rows : []);
    }
    catch (requestError) { setError(requestError.message); }
    finally { setLoadingDistricts(false); }
  }

  async function districtChanged(event) {
    const nextId = event.target.value;
    setDistrictId(nextId); setUpazilaId('');
    setUpazilas([]); setError('');
    if (!nextId) return;
    setLoadingUpazilas(true);
    try {
      const rows = await apiRequest(`${apiBase}/locations/upazilas/${nextId}`);
      setUpazilas(Array.isArray(rows) ? rows : []);
    }
    catch (requestError) { setError(requestError.message); }
    finally { setLoadingUpazilas(false); }
  }

  return <>
    <label>Division<select name={names.division} required={required} value={divisionId} onChange={divisionChanged} disabled={!divisions.length}><option value="">{divisions.length ? 'Select division' : 'Loading divisions…'}</option>{officialLocations(divisions).map(row => <option value={row.id} key={row.id}>{locationLabel(row)}</option>)}</select></label>
    <label>District<select name={names.district} required={required} value={districtId} onChange={districtChanged} disabled={!divisionId || loadingDistricts}><option value="">{loadingDistricts ? 'Loading districts…' : 'Select district'}</option>{districts.map(row => <option value={row.id} key={row.id}>{locationLabel(row)}</option>)}</select></label>
    <label>Upazila<select name={names.upazila} required={required} value={upazilaId} onChange={event => setUpazilaId(event.target.value)} disabled={!districtId || loadingUpazilas}><option value="">{loadingUpazilas ? 'Loading upazilas…' : 'Select upazila'}</option>{upazilas.map(row => <option value={row.id} key={row.id}>{locationLabel(row)}</option>)}</select></label>
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

export function bdt(value) {
  return `BDT ${Number(value || 0).toLocaleString()}`;
}
