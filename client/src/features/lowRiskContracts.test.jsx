import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import ContactPage from './contact/ContactPage.jsx';
import DocumentsPage from './documents/DocumentsPage.jsx';
import MarketPage from './market/MarketPage.jsx';

vi.mock('../services/api.js', async importOriginal => {
  const original = await importOriginal();
  return { ...original, apiRequest: vi.fn() };
});

vi.mock('../utils/alerts.js', () => ({
  alerts: {
    success: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined)
  }
}));

function renderCitizen(page, path) {
  localStorage.setItem('token', 'signed-token');
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider>{page}</AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  apiRequest.mockReset();
});

describe('low-risk React API contracts', () => {
  it('submits the contact contract without changing backend field names', async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation(path => {
      if (path === '/api/user/profile') return Promise.resolve({ name: 'Demo Citizen', nid: 'DEMO-NID' });
      if (path === '/api/contact') return Promise.resolve({ success: true, ticketId: 41 });
      return Promise.reject(new Error(`Unexpected path ${path}`));
    });
    renderCitizen(<ContactPage />, '/contact.html');

    await user.selectOptions(screen.getByLabelText('Department'), 'Ministry of Land');
    await user.type(screen.getByLabelText('Subject'), 'Synthetic service question');
    await user.type(screen.getByLabelText('Message'), 'This is demonstration data.');
    await user.click(screen.getByRole('button', { name: /Send Message/i }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/contact', {
      method: 'POST',
      body: {
        department: 'Ministry of Land',
        subject: 'Synthetic service question',
        message: 'This is demonstration data.'
      }
    }));
    expect(await screen.findByText(/ticket #41/i)).toBeInTheDocument();
  });

  it('keeps official-document uploads as FormData with the established field names', async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/user/profile') return Promise.resolve({ name: 'Demo Citizen', nid: 'DEMO-NID' });
      if (path === '/api/dashboard/documents') return Promise.resolve({ nid: null, passport: null, tax: null, land: [] });
      if (path === '/api/dashboard/documents/user') return Promise.resolve([]);
      if (path === '/api/dashboard/documents/upload-official' && options?.method === 'POST') return Promise.resolve({ message: 'submitted' });
      return Promise.reject(new Error(`Unexpected path ${path}`));
    });
    renderCitizen(<DocumentsPage />, '/documents.html');

    await user.click(await screen.findByRole('button', { name: 'Add NID' }));
    await user.type(screen.getByLabelText('Identity Number'), 'DEMO-NID-100');
    const file = new File(['synthetic'], 'demo.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('PDF or Image'), file);
    const fileInput = screen.getByLabelText('PDF or Image');
    expect(fileInput.files[0].name).toBe('demo.pdf');
    fireEvent.submit(screen.getByRole('dialog', { name: 'Add NID' }).querySelector('form'));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      '/api/dashboard/documents/upload-official',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
    ));
    const uploadCall = apiRequest.mock.calls.find(([path]) => path === '/api/dashboard/documents/upload-official');
    expect(uploadCall[1].body.get('docCategory')).toBe('NID');
    expect(uploadCall[1].body.get('identityNumber')).toBe('DEMO-NID-100');
    expect(uploadCall[1].body.get('document').name).toBe('demo.pdf');
  });

  it('submits market complaints as authenticated JSON using active backend names', async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/user/profile') return Promise.resolve({ name: 'Demo Citizen', nid: 'DEMO-NID' });
      if (path === '/api/shop/market-prices') return Promise.resolve([]);
      if (path === '/api/shop/complaints/my') return Promise.resolve([]);
      if (path === '/api/shop/complaints' && options?.method === 'POST') return Promise.resolve({ success: true, message: 'filed' });
      return Promise.reject(new Error(`Unexpected path ${path}`));
    });
    renderCitizen(<MarketPage />, '/market.html');

    await user.click(screen.getByRole('button', { name: /Report Price Fraud/i }));
    await user.type(screen.getByLabelText('Shop Name'), 'Synthetic Shop');
    await user.type(screen.getByLabelText('Shop Location'), 'Demo District');
    await user.type(screen.getByLabelText('Item Name'), 'Demo Rice');
    await user.type(screen.getByLabelText('Charged Price'), '95');
    await user.click(screen.getByRole('button', { name: 'Submit Complaint' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/shop/complaints', {
      method: 'POST',
      body: expect.objectContaining({
        shop_name: 'Synthetic Shop',
        shop_location: 'Demo District',
        item_name: 'Demo Rice',
        charged_price: '95'
      })
    }));
  });
});
