import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import NidPage, { addressFormData } from './services/NidPage.jsx';
import PassportPage, { passportApplicationPayload } from './services/PassportPage.jsx';

vi.mock('../services/api.js', async importOriginal => {
  const original = await importOriginal();
  return { ...original, apiRequest: vi.fn() };
});
vi.mock('../utils/alerts.js', () => ({ alerts: { success: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) } }));

function renderCitizen(element, path) {
  localStorage.setItem('token', 'signed-token');
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider>{element}</AuthProvider></MemoryRouter>);
}

function emptyNid(path) {
  if (path === '/api/user/profile') return Promise.resolve({ name: 'Synthetic Citizen', nid: '99900000000000001' });
  if (path === '/api/nid/dashboard') return Promise.resolve({ profile: { nid_number: '99900000000000001', name_en: 'Synthetic Citizen', profile_status: 'Pending' }, stats: {}, recentApplications: [] });
  if (path === '/api/nid/profile') return Promise.resolve({ exists: false, based_on_registration: { nid_number: '99900000000000001', name_en: 'Synthetic Citizen', date_of_birth: '1990-01-01' } });
  if (path === '/api/nid/locations/divisions') return Promise.resolve([{ id: 1, name: 'DEMO Division' }]);
  return Promise.resolve([]);
}

function emptyPassport(path) {
  if (path === '/api/user/profile') return Promise.resolve({ name: 'Synthetic Citizen', nid: '99900000000000001' });
  if (path === '/api/passport/stats') return Promise.resolve({});
  if (path === '/api/passport/locations/divisions') return Promise.resolve([{ id: 1, name: 'DEMO Division' }]);
  return Promise.resolve([]);
}

beforeEach(() => apiRequest.mockReset());

describe('NID React service page', () => {
  it('preserves correction multipart fields and locks duplicate submissions', async () => {
    let resolveSubmit;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/nid/corrections' && options?.method === 'POST') return new Promise(resolve => { resolveSubmit = resolve; });
      return emptyNid(path);
    });
    const user = userEvent.setup();
    renderCitizen(<NidPage />, '/nid.html?section=correction');
    await screen.findByRole('heading', { name: 'Submit correction' });
    await user.clear(screen.getByLabelText('NID number'));
    await user.type(screen.getByLabelText('NID number'), '99900000000000001');
    await user.type(screen.getByLabelText('Current value'), 'Old value');
    await user.type(screen.getByLabelText('Corrected value'), 'Correct value');
    const file = new File(['synthetic'], 'proof.png', { type: 'image/png' });
    const upload = screen.getByLabelText(/Supporting documents/);
    await user.upload(upload, file);
    expect(upload.files[0].name).toBe('proof.png');
    const form = screen.getByRole('button', { name: 'Submit correction' }).closest('form');
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/nid/corrections' && options?.method === 'POST')).toHaveLength(1));
    const body = apiRequest.mock.calls.find(([path, options]) => path === '/api/nid/corrections' && options?.method === 'POST')[1].body;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('nid_number')).toBe('99900000000000001');
    expect(body.get('correction_type')).toBe('Name');
    expect([...body.keys()]).toContain('documents');
    resolveSubmit({ success: true, referenceNumber: 'COR-2026-123456' });
  });

  it('adds supported ID fields while retaining legacy address aliases', () => {
    const form = document.createElement('form');
    for (const [name, value] of [['new_division_id', '1'], ['new_district_id', '11'], ['new_upazila_id', '111'], ['new_ward', '7'], ['new_house', '12'], ['change_reason', 'Moved']]) {
      const input = document.createElement('input'); input.name = name; input.value = value; form.append(input);
    }
    const body = addressFormData(form);
    expect(Object.fromEntries(body.entries())).toEqual(expect.objectContaining({ new_division_id: '1', new_division: '1', new_district_id: '11', new_district: '11', new_upazila_id: '111', new_upazila: '111', new_ward_no: '7', new_house_no: '12', reason: 'Moved' }));
  });

  it('renders stored application text safely and reports empty states', async () => {
    const malicious = '<img src=x onerror=bad()>';
    apiRequest.mockImplementation(path => path === '/api/nid/corrections'
      ? Promise.resolve([{ id: 8, request_no: malicious, status: 'Submitted', created_at: '2026-08-29' }])
      : emptyNid(path));
    renderCitizen(<NidPage />, '/nid.html?section=correction');
    expect(await screen.findByText(malicious)).toBeInTheDocument();
    expect(screen.queryByText('No correction requests.')).not.toBeInTheDocument();
    expect(document.querySelector('[onerror]')).toBeNull();
  });

  it('renders loading and API errors', async () => {
    let rejectDashboard;
    apiRequest.mockImplementation(path => path === '/api/nid/dashboard' ? new Promise((resolve, reject) => { rejectDashboard = reject; }) : emptyNid(path));
    renderCitizen(<NidPage />, '/nid.html');
    expect(screen.getByText('Loading NID services…')).toBeInTheDocument();
    rejectDashboard(new Error('NID API unavailable'));
    expect(await screen.findByRole('alert')).toHaveTextContent('NID API unavailable');
  });
});

describe('passport React service page', () => {
  it('preserves the complete JSON form contract and boolean address flag', () => {
    const form = document.createElement('form');
    for (const [name, value] of [['service_type', 'New'], ['passport_type', 'Ordinary'], ['page_count', '48'], ['validity_years', '5'], ['delivery_type', 'Regular'], ['full_name_en', 'Synthetic Citizen'], ['present_division', 'DEMO Division'], ['present_district', 'DEMO District'], ['mobile_number', '01700000000']]) {
      const input = document.createElement('input'); input.name = name; input.value = value; form.append(input);
    }
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = 'same_as_present'; checkbox.checked = true; form.append(checkbox);
    expect(passportApplicationPayload(form)).toEqual(expect.objectContaining({ service_type: 'New', passport_type: 'Ordinary', page_count: '48', validity_years: '5', delivery_type: 'Regular', full_name_en: 'Synthetic Citizen', present_division: 'DEMO Division', present_district: 'DEMO District', mobile_number: '01700000000', same_as_present: true }));
  });

  it('preserves all seven document multipart names and locks duplicate upload', async () => {
    let resolveSubmit;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/passport/my-applications') return Promise.resolve([{ id: 4, application_number: 'EP-DEMO', status: 'Submitted' }]);
      if (path === '/api/passport/upload-documents/4' && options?.method === 'POST') return new Promise(resolve => { resolveSubmit = resolve; });
      return emptyPassport(path);
    });
    const user = userEvent.setup();
    renderCitizen(<PassportPage />, '/passport.html?section=documents');
    await screen.findByRole('heading', { name: 'Upload application documents' });
    await user.selectOptions(screen.getByLabelText('Application'), '4');
    for (const label of ['Photo', 'NID scan', 'Birth certificate', 'Old passport', 'NOC', 'Affidavit', 'Additional document']) {
      await user.upload(screen.getByLabelText(label), new File(['demo'], label === 'Photo' ? 'photo.png' : `${label}.pdf`, { type: label === 'Photo' ? 'image/png' : 'application/pdf' }));
    }
    const form = screen.getByRole('button', { name: 'Upload selected files' }).closest('form');
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path]) => path === '/api/passport/upload-documents/4')).toHaveLength(1));
    const body = apiRequest.mock.calls.find(([path]) => path === '/api/passport/upload-documents/4')[1].body;
    expect([...body.keys()].sort()).toEqual(['additional_doc', 'affidavit', 'birth_cert', 'nid_scan', 'noc', 'old_passport_scan', 'photo']);
    resolveSubmit({ success: true, uploaded: ['photo'] });
  });

  it('does not trust payment return parameters and exposes only the labeled simulation', async () => {
    apiRequest.mockImplementation(emptyPassport);
    renderCitizen(<PassportPage />, '/passport.html?section=payment&status=success&tid=DEMO-TXN');
    expect(await screen.findByRole('status')).toHaveTextContent('Unverified payment return');
    expect(screen.getByRole('heading', { name: 'Passport payment demonstration' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('SIMULATED — NOT GATEWAY VERIFIED');
    expect(screen.queryByRole('button', { name: /pay now|initiate payment|continue to payment/i })).not.toBeInTheDocument();
  });

  it('renders API errors as text', async () => {
    apiRequest.mockImplementation(path => path === '/api/passport/stats' ? Promise.reject(new Error('<svg onload=bad()>')) : emptyPassport(path));
    renderCitizen(<PassportPage />, '/passport.html');
    expect(await screen.findByRole('alert')).toHaveTextContent('<svg onload=bad()>');
    expect(document.querySelector('[onload]')).toBeNull();
  });
});
