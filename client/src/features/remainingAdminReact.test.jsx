import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import AdminReportsPage, { REPORT_SECTIONS } from './admin/AdminReportsPage.jsx';
import AdminWaterPage, { WATER_ADMIN_DOMAINS } from './admin/AdminWaterPage.jsx';

vi.mock('../services/api.js', async importOriginal => ({ ...(await importOriginal()), apiRequest: vi.fn() }));
vi.mock('../utils/alerts.js', () => ({ alerts: { success: vi.fn().mockResolvedValue(), error: vi.fn().mockResolvedValue() } }));

function wrap(page, path) { localStorage.setItem('adminToken', 'admin-token'); return render(<MemoryRouter initialEntries={[path]}><AuthProvider>{page}</AuthProvider></MemoryRouter>); }
beforeEach(() => { localStorage.clear(); apiRequest.mockReset(); });

describe('remaining React admin pages', () => {
  it('loads Water admin statistics with the admin token audience', async () => {
    apiRequest.mockImplementation(path => path.endsWith('/stats') ? Promise.resolve({ stats: { total_connections: 2 } }) : Promise.resolve({}));
    wrap(<AdminWaterPage />, '/admin-water.html');
    expect(await screen.findByText('total connections')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/api/water/admin/stats', { audience: 'admin' });
  });

  it('reviews and updates one Water connection with an exact locked payload', async () => {
    const row = { id: 41, connection_number: 'WC-DEMO-41', status: 'Pending', monthly_rate: 10, admin_remarks: '', created_at: '2026-08-29' }; let resolveUpdate;
    apiRequest.mockImplementation((path, options) => {
      if (path.endsWith('/stats')) return Promise.resolve({ stats: {} });
      if (path === '/api/water/admin/connections') return Promise.resolve({ connections: [row] });
      if (path === '/api/water/admin/connections/41' && !options?.method) return Promise.resolve({ connection: row });
      if (path === '/api/water/admin/connections/41' && options?.method === 'PUT') return new Promise(resolve => { resolveUpdate = resolve; });
      return Promise.resolve({});
    });
    const user = userEvent.setup(); wrap(<AdminWaterPage />, '/admin-water.html'); await user.click(await screen.findByRole('button', { name: 'connections' })); await user.click(await screen.findByRole('button', { name: 'Review' })); await user.selectOptions(await screen.findByLabelText('Status'), 'Approved'); await user.clear(screen.getByLabelText('Monthly rate')); await user.type(screen.getByLabelText('Monthly rate'), '25'); await user.type(screen.getByLabelText('Admin remarks'), 'Synthetic review'); const form = screen.getByRole('button', { name: 'Update selected record' }).closest('form'); fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path, options]) => path.endsWith('/connections/41') && options?.method === 'PUT')).toHaveLength(1));
    expect(apiRequest.mock.calls.find(([path, options]) => path.endsWith('/connections/41') && options?.method === 'PUT')[1].body).toEqual({ status: 'Approved', monthly_rate: '25', admin_remarks: 'Synthetic review' }); resolveUpdate({ success: true, message: 'updated' });
  });

  it('labels administrative bill status as demo-only rather than gateway verification', async () => {
    apiRequest.mockImplementation(path => path.endsWith('/stats') ? Promise.resolve({ stats: {} }) : path.endsWith('/bills') ? Promise.resolve({ bills: [{ id: 9, billing_month: '2026-08', status: 'Pending' }] }) : path.endsWith('/bills/9') ? Promise.resolve({ bill: { id: 9, billing_month: '2026-08', status: 'Pending' } }) : Promise.resolve({}));
    const user = userEvent.setup(); wrap(<AdminWaterPage />, '/admin-water.html'); await user.click(await screen.findByRole('button', { name: 'bills' })); await user.click(await screen.findByRole('button', { name: 'Review' })); expect(await screen.findByText(/not gateway verification/i)).toBeInTheDocument();
  });

  it('loads Reports overview datasets from real admin/report contracts', async () => {
    apiRequest.mockImplementation(path => Promise.resolve(path.includes('summary') ? { users: 2 } : []));
    wrap(<AdminReportsPage />, '/reports.html');
    expect(await screen.findByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    for (const [, path] of REPORT_SECTIONS.overview) expect(apiRequest).toHaveBeenCalledWith(path, { audience: 'admin' });
  });

  it('approves only the selected service request once', async () => {
    let resolveUpdate;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/admin/service-requests') return Promise.resolve([{ id: 71, request_type: 'Demo', status: 'Pending' }, { id: 72, request_type: 'Untouched', status: 'Pending' }]);
      if (path === '/api/admin/service-requests/71/approve' && options?.method === 'PUT') return new Promise(resolve => { resolveUpdate = resolve; });
      return Promise.resolve([]);
    });
    const user = userEvent.setup(); wrap(<AdminReportsPage />, '/reports.html'); await user.click(await screen.findByRole('button', { name: 'services' })); const manage = await screen.findAllByRole('button', { name: 'Manage' }); await user.click(manage[0]); await user.click(screen.getByRole('button', { name: 'Approve selected' })); await user.click(screen.getByRole('button', { name: 'Approve selected' })); await waitFor(() => expect(apiRequest.mock.calls.filter(([path]) => path === '/api/admin/service-requests/71/approve')).toHaveLength(1)); resolveUpdate({ success: true, message: 'approved' });
  });

  it('filters and paginates Reports records', async () => {
    const citizens = Array.from({ length: 17 }, (_, index) => ({ id: index + 1, name: index === 16 ? 'Synthetic Target' : `Citizen ${index + 1}`, status: index % 2 ? 'Active' : 'Pending' }));
    apiRequest.mockImplementation(path => path === '/api/admin/users' ? Promise.resolve(citizens) : Promise.resolve([]));
    const user = userEvent.setup(); wrap(<AdminReportsPage />, '/reports.html?section=users');
    expect(await screen.findByText('17 of 17 records')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Synthetic Target')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search Citizens'), 'Synthetic Target');
    expect(screen.getByText('1 of 17 records')).toBeInTheDocument();
    expect(screen.queryByText('Citizen 1')).not.toBeInTheDocument();
  });

  it('uses existing status enums and contains every presentation domain', () => {
    expect(WATER_ADMIN_DOMAINS.quality.statuses).toContain('Under Investigation');
    expect(REPORT_SECTIONS.market[1][2].statuses).toEqual(['pending', 'investigating', 'resolved', 'dismissed']);
    expect(REPORT_SECTIONS.tax[1][2].statuses).toContain('Accepted');
    expect(REPORT_SECTIONS.tax[1][2].statuses).not.toContain('Approved');
    expect(Object.keys(REPORT_SECTIONS)).toEqual(expect.arrayContaining(['overview', 'users', 'services', 'land', 'community', 'shop', 'market', 'education', 'admissions', 'stipends', 'notices', 'agriculture', 'tax', 'audit']));
  });
});
