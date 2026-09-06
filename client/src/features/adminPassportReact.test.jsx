import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import AdminPassportPage, { PASSPORT_DATE_FIELDS, PASSPORT_STATUSES, passportAdminQuery } from './admin/AdminPassportPage.jsx';

vi.mock('../services/api.js', async importOriginal => {
  const original = await importOriginal();
  return { ...original, apiRequest: vi.fn() };
});
vi.mock('../utils/alerts.js', () => ({ alerts: { success: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) } }));

const stats = { total: 2, pending: 1, processing: 1, delivered: 0, rejected: 0, revenue: 0, today: 1 };
const offices = [{ office_code: 'RPO-DHK', office_name: 'Dhaka Office' }];

function row(id, overrides = {}) {
  return { id, application_number: `PP-TST-${id}`, full_name_en: `Citizen ${id}`, nid_number: `100000000${id}`, passport_type: 'Ordinary', status: 'Submitted', office_name: 'Dhaka Office', payment_status: 'Unpaid', ...overrides };
}

function defaultApi(path) {
  if (path === '/api/passport/admin/stats') return Promise.resolve(stats);
  if (path === '/api/passport/offices') return Promise.resolve(offices);
  if (path.startsWith('/api/passport/admin/applications')) return Promise.resolve([]);
  return Promise.resolve({});
}

function renderAdmin(path = '/admin-passport.html') {
  localStorage.setItem('adminToken', 'signed-admin-token');
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><AdminPassportPage /></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  apiRequest.mockReset();
});

describe('Passport React admin page', () => {
  it('loads stats, offices, and a query-filtered empty queue with the admin audience', async () => {
    apiRequest.mockImplementation(defaultApi);
    renderAdmin('/admin-passport.html?status=Submitted&office=RPO-DHK');
    expect(screen.getByText('Loading passport applications…')).toBeInTheDocument();
    expect(await screen.findByText('No passport applications match these filters.')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/api/passport/admin/stats', { audience: 'admin' });
    expect(apiRequest).toHaveBeenCalledWith('/api/passport/offices', { audience: 'admin' });
    expect(apiRequest).toHaveBeenCalledWith('/api/passport/admin/applications?status=Submitted&office=RPO-DHK', { audience: 'admin' });
  });

  it('preserves server filters and paginates the returned queue without dropping query state', async () => {
    const applications = Array.from({ length: 21 }, (_, index) => row(index + 1));
    apiRequest.mockImplementation(path => path.startsWith('/api/passport/admin/applications') ? Promise.resolve(applications) : defaultApi(path));
    const user = userEvent.setup(); renderAdmin();
    expect(await screen.findByText('1 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('PP-TST-21')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Status'), 'Under Review');
    await user.type(screen.getByLabelText('Search passport applications'), 'PP-TST-2');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/passport/admin/applications?status=Under+Review&search=PP-TST-2', { audience: 'admin' }));
  });

  it('renders detail/history as safe text and updates only the selected id once', async () => {
    const malicious = '<img src=x onerror=bad()>';
    const selectedRow = row(41, { full_name_en: malicious });
    let resolveUpdate;
    apiRequest.mockImplementation((path, options) => {
      if (path.startsWith('/api/passport/admin/applications')) return Promise.resolve([selectedRow]);
      if (path === '/api/passport/admin/application/41' && !options?.method) return Promise.resolve({ application: { ...selectedRow, admin_remarks: '', address: malicious }, status_history: [{ id: 9, old_status: 'Submitted', new_status: 'Under Review', changed_by: malicious, remarks: malicious, created_at: '2026-08-29' }] });
      if (path === '/api/passport/admin/application/41/status' && options?.method === 'PUT') return new Promise(resolve => { resolveUpdate = resolve; });
      return defaultApi(path);
    });
    const user = userEvent.setup(); renderAdmin();
    await screen.findByText(malicious); await user.click(screen.getByRole('button', { name: 'Review' }));
    expect((await screen.findAllByText(malicious)).length).toBeGreaterThan(1);
    expect(document.querySelector('[onerror]')).toBeNull();
    await user.selectOptions(screen.getByLabelText('New status'), 'Approved');
    fireEvent.change(screen.getByLabelText('Workflow date'), { target: { value: '2026-08-29T10:30' } });
    await user.type(screen.getByLabelText('Remarks'), 'Synthetic review');
    const form = screen.getByRole('button', { name: 'Update selected application' }).closest('form');
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path]) => path === '/api/passport/admin/application/41/status')).toHaveLength(1));
    expect(apiRequest.mock.calls.find(([path]) => path === '/api/passport/admin/application/41/status')[1]).toEqual({ method: 'PUT', audience: 'admin', body: { status: 'Approved', remarks: 'Synthetic review', approved_at: '2026-08-29T10:30' } });
    resolveUpdate({ success: true, message: 'updated' });
  });

  it('uses the installed status/date contract and encodes all filter keys', () => {
    expect(PASSPORT_STATUSES).toContain('Police Verification Completed');
    expect(PASSPORT_DATE_FIELDS.Delivered).toBe('delivered_at');
    expect(passportAdminQuery({ status: 'Under Review', office: 'RPO-DHK', date_from: '2026-01-01', date_to: '2026-12-31', search: ' A&B ' }).toString()).toBe('status=Under+Review&office=RPO-DHK&date_from=2026-01-01&date_to=2026-12-31&search=A%26B');
  });

  it('shows API errors as text and offers a retry', async () => {
    apiRequest.mockImplementation(path => path === '/api/passport/admin/stats' ? Promise.reject(new Error('<svg onload=bad()>')) : defaultApi(path));
    renderAdmin();
    expect(await screen.findByRole('alert')).toHaveTextContent('<svg onload=bad()>');
    expect(document.querySelector('[onload]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('clears the admin session on logout', async () => {
    apiRequest.mockImplementation(defaultApi);
    const user = userEvent.setup(); renderAdmin();
    await screen.findByText('No passport applications match these filters.');
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(localStorage.getItem('adminToken')).toBeNull();
  });
});
