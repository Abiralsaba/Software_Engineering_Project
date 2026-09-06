import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import AgriculturePage from './services/AgriculturePage.jsx';
import LandPage from './services/LandPage.jsx';

vi.mock('../services/api.js', async importOriginal => {
  const original = await importOriginal();
  return { ...original, apiRequest: vi.fn() };
});
vi.mock('../utils/alerts.js', () => ({ alerts: { success: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) } }));

function renderCitizen(element, path) {
  localStorage.setItem('token', 'signed-token');
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider>{element}</AuthProvider></MemoryRouter>);
}

function common(path) {
  return path === '/api/user/profile' ? Promise.resolve({ name: 'Synthetic Citizen', nid: 'DEMO-NID' }) : null;
}

function emptyLand(path) {
  if (typeof path !== 'string') return Promise.resolve([]);
  if (common(path)) return common(path);
  if (path === '/api/departments/locations/divisions') return Promise.resolve([{ id: 1, name: 'DEMO Division' }]);
  return Promise.resolve([]);
}

function emptyAgriculture(path) {
  if (typeof path !== 'string') return Promise.resolve([]);
  if (common(path)) return common(path);
  if (path === '/api/agriculture/stats') return Promise.resolve({});
  if (path === '/api/agriculture/locations/divisions') return Promise.resolve([{ id: 1, name: 'DEMO Division' }]);
  return Promise.resolve([]);
}

beforeEach(() => {
  apiRequest.mockReset();
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: success => success({ coords: { latitude: 23.8, longitude: 90.4 } }) } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ daily: { time: ['2026-08-29'], temperature_2m_max: [31], temperature_2m_min: [25], precipitation_probability_max: [20] } }) }));
});

describe('land React service page', () => {
  it('does not trust payment return parameters and labels the isolated simulation', async () => {
    apiRequest.mockImplementation(emptyLand);
    renderCitizen(<LandPage />, '/land.html?section=tax&status=success&tid=DEMO-TXN');
    expect(await screen.findByRole('status')).toHaveTextContent('unverified');
    expect(screen.getByRole('alert')).toHaveTextContent('SIMULATED — NOT GATEWAY VERIFIED');
    expect(screen.queryByRole('button', { name: /Pay now|initiate payment/i })).not.toBeInTheDocument();
  });

  it('preserves mutation field names and locks duplicate submissions', async () => {
    let resolveSubmit;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/departments/locations/districts/1') return Promise.resolve([{ id: 11, name: 'DEMO District' }]);
      if (path === '/api/departments/locations/upazilas/11') return Promise.resolve([{ id: 111, name: 'DEMO Upazila' }]);
      if (path === '/api/departments/land/mutation_v2' && options?.method === 'POST') return new Promise(resolve => { resolveSubmit = resolve; });
      return emptyLand(path);
    });
    const user = userEvent.setup();
    renderCitizen(<LandPage />, '/land.html?section=mutation');
    await screen.findByRole('heading', { name: 'New mutation application' });
    await user.selectOptions(screen.getByLabelText('Division'), '1');
    await user.selectOptions(screen.getByLabelText('District'), '11');
    await user.selectOptions(screen.getByLabelText('Upazila'), '111');
    await user.type(screen.getByLabelText('Applicant/current owner NID'), '99900000000000001');
    await user.type(screen.getByLabelText('Khatian'), 'DEMO-K');
    await user.type(screen.getByLabelText('Dag'), 'DEMO-D');
    await user.type(screen.getByLabelText('Transfer amount'), '2.5');
    await user.type(screen.getByLabelText('Estimated price'), '5000');
    await user.type(screen.getByLabelText('Deed number'), 'DEMO-DEED');
    await user.type(screen.getByLabelText('Buyer NID'), '99900000000000002');
    const form = screen.getByRole('button', { name: 'Submit mutation' }).closest('form');
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/departments/land/mutation_v2' && options?.method === 'POST')).toHaveLength(1));
    const request = apiRequest.mock.calls.find(([path, options]) => path === '/api/departments/land/mutation_v2' && options?.method === 'POST')[1];
    expect(request.body).toEqual({ divId: '1', distId: '11', upaId: '111', appNid: '99900000000000001', khatian: 'DEMO-K', dag: 'DEMO-D', amount: '2.5', price: '5000', deed: 'DEMO-DEED', ownType: 'Own', buyerNid: '99900000000000002' });
    resolveSubmit({ success: true, trackingNumber: 'DEMO-TRACK' });
  });

  it('renders loading and API error states safely', async () => {
    let rejectRecords;
    apiRequest.mockImplementation(path => {
      if (common(path)) return common(path);
      if (path === '/api/departments/land/records') return new Promise((resolve, reject) => { rejectRecords = reject; });
      return Promise.resolve([]);
    });
    renderCitizen(<LandPage />, '/land.html');
    expect(screen.getByText('Loading land services…')).toBeInTheDocument();
    rejectRecords(new Error('<img src=x onerror=bad()>'));
    expect(await screen.findByRole('alert')).toHaveTextContent('<img src=x onerror=bad()>');
    expect(document.querySelector('[onerror]')).toBeNull();
  });
});

describe('agriculture React service page', () => {
  it('preserves the subsidy payload and locks duplicate submissions', async () => {
    let resolveSubmit;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/agriculture/locations/districts/1') return Promise.resolve([{ id: 11, name: 'DEMO District' }]);
      if (path === '/api/agriculture/locations/upazilas/11') return Promise.resolve([{ id: 111, name: 'DEMO Upazila' }]);
      if (path === '/api/agriculture/subsidy/apply' && options?.method === 'POST') return new Promise(resolve => { resolveSubmit = resolve; });
      return emptyAgriculture(path);
    });
    const user = userEvent.setup();
    renderCitizen(<AgriculturePage />, '/agriculture.html?section=subsidies');
    await screen.findByRole('heading', { name: 'Apply for subsidy' });
    await user.type(screen.getByLabelText('Farmer name'), 'Synthetic Farmer');
    await user.type(screen.getByLabelText('NID number'), '99900000000000001');
    await user.type(screen.getByLabelText('Phone'), '01700000000');
    await user.selectOptions(screen.getByLabelText('Subsidy type'), 'Seeds');
    await user.type(screen.getByLabelText('Amount requested'), '1000');
    await user.selectOptions(screen.getByLabelText('Division'), '1');
    await user.selectOptions(screen.getByLabelText('District'), '11');
    await user.selectOptions(screen.getByLabelText('Upazila'), '111');
    const form = screen.getByRole('button', { name: 'Submit subsidy application' }).closest('form');
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/agriculture/subsidy/apply' && options?.method === 'POST')).toHaveLength(1));
    const body = apiRequest.mock.calls.find(([path, options]) => path === '/api/agriculture/subsidy/apply' && options?.method === 'POST')[1].body;
    expect(body).toEqual(expect.objectContaining({ farmer_name: 'Synthetic Farmer', subsidy_type: 'Seeds', amount_requested: '1000', land_ownership: 'Own', division_id: '1', district_id: '11', upazila_id: '111' }));
    resolveSubmit({ success: true, message: 'submitted' });
  });

  it('renders market content as text and accurately labels pending listings', async () => {
    const malicious = '<img src=x onerror=bad()>';
    apiRequest.mockImplementation(path => {
      if (path === '/api/agriculture/market/browse') return Promise.resolve([{ id: 8, product_name: malicious, product_category: 'Rice', quantity: 2, unit: 'kg', price_per_unit: 10, farmer_name: malicious, phone: '017', status: 'Pending' }]);
      return emptyAgriculture(path);
    });
    renderCitizen(<AgriculturePage />, '/agriculture.html?section=market');
    expect((await screen.findAllByText(malicious)).length).toBeGreaterThan(0);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(document.querySelector('[onerror]')).toBeNull();
  });

  it('renders the forecast and empty activity state without legacy scripts', async () => {
    apiRequest.mockImplementation(emptyAgriculture);
    renderCitizen(<AgriculturePage />, '/agriculture.html');
    expect(await screen.findByText('31° / 25°')).toBeInTheDocument();
    expect(screen.getByText('No recent activity.')).toBeInTheDocument();
  });

  it('renders list API errors', async () => {
    apiRequest.mockImplementation(path => {
      if (common(path)) return common(path);
      if (path === '/api/agriculture/stats') return Promise.reject(new Error('Agriculture API unavailable'));
      return Promise.resolve([]);
    });
    renderCitizen(<AgriculturePage />, '/agriculture.html?section=expert');
    expect(await screen.findByRole('alert')).toHaveTextContent('Agriculture API unavailable');
  });
});
