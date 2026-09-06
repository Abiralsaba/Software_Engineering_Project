import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import EducationPage from './services/EducationPage.jsx';
import TaxPage, { calculateIncomeTax } from './services/TaxPage.jsx';

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
  if (path === '/api/user/profile') return Promise.resolve({ name: 'Synthetic Citizen', nid: 'DEMO-NID' });
  return null;
}

function emptyTax(path) {
  if (typeof path !== 'string') return Promise.resolve([]);
  if (common(path)) return common(path);
  if (path === '/api/tax/dashboard') return Promise.resolve({});
  if (path === '/api/tax/tin/status' || path === '/api/tax/vat/status') return Promise.resolve(null);
  return Promise.resolve([]);
}

function emptyEducation(path) {
  if (typeof path !== 'string') return Promise.resolve([]);
  if (common(path)) return common(path);
  if (path === '/api/education/years') return Promise.resolve([2026]);
  return Promise.resolve([]);
}

beforeEach(() => apiRequest.mockReset());

describe('tax React service page', () => {
  it('uses the legacy tax slab and rebate calculation', () => {
    expect(calculateIncomeTax(1000000, 50000, 100000)).toEqual({
      income: 1000000, exempted: 50000, taxableIncome: 950000,
      grossTax: 60000, rebate: 15000, finalTax: 45000
    });
    expect(calculateIncomeTax(0, 0, 0).finalTax).toBe(0);
  });

  it('renders loading and complete dashboard empty states', async () => {
    let resolveDashboard;
    apiRequest.mockImplementation(path => {
      if (common(path)) return common(path);
      if (path === '/api/tax/dashboard') return new Promise(resolve => { resolveDashboard = resolve; });
      if (path === '/api/tax/tin/status' || path === '/api/tax/vat/status') return Promise.resolve(null);
      return Promise.resolve([]);
    });
    renderCitizen(<TaxPage />, '/tax.html?ref=bookmark');
    expect(screen.getByText('Loading tax services…')).toBeInTheDocument();
    resolveDashboard({});
    expect((await screen.findAllByText('Not Registered')).length).toBeGreaterThan(0);
  });

  it('preserves pending payment-record payloads and locks duplicate submits', async () => {
    let resolveSubmit;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/tax/payments/pay' && options?.method === 'POST') return new Promise(resolve => { resolveSubmit = resolve; });
      return emptyTax(path);
    });
    const user = userEvent.setup();
    renderCitizen(<TaxPage />, '/tax.html?section=payments&return=preserved');
    await screen.findByRole('heading', { name: 'Record tax payment' });
    await user.selectOptions(screen.getByLabelText('Payment type'), 'Supplementary Duty');
    await user.type(screen.getByLabelText('Amount'), '1250');
    await user.selectOptions(screen.getByLabelText('Payment method'), 'Bank Transfer');
    await user.type(screen.getByLabelText('Fiscal year'), '2025-26');
    await user.type(screen.getByLabelText('Bank name'), 'Demo Bank');
    await user.type(screen.getByLabelText('Branch name'), 'Demo Branch');
    await user.type(screen.getByLabelText('Transaction id'), 'DEMO-TXN');
    const form = screen.getByRole('button', { name: 'Submit pending payment record' }).closest('form');
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/tax/payments/pay' && options?.method === 'POST')).toHaveLength(1));
    const request = apiRequest.mock.calls.find(([path, options]) => path === '/api/tax/payments/pay' && options?.method === 'POST')[1];
    expect(request.body).toEqual({ payment_type: 'Supplementary Duty', amount: '1250', payment_method: 'Bank Transfer', bank_name: 'Demo Bank', branch_name: 'Demo Branch', transaction_id: 'DEMO-TXN', fiscal_year: '2025-26' });
    expect(screen.getByRole('status')).toHaveTextContent('not proof');
    resolveSubmit({ success: true, receipt_no: 'DEMO-RCP' });
  });

  it('renders API error text without interpreting markup', async () => {
    apiRequest.mockImplementation(path => {
      if (common(path)) return common(path);
      if (path === '/api/tax/dashboard') return Promise.reject(new Error('<img src=x onerror=bad()>'));
      return Promise.resolve([]);
    });
    renderCitizen(<TaxPage />, '/tax.html');
    expect(await screen.findByRole('alert')).toHaveTextContent('<img src=x onerror=bad()>');
    expect(document.querySelector('[onerror]')).toBeNull();
  });
});

describe('education React service page', () => {
  it('preserves the result URL contract and safely renders returned text', async () => {
    const malicious = '<img src=x onerror=bad()>';
    apiRequest.mockImplementation(path => {
      if (path === '/api/education/results/ssc/2026/12345') return Promise.resolve({ examType: 'SSC', examYear: 2026, student: { name: malicious, rollNumber: '12345', group: 'Science' }, subjects: [{ name: malicious, grade: 'A+' }], result: { gpa: '5.00', status: 'Passed' } });
      return emptyEducation(path);
    });
    const user = userEvent.setup();
    renderCitizen(<EducationPage />, '/education.html?source=bookmark');
    await user.selectOptions(await screen.findByLabelText('Exam type'), 'ssc');
    await user.selectOptions(screen.getByLabelText('Exam year'), '2026');
    await user.type(screen.getByLabelText('Roll number'), '12345');
    await user.click(screen.getByRole('button', { name: 'Check result' }));
    expect((await screen.findAllByText(malicious)).length).toBeGreaterThan(0);
    expect(document.querySelector('[onerror]')).toBeNull();
    expect(apiRequest).toHaveBeenCalledWith('/api/education/results/ssc/2026/12345');
  });

  it('preserves nested stipend payloads and locks duplicate applications', async () => {
    let resolveSubmit;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/stipends') return Promise.resolve([{ id: 7, title: 'DEMO DATA Grant', description: 'Synthetic', amount: 5000, deadline: '2026-12-31', min_gpa: 3.5 }]);
      if (path === '/api/stipends/apply' && options?.method === 'POST') return new Promise(resolve => { resolveSubmit = resolve; });
      return emptyEducation(path);
    });
    const user = userEvent.setup();
    renderCitizen(<EducationPage />, '/education.html?section=stipend');
    await user.click(await screen.findByRole('button', { name: 'Apply now' }));
    await user.type(screen.getByLabelText('GPA'), '4.5');
    await user.type(screen.getByLabelText('Institution'), 'DEMO DATA College');
    await user.type(screen.getByLabelText('Monthly family income'), '12000');
    await user.type(screen.getByLabelText('Family members'), '4');
    await user.type(screen.getByLabelText('Land owned'), '1.5');
    await user.selectOptions(screen.getByLabelText('Payment method'), 'Mobile Banking');
    await user.type(screen.getByLabelText('Account number'), '01700000000');
    const form = screen.getByRole('button', { name: 'Submit application' }).closest('form');
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/stipends/apply' && options?.method === 'POST')).toHaveLength(1));
    const request = apiRequest.mock.calls.find(([path, options]) => path === '/api/stipends/apply' && options?.method === 'POST')[1];
    expect(request.body).toEqual({ stipendId: '7', studentDetails: { gpa: '4.5', institution: 'DEMO DATA College' }, financialInfo: { monthlyIncome: '12000', members: '4', land: '1.5' }, guardianInfo: {}, bankDetails: { method: 'Mobile Banking', accountNo: '01700000000' } });
    resolveSubmit({ success: true, applicationNo: 'DEMO-STP' });
  });

  it('renders loading and list API error states', async () => {
    let rejectYears;
    apiRequest.mockImplementation(path => {
      if (common(path)) return common(path);
      if (path === '/api/education/years') return new Promise((resolve, reject) => { rejectYears = reject; });
      return Promise.resolve([]);
    });
    renderCitizen(<EducationPage />, '/education.html');
    expect(screen.getByText('Loading education services…')).toBeInTheDocument();
    rejectYears(new Error('Education API unavailable'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Education API unavailable');
  });
});
