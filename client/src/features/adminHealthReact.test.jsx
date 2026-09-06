import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import AdminHealthPage, { HEALTH_ADMIN_DOMAINS, healthAdminQuery } from './admin/AdminHealthPage.jsx';

vi.mock('../services/api.js', async importOriginal => {
  const original = await importOriginal();
  return { ...original, apiRequest: vi.fn() };
});
vi.mock('../utils/alerts.js', () => ({ alerts: { success: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) } }));

const statsResponse = { stats: { total_cards: 4, pending_cards: 2, total_vaccinations: 3, total_hospitals: 5 } };

function defaultApi(path) {
  if (path === '/api/health/admin/stats') return Promise.resolve(statsResponse);
  if (path.startsWith('/api/health/admin/health-cards')) return Promise.resolve({ cards: [] });
  if (path.startsWith('/api/health/admin/vaccinations')) return Promise.resolve({ vaccinations: [] });
  if (path.startsWith('/api/health/admin/appointments')) return Promise.resolve({ appointments: [] });
  if (path.startsWith('/api/health/admin/ambulance')) return Promise.resolve({ requests: [] });
  if (path.startsWith('/api/health/admin/complaints')) return Promise.resolve({ complaints: [] });
  if (path.startsWith('/api/health/admin/hospitals')) return Promise.resolve({ hospitals: [] });
  return Promise.resolve({});
}

function renderAdmin(path = '/admin-health.html') {
  localStorage.setItem('adminToken', 'signed-admin-token');
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><AdminHealthPage /></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  apiRequest.mockReset();
  vi.restoreAllMocks();
});

describe('Health React admin page', () => {
  it('loads the admin dashboard statistics using the admin audience', async () => {
    apiRequest.mockImplementation(defaultApi); renderAdmin();
    expect(screen.getByText('Loading health administration statistics…')).toBeInTheDocument();
    expect(await screen.findByText('total cards')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/api/health/admin/stats', { audience: 'admin' });
  });

  it('preserves direct appointment filters and paginates the complete returned list', async () => {
    const rows = Array.from({ length: 16 }, (_, index) => ({ id: index + 1, patient_name: `Patient ${index + 1}`, status: 'Pending', appointment_date: '2026-08-29' }));
    apiRequest.mockImplementation(path => path.startsWith('/api/health/admin/appointments') ? Promise.resolve({ appointments: rows }) : defaultApi(path));
    const user = userEvent.setup(); renderAdmin('/admin-health.html?section=appointments&status=Pending&date=2026-08-29&search=Patient&page=2');
    expect(await screen.findByText('16 records · page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Patient 16')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/api/health/admin/appointments?status=Pending&search=Patient&date=2026-08-29', { audience: 'admin' });
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Patient 1')).toBeInTheDocument();
  });

  it('renders card detail safely and submits the selected card once', async () => {
    const malicious = '<img src=x onerror=bad()>';
    const card = { id: 41, card_number: 'HC-TST-41', full_name: malicious, status: 'Pending', created_at: '2026-08-29' };
    let resolveUpdate;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/health/admin/health-cards') return Promise.resolve({ cards: [card] });
      if (path === '/api/health/admin/health-cards/41' && !options?.method) return Promise.resolve({ card: { ...card, admin_remarks: malicious } });
      if (path === '/api/health/admin/health-cards/41' && options?.method === 'PUT') return new Promise(resolve => { resolveUpdate = resolve; });
      return defaultApi(path);
    });
    const user = userEvent.setup(); renderAdmin(); await user.click(await screen.findByRole('button', { name: 'health cards' }));
    await screen.findByText('HC-TST-41'); await user.click(screen.getByRole('button', { name: 'Review' }));
    expect((await screen.findAllByText(malicious)).length).toBeGreaterThan(0); expect(document.querySelector('[onerror]')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Status'), 'Approved');
    const note = screen.getByLabelText('Admin note'); await user.clear(note); await user.type(note, 'Synthetic approved');
    const form = screen.getByRole('button', { name: 'Update selected record' }).closest('form'); fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/health/admin/health-cards/41' && options?.method === 'PUT')).toHaveLength(1));
    expect(apiRequest.mock.calls.find(([path, options]) => path === '/api/health/admin/health-cards/41' && options?.method === 'PUT')[1]).toEqual({ method: 'PUT', audience: 'admin', body: { status: 'Approved', admin_note: 'Synthetic approved' } });
    resolveUpdate({ success: true, message: 'updated' });
  });

  it('edits and deletes only the selected hospital contract', async () => {
    const hospital = { id: 77, name: 'Synthetic Hospital', name_bn: '', hospital_type: 'District Hospital', division: 'Demo Division', district: 'Demo District', upazila: '', address: '', phone: '', emergency_phone: '', email: '', total_beds: 10, icu_beds: 2, available_beds: 8, available_icu_beds: 1, departments: '', facilities: '', ambulance_available: 1, blood_bank: 0, is_active: 1 };
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/health/admin/hospitals' && !options?.method) return Promise.resolve({ hospitals: [hospital] });
      if (path === '/api/health/admin/hospitals/77' && !options?.method) return Promise.resolve({ hospital });
      if (path === '/api/health/admin/hospitals/77' && options?.method === 'PUT') return Promise.resolve({ success: true, message: 'updated' });
      if (path === '/api/health/admin/hospitals/77' && options?.method === 'DELETE') return Promise.resolve({ success: true, message: 'deleted' });
      return defaultApi(path);
    });
    const user = userEvent.setup(); renderAdmin(); await user.click(await screen.findByRole('button', { name: 'hospitals' }));
    await screen.findByText('Synthetic Hospital'); await user.click(screen.getByRole('button', { name: 'Edit' }));
    const name = await screen.findByLabelText('Hospital name'); await user.clear(name); await user.type(name, 'Synthetic Hospital Updated');
    await user.click(screen.getByRole('button', { name: 'Save selected hospital' }));
    await waitFor(() => expect(apiRequest.mock.calls.some(([path, options]) => path === '/api/health/admin/hospitals/77' && options?.method === 'PUT' && options.body.name === 'Synthetic Hospital Updated')).toBe(true));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(apiRequest).toHaveBeenCalledWith('/api/health/admin/hospitals/77', { method: 'DELETE', audience: 'admin' });
  });

  it('uses installed statuses and stable query keys for every workflow', () => {
    expect(HEALTH_ADMIN_DOMAINS.vaccinations.statuses).toEqual(['Registered', 'Scheduled', 'Completed', 'Cancelled']);
    expect(HEALTH_ADMIN_DOMAINS.ambulance.statuses).toContain('En Route');
    expect(healthAdminQuery('appointments', { status: 'No Show', search: ' A&B ', date: '2026-08-29' }, 3).toString()).toBe('section=appointments&status=No+Show&search=+A%26B+&date=2026-08-29&page=3');
  });

  it('shows API errors as inert text and clears the admin session on logout', async () => {
    apiRequest.mockImplementation(path => path === '/api/health/admin/stats' ? Promise.reject(new Error('<svg onload=bad()>')) : defaultApi(path));
    const user = userEvent.setup(); renderAdmin();
    expect(await screen.findByRole('alert')).toHaveTextContent('<svg onload=bad()>'); expect(document.querySelector('[onload]')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Log out' })); expect(localStorage.getItem('adminToken')).toBeNull();
  });
});
