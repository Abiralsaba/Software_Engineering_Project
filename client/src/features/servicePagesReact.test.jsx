import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import HealthPage from './services/HealthPage.jsx';
import WaterPage from './services/WaterPage.jsx';

vi.mock('../services/api.js', async importOriginal => {
  const original = await importOriginal();
  return { ...original, apiRequest: vi.fn() };
});

vi.mock('../utils/alerts.js', () => ({
  alerts: { success: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) }
}));

function renderCitizen(element, path) {
  localStorage.setItem('token', 'signed-token');
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider>{element}</AuthProvider></MemoryRouter>);
}

function profile(path) {
  return path === '/api/user/profile' ? Promise.resolve({ name: 'Synthetic Citizen', nid: 'DEMO-NID' }) : null;
}

function emptyService(path) {
  if (typeof path !== 'string') return Promise.resolve([]);
  if (profile(path)) return profile(path);
  if (path.endsWith('/my-stats')) return Promise.resolve({});
  if (path.endsWith('/locations/divisions')) return Promise.resolve([{ id: 1, name: 'Demo Division' }]);
  return Promise.resolve([]);
}

beforeEach(() => apiRequest.mockReset());

describe('health React service page', () => {
  it('renders loading and complete empty states', async () => {
    let resolveStats;
    apiRequest.mockImplementation(path => {
      if (profile(path)) return profile(path);
      if (path === '/api/health/my-stats') return new Promise(resolve => { resolveStats = resolve; });
      return Promise.resolve([]);
    });
    renderCitizen(<HealthPage />, '/health.html');
    expect(screen.getByText('Loading health services…')).toBeInTheDocument();
    resolveStats({});
    expect(await screen.findByText('No recent activity.')).toBeInTheDocument();
  });

  it('preserves vaccination payload fields and locks a duplicate submit', async () => {
    let resolveSubmit;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/health/vaccination/register' && options?.method === 'POST') return new Promise(resolve => { resolveSubmit = resolve; });
      return emptyService(path);
    });
    const user = userEvent.setup();
    renderCitizen(<HealthPage />, '/health.html?source=bookmark&section=vaccination');
    await screen.findByRole('heading', { name: 'Register vaccination' });
    await user.selectOptions(screen.getByLabelText('Vaccine type'), 'COVID-19');
    await user.type(screen.getByLabelText('Vaccine name'), 'Synthetic Vaccine');
    await user.selectOptions(screen.getByLabelText('Dose number'), '2');
    fireEvent.change(screen.getByLabelText('Vaccination date'), { target: { value: '2026-09-01' } });
    await user.type(screen.getByLabelText('Vaccination center'), 'Demo Center');
    const form = screen.getByRole('button', { name: 'Register' }).closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/health/vaccination/register' && options?.method === 'POST')).toHaveLength(1));
    const request = apiRequest.mock.calls.find(([path, options]) => path === '/api/health/vaccination/register' && options?.method === 'POST')[1];
    expect(request.body).toEqual({ vaccine_type: 'COVID-19', vaccine_name: 'Synthetic Vaccine', dose_number: '2', vaccination_date: '2026-09-01', vaccination_center: 'Demo Center' });
    resolveSubmit({ success: true, message: 'registered' });
  });

  it('renders API errors and safe stored text', async () => {
    apiRequest.mockImplementation(path => {
      if (profile(path)) return profile(path);
      if (path === '/api/health/my-stats') return Promise.reject(new Error('<img src=x onerror=bad()>'));
      return Promise.resolve([]);
    });
    renderCitizen(<HealthPage />, '/health.html');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('<img src=x onerror=bad()>');
    expect(document.querySelector('[onerror]')).toBeNull();
  });
});

describe('water React service page', () => {
  it('keeps bill history visible and labels the non-writing presentation simulation', async () => {
    apiRequest.mockImplementation(emptyService);
    renderCitizen(<WaterPage />, '/water.html?section=bill&return=preserved');
    expect(await screen.findByText(/SIMULATED — NOT GATEWAY VERIFIED/)).toBeInTheDocument();
    expect(screen.getByText('No bill records.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay Bill|submit bill/i })).not.toBeInTheDocument();
  });

  it('preserves complaint payload fields and locks duplicate submissions', async () => {
    let resolveSubmit;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/water/locations/districts/1') return Promise.resolve([{ id: 11, name: 'Demo District' }]);
      if (path === '/api/water/complaint/submit' && options?.method === 'POST') return new Promise(resolve => { resolveSubmit = resolve; });
      return emptyService(path);
    });
    const user = userEvent.setup();
    renderCitizen(<WaterPage />, '/water.html?section=complaints');
    await screen.findByRole('heading', { name: 'File water complaint' });
    await user.selectOptions(screen.getByLabelText('Complaint type'), 'Pipeline Leakage');
    await user.selectOptions(screen.getByLabelText('Priority'), 'High');
    await user.selectOptions(screen.getByLabelText('Division'), 'Demo Division');
    await waitFor(() => expect(screen.getByLabelText('District')).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText('District'), 'Demo District');
    await user.type(screen.getByLabelText('Upazila (optional)'), 'Demo Upazila');
    await user.type(screen.getByLabelText('Contact phone'), '01700000000');
    await user.type(screen.getByLabelText('Address'), 'DEMO DATA address');
    await user.type(screen.getByLabelText('Description'), 'Synthetic complaint');
    const form = screen.getByRole('button', { name: 'Submit complaint' }).closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/water/complaint/submit' && options?.method === 'POST')).toHaveLength(1));
    const request = apiRequest.mock.calls.find(([path, options]) => path === '/api/water/complaint/submit' && options?.method === 'POST')[1];
    expect(request.body).toEqual({ complaint_type: 'Pipeline Leakage', priority: 'High', division: 'Demo Division', district: 'Demo District', upazila: 'Demo Upazila', contact_phone: '01700000000', address: 'DEMO DATA address', description: 'Synthetic complaint' });
    resolveSubmit({ success: true, message: 'submitted' });
  });

  it('renders loading and API error states', async () => {
    let rejectStats;
    apiRequest.mockImplementation(path => {
      if (profile(path)) return profile(path);
      if (path === '/api/water/my-stats') return new Promise((resolve, reject) => { rejectStats = reject; });
      return Promise.resolve([]);
    });
    renderCitizen(<WaterPage />, '/water.html');
    expect(screen.getByText('Loading water services…')).toBeInTheDocument();
    rejectStats(new Error('Water API unavailable'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Water API unavailable');
  });
});
