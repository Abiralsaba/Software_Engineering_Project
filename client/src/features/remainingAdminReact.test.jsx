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

  it('loads a divisional administrator with only the server-scoped work queue', async () => {
    apiRequest.mockImplementation(path => {
      if (path === '/api/admin/me') return Promise.resolve({ id: 8, name: 'Divisional Officer', assignment: { role: 'DIVISION_ADMIN', domainCode: 'agriculture', domainName: 'Agriculture Services', parentAuthority: 'Ministry of Agriculture', divisionId: 3, divisionName: 'Dhaka' } });
      if (path === '/api/admin/access/options') return Promise.resolve({ domains: [{ code: 'agriculture', name: 'Agriculture Services', name_bn: 'কৃষি সেবা', parent_authority: 'Ministry of Agriculture', icon: 'fa-seedling' }], divisions: [] });
      if (path === '/api/admin/work/agriculture') return Promise.resolve({ selectedResource: 'subsidies', resources: [{ key: 'subsidies', label: 'Agriculture subsidies', statuses: ['Pending', 'Approved'] }], items: [{ id: 71, reference: 'SUB-71', applicant: 'রহিম উদ্দিন', status: 'Pending' }] });
      return Promise.resolve([]);
    });
    wrap(<AdminReportsPage />, '/reports.html');
    expect(await screen.findByRole('heading', { name: 'Divisional service administrator' })).toBeInTheDocument();
    expect(await screen.findByText(/Only requests assigned to Dhaka Division/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Access & roles/i })).not.toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith('/api/reports/summary', expect.anything());
  });

  it('shows access governance only to the platform super administrator', async () => {
    apiRequest.mockImplementation(path => {
      if (path === '/api/admin/me') return Promise.resolve({ id: 1, name: 'Platform Admin', assignment: { role: 'SUPER_ADMIN' } });
      if (path === '/api/admin/access/options') return Promise.resolve({ domains: [{ code: 'nid', name: 'National Identity Services', name_bn: 'জাতীয় পরিচয় সেবা', parent_authority: 'Bangladesh Election Commission', icon: 'fa-id-card', supports_division_scope: 1 }], divisions: [{ id: 1, name: 'Dhaka', name_bn: 'ঢাকা' }] });
      if (path === '/api/admin/work/nid') return Promise.resolve({ selectedResource: 'applications', resources: [{ key: 'applications', label: 'NID applications', statuses: ['Submitted'] }], items: [] });
      if (path === '/api/admin/access/admins') return Promise.resolve([{ id: 4, name: 'NID Officer', email: 'nid@gov.bd', nid: '123', status: 'pending', requested_domain_code: 'nid', requested_scope_level: 'division', requested_division_id: 1 }]);
      return Promise.resolve([]);
    });
    const user = userEvent.setup(); wrap(<AdminReportsPage />, '/reports.html');
    await user.click(await screen.findByRole('button', { name: /Access & roles/i }));
    expect(await screen.findByRole('heading', { name: 'Administrator access control' })).toBeInTheDocument();
    expect(screen.getByText('NID Officer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve and assign/i })).toBeInTheDocument();
  });

  it('uses existing status enums and contains every presentation domain', () => {
    expect(WATER_ADMIN_DOMAINS.quality.statuses).toContain('Under Investigation');
    expect(REPORT_SECTIONS.market[1][2].statuses).toEqual(['pending', 'investigating', 'resolved', 'dismissed']);
    expect(REPORT_SECTIONS.tax[1][2].statuses).toContain('Accepted');
    expect(REPORT_SECTIONS.tax[1][2].statuses).not.toContain('Approved');
    expect(Object.keys(REPORT_SECTIONS)).toEqual(expect.arrayContaining(['overview', 'users', 'services', 'land', 'community', 'shop', 'market', 'education', 'admissions', 'stipends', 'notices', 'agriculture', 'tax', 'audit']));
  });
});
