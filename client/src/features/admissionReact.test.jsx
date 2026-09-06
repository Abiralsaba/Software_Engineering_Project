import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../services/api.js';
import AdmissionPage from './admission/AdmissionPage.jsx';
import ApplyPage, { universityApplicationPayload } from './admission/ApplyPage.jsx';

vi.mock('../services/api.js', async importOriginal => {
  const original = await importOriginal();
  return { ...original, apiRequest: vi.fn() };
});
vi.mock('../utils/alerts.js', () => ({ alerts: { success: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) } }));

const admission = { id: 7, university_name: 'DEMO University', university_name_bn: 'ডেমো', university_type: 'Public', university_location: 'DEMO DATA', unit_code: 'A', unit_name: 'Science', status: 'Active', min_gpa: 4, required_group: 'Science', total_seats: 50, application_fee: 500, end_date: '2026-12-31', days_remaining: 100 };

beforeEach(() => apiRequest.mockReset());

describe('admission listing React page', () => {
  it('renders loading, safe notice content, filters, and empty results', async () => {
    const malicious = '<img src=x onerror=bad()>';
    let resolveAdmissions;
    apiRequest.mockImplementation(path => path === '/api/university/admissions' ? new Promise(resolve => { resolveAdmissions = resolve; }) : Promise.resolve([]));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/admission.html']}><AdmissionPage /></MemoryRouter>);
    expect(screen.getByText('Loading admissions…')).toBeInTheDocument();
    resolveAdmissions([{ ...admission, university_name: malicious }]);
    expect(await screen.findByText(malicious)).toBeInTheDocument();
    expect(document.querySelector('[onerror]')).toBeNull();
    await user.type(screen.getByLabelText('Search admissions'), 'nothing');
    expect(screen.getByText('No matching admission notices.')).toBeInTheDocument();
  });

  it('preserves public roll/year application lookup and Pending status', async () => {
    apiRequest.mockImplementation(path => {
      if (path === '/api/university/admissions') return Promise.resolve([]);
      if (path === '/api/university/my-applications/345678/2024') return Promise.resolve([{ application_id: 'DEMO-A', admission_post_id: 7, university_name: 'DEMO University', unit_code: 'A', payment_status: 'Pending', application_status: 'Draft' }]);
      return Promise.resolve([]);
    });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/admission.html']}><AdmissionPage /></MemoryRouter>);
    await screen.findByText('No matching admission notices.');
    await user.type(screen.getByPlaceholderText('HSC roll'), '345678');
    await user.click(screen.getByRole('button', { name: 'Find' }));
    expect(await screen.findByText(/Payment: Pending/)).toHaveTextContent('Application: Draft');
    expect(apiRequest).toHaveBeenCalledWith('/api/university/my-applications/345678/2024', { auth: false });
  });
});

describe('university application React page', () => {
  it('retains return parameters but treats them as unverified server status', async () => {
    apiRequest.mockImplementation(path => {
      if (path === '/api/university/admissions/7') return Promise.resolve(admission);
      if (path === '/api/university/application/DEMO-A') return Promise.resolve({ application_id: 'DEMO-A', payment_status: 'Pending', application_status: 'Draft' });
      return Promise.resolve({});
    });
    render(<MemoryRouter initialEntries={['/apply.html?id=7&success=true&applicationId=DEMO-A']}><ApplyPage /></MemoryRouter>);
    expect(await screen.findByRole('status')).toHaveTextContent('Unverified payment return');
    expect(screen.getByRole('heading', { name: 'Server-owned application status' }).closest('section')).toHaveTextContent('Payment: Pending');
    expect(screen.queryByText(/payment successful/i)).not.toBeInTheDocument();
  });

  it('uses the exact eligibility URL and safely renders returned identity text', async () => {
    const malicious = '<svg onload=bad()>';
    apiRequest.mockImplementation(path => {
      if (path === '/api/university/admissions/7') return Promise.resolve(admission);
      if (path === '/api/university/verify-hsc/345678/2024?admissionId=7') return Promise.resolve({ found: true, eligible: true, hscData: { roll_number: '345678', exam_year: 2024, student_name: malicious, gpa: 5, exam_group: 'Science' } });
      return Promise.resolve({});
    });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/apply.html?id=7']}><ApplyPage /></MemoryRouter>);
    await screen.findByText('1. Verify HSC eligibility');
    await user.type(screen.getByPlaceholderText('HSC roll'), '345678');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText(new RegExp(malicious.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    expect(document.querySelector('[onload]')).toBeNull();
    expect(apiRequest).toHaveBeenCalledWith('/api/university/verify-hsc/345678/2024?admissionId=7', { auth: false });
  });

  it('preserves Draft application payload and locks duplicate creation', async () => {
    let resolveApply;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/university/admissions/7') return Promise.resolve(admission);
      if (typeof path === 'string' && path.startsWith('/api/university/verify-hsc/')) return Promise.resolve({ eligible: true, hscData: { roll_number: '345678', exam_year: 2024, student_name: 'Synthetic Student', gpa: 5, exam_group: 'Science' } });
      if (path === '/api/university/apply' && options?.method === 'POST') return new Promise(resolve => { resolveApply = resolve; });
      return Promise.resolve({});
    });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/apply.html?id=7']}><ApplyPage /></MemoryRouter>);
    await screen.findByText('1. Verify HSC eligibility');
    await user.type(screen.getByPlaceholderText('HSC roll'), '345678'); await user.click(screen.getByRole('button', { name: 'Verify' }));
    await screen.findByText('2. Create Draft application');
    await user.type(screen.getByLabelText('Mobile'), '01700000000'); await user.type(screen.getByLabelText('Email'), 'demo@example.test'); await user.type(screen.getByLabelText('Present address'), 'DEMO DATA');
    const form = screen.getByRole('button', { name: 'Create Draft application' }).closest('form'); fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path]) => path === '/api/university/apply')).toHaveLength(1));
    expect(apiRequest.mock.calls.find(([path]) => path === '/api/university/apply')[1]).toEqual({ method: 'POST', auth: false, body: { admissionPostId: 7, hscRoll: '345678', hscYear: 2024, mobile: '01700000000', email: 'demo@example.test', presentAddress: 'DEMO DATA' } });
    resolveApply({ success: true, applicationId: 'DEMO-A', paymentAmount: 500 });
  });

  it('builds the established payload and exposes no real payment initializer', async () => {
    const form = document.createElement('form');
    for (const [name, value] of [['mobile', '01700000000'], ['email', 'demo@example.test'], ['presentAddress', 'DEMO DATA']]) { const input = document.createElement('input'); input.name = name; input.value = value; form.append(input); }
    expect(universityApplicationPayload(7, { roll_number: '345678', exam_year: 2024 }, form)).toEqual({ admissionPostId: 7, hscRoll: '345678', hscYear: 2024, mobile: '01700000000', email: 'demo@example.test', presentAddress: 'DEMO DATA' });
    apiRequest.mockImplementation(path => path === '/api/university/admissions/7' ? Promise.resolve(admission) : Promise.resolve({}));
    render(<MemoryRouter initialEntries={['/apply.html?id=7']}><ApplyPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Admission fee payment demonstration' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('SIMULATED — NOT GATEWAY VERIFIED');
    expect(apiRequest.mock.calls.some(([path]) => path === '/api/university/payment/init')).toBe(false);
  });
});
