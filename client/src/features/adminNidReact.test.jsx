import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import AdminNidPage, { filterNidApplications, NID_STATUS_MAP } from './admin/AdminNidPage.jsx';

vi.mock('../services/api.js', async importOriginal => {
  const original = await importOriginal();
  return { ...original, apiRequest: vi.fn() };
});
vi.mock('../utils/alerts.js', () => ({ alerts: { success: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) } }));

function renderAdmin(path = '/admin-nid.html') {
  localStorage.setItem('adminToken', 'signed-admin-token');
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><AdminNidPage /></AuthProvider></MemoryRouter>);
}

function emptyAdmin(path) {
  if (path === '/api/nid/admin/stats') return Promise.resolve({});
  if (path === '/api/nid/admin/applications') return Promise.resolve([]);
  return Promise.resolve({});
}

beforeEach(() => {
  localStorage.clear();
  apiRequest.mockReset();
});

describe('NID React admin page', () => {
  it('loads admin stats and the empty state using the admin audience', async () => {
    apiRequest.mockImplementation(emptyAdmin);
    renderAdmin();
    expect(screen.getByText('Loading NID admin records…')).toBeInTheDocument();
    expect(await screen.findByText('No matching applications.')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/api/nid/admin/stats', { audience: 'admin' });
    expect(apiRequest).toHaveBeenCalledWith('/api/nid/admin/applications', { audience: 'admin' });
  });

  it('filters by type/status/search and preserves client pagination', async () => {
    const applications = Array.from({ length: 21 }, (_, index) => ({ ref_no: `COR-2026-${String(index).padStart(3, '0')}`, type: index === 20 ? 'Reissue' : 'Correction', status: index === 20 ? 'Approved' : 'Submitted', user_name: index === 20 ? 'Target Citizen' : `Citizen ${index}`, source_table: index === 20 ? 'nid_reissue_requests' : 'nid_correction_requests', created_at: '2026-08-29' }));
    apiRequest.mockImplementation(path => path === '/api/nid/admin/applications' ? Promise.resolve(applications) : emptyAdmin(path));
    const user = userEvent.setup(); renderAdmin();
    expect(await screen.findByText('1 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('COR-2026-020')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filter type'), 'Reissue');
    expect(screen.getByText('Target Citizen')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search NID applications'), 'missing');
    expect(screen.getByText('No matching applications.')).toBeInTheDocument();
  });

  it('loads details as safe text and submits only the selected record once', async () => {
    const malicious = '<img src=x onerror=bad()>';
    const row = { ref_no: 'COR-2026-001', type: 'Correction', status: 'Submitted', user_name: malicious, source_table: 'nid_correction_requests', created_at: '2026-08-29' };
    let resolveUpdate;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/nid/admin/applications') return Promise.resolve([row]);
      if (path === '/api/nid/admin/application/COR-2026-001?table=nid_correction_requests') return Promise.resolve({ request_no: row.ref_no, status: 'Submitted', user_name: malicious, corrected_value: malicious });
      if (path === '/api/nid/admin/update-status' && options?.method === 'POST') return new Promise(resolve => { resolveUpdate = resolve; });
      return emptyAdmin(path);
    });
    const user = userEvent.setup(); renderAdmin();
    await screen.findByText(malicious); await user.click(screen.getByRole('button', { name: 'Review' }));
    expect((await screen.findAllByText(malicious)).length).toBeGreaterThan(0); expect(document.querySelector('[onerror]')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Status'), 'Approved'); await user.type(screen.getByLabelText('Remarks'), 'Verified synthetic record');
    const form = screen.getByRole('button', { name: 'Update selected record' }).closest('form'); fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path]) => path === '/api/nid/admin/update-status')).toHaveLength(1));
    expect(apiRequest.mock.calls.find(([path]) => path === '/api/nid/admin/update-status')[1]).toEqual({ method: 'POST', audience: 'admin', body: { refNo: 'COR-2026-001', sourceTable: 'nid_correction_requests', status: 'Approved', remarks: 'Verified synthetic record' } });
    resolveUpdate({ success: true, message: 'updated' });
  });

  it('uses installed per-table status workflows', () => {
    expect(NID_STATUS_MAP.nid_correction_requests).toEqual(['Draft', 'Submitted', 'Under Review', 'Document Verification', 'Approved', 'Rejected', 'Completed']);
    expect(filterNidApplications([{ ref_no: 'A', type: 'Correction', status: 'Submitted', user_name: 'Alice' }, { ref_no: 'B', type: 'Reissue', status: 'Approved', user_name: 'Bob' }], { type: 'Correction', status: 'Submitted', search: 'ali' })).toHaveLength(1);
  });

  it('renders backend errors without interpreting markup', async () => {
    apiRequest.mockImplementation(path => path === '/api/nid/admin/stats' ? Promise.reject(new Error('<svg onload=bad()>')) : emptyAdmin(path));
    renderAdmin();
    expect(await screen.findByRole('alert')).toHaveTextContent('<svg onload=bad()>');
    expect(document.querySelector('[onload]')).toBeNull();
  });

  it('clears the admin session on logout', async () => {
    apiRequest.mockImplementation(emptyAdmin);
    const user = userEvent.setup(); renderAdmin();
    await screen.findByText('No matching applications.');
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(localStorage.getItem('adminToken')).toBeNull();
  });
});
