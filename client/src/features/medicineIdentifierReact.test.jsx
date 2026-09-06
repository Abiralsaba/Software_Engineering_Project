import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import HealthPage from './services/HealthPage.jsx';

vi.mock('../services/api.js', async importOriginal => {
  const original = await importOriginal();
  return { ...original, apiRequest: vi.fn() };
});

vi.mock('../utils/alerts.js', () => ({ alerts: { success: vi.fn(), error: vi.fn() } }));

const medicine = {
  medicine_id: 'MED-b2521d0fc77e894ac50f1393', brand_name: 'A-Pak', generic_name: 'Aceclofenac',
  strength: '100 mg', dosage_form: 'Tablet', manufacturer: 'Synthetic Manufacturer', medicine_type: 'allopathic',
  intended_use: 'human', tier: 'A', ingredients: [{ ingredient: 'Aceclofenac' }],
  registrations: [{ reference: '125-0048-064' }]
};

const scan = {
  scan_id: '53ffea2b-b3d4-4e37-8db4-ea891fcb9ade', scan_mode: 'prescription', status: 'WAITING_CONFIRMATION',
  provider_name: 'mock', model_name: 'mock-visible-extractor-v1', items: [{
    item_id: 'bd9e1118-438e-4f67-83ad-185a5c41d298', raw_visible_text: 'A-Pak 100 mg tablet',
    structured_extraction: { brand_name_candidate: 'A-Pak', generic_name_candidate: 'Aceclofenac', strength_text: '100 mg', dosage_form: 'Tablet', manufacturer_candidate: null, registration_reference_candidate: null, dose_amount: 1, frequency_per_day: 2, duration_days: 5, total_quantity: 10, model_confidence: 0.97 },
    user_corrections: null, uncertain_fields: ['manufacturer_candidate'], confirmation: null,
    candidates: [{ candidate_id: 'candidate-1', candidate_rank: 1, matching_evidence: ['Brand matched', 'Ingredient matched', 'Strength matched', 'Form matched'], conflicts_or_missing: [], medicine }]
  }]
};

function baseResponse(path) {
  if (path === '/api/user/profile') return Promise.resolve({ name: 'Synthetic Citizen', nid: 'DEMO-NID' });
  if (path === '/api/medicine-scans?limit=10') return Promise.resolve({ scans: [] });
  if (path.endsWith('/my-stats')) return Promise.resolve({});
  if (path.endsWith('/locations/divisions')) return Promise.resolve([]);
  return Promise.resolve([]);
}

function renderPage(path = '/health.html?section=medicine-identifier') {
  localStorage.setItem('token', 'signed-token');
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><HealthPage /></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation(baseResponse);
  const NativeURL = globalThis.URL;
  class TestURL extends NativeURL {}
  TestURL.createObjectURL = vi.fn(() => 'blob:synthetic');
  TestURL.revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', TestURL);
});

describe('Medicine Identifier React workflow', () => {
  it('adds the tab after Complaints and renders both modes, camera, upload, consent and warnings', async () => {
    renderPage('/health.html');
    await screen.findByText('No recent activity.');
    const tabs = screen.getByRole('navigation', { name: 'Health sections' });
    const buttons = within(tabs).getAllByRole('button');
    expect(buttons.at(-2)).toHaveTextContent('complaints');
    expect(buttons.at(-1)).toHaveTextContent('medicine identifier');
    await userEvent.click(buttons.at(-1));
    expect(await screen.findByRole('heading', { name: 'Medicine Identifier' })).toBeInTheDocument();
    expect(screen.getByLabelText('Capture medicine image')).toHaveAttribute('capture', 'environment');
    expect(screen.getByText(/I understand that image extraction may make mistakes/)).toBeInTheDocument();
    expect(screen.getByText('Dataset-derived estimated price')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Medicine Package Scan/ }));
    expect(screen.getByText('Add medicine package scan images')).toBeInTheDocument();
    expect(screen.getByText('Up to 2 package views')).toBeInTheDocument();
  });

  it('uploads/removes previews, requires consent and exposes loading/error states', async () => {
    let rejectScan;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/medicine-scans' && options?.method === 'POST') return new Promise((resolve, reject) => { rejectScan = reject; });
      return baseResponse(path);
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Medicine Identifier' });
    const file = new File(['synthetic image'], 'synthetic.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Choose medicine images'), file);
    expect(screen.getByAltText('Selected medicine image 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze visible text' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze visible text' }));
    expect(screen.getByRole('status')).toHaveTextContent('Checking image');
    rejectScan(new Error('Synthetic provider failure'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Synthetic provider failure');
    await userEvent.click(screen.getByRole('button', { name: 'Remove synthetic.png' }));
    expect(screen.queryByAltText('Selected medicine image 1')).not.toBeInTheDocument();
  });

  it('reviews corrections, explicitly confirms a candidate, and displays alternatives and savings', async () => {
    const confirmed = { ...scan, status: 'CONFIRMED', items: [{ ...scan.items[0], user_corrections: { brand_name_candidate: 'A-Pak', total_quantity: 10 }, confirmation: { selection_type: 'CATALOGUE', medicine_id: medicine.medicine_id } }] };
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/medicine-scans' && options?.method === 'POST') return Promise.resolve(scan);
      if (path.includes('/confirm') && options?.method === 'POST') return Promise.resolve(confirmed);
      if (path === `/api/medicines/${medicine.medicine_id}`) return Promise.resolve({ ...medicine, packages: [{ package_id: 'p1', price_id: 'r1', package_original: "10's pack", amount: '40.0000', currency: 'BDT' }] });
      if (path.endsWith('/alternatives')) return Promise.resolve({ warnings: ['Dataset-derived estimated price', 'Current pharmacy price may differ', 'Professional confirmation is required'], alternatives: [{
        medicine: { ...medicine, medicine_id: 'MED-67683973e179be21322ec808', brand_name: 'Acenac' },
        matching_specifications: ['Complete ingredient set', 'Strength/concentration', 'Dosage form'],
        package_comparison: { currency: 'BDT', estimated_per_unit: '2.7300' },
        purchase_estimate: { currency: 'BDT', estimated_cost: '27.3000', selected_packages: [{ count: 10, package_original: 'Unit Price' }] },
        estimated_saving: '12.7000', calculation: 'Lowest dataset-derived package cost covering 10; 0 unit(s) estimated waste.'
      }] });
      if (path === '/api/medicine-scans?limit=10') return Promise.resolve({ scans: [{ scan_id: scan.scan_id, scan_mode: 'prescription', status: 'WAITING_CONFIRMATION' }] });
      return baseResponse(path);
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Medicine Identifier' });
    await userEvent.upload(screen.getByLabelText('Choose medicine images'), new File(['synthetic'], 'rx.png', { type: 'image/png' }));
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze visible text' }));
    expect(await screen.findByText('A-Pak 100 mg tablet')).toBeInTheDocument();
    expect(screen.getByText('Uncertain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm selected medicine' })).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: /A-Pak/ }));
    await userEvent.clear(screen.getByLabelText('Brand'));
    await userEvent.type(screen.getByLabelText('Brand'), 'A-Pak');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm selected medicine' }));
    expect(await screen.findByRole('heading', { name: 'Confirmed by you' })).toBeInTheDocument();
    const confirmCall = apiRequest.mock.calls.find(([path]) => path.includes('/confirm'));
    expect(confirmCall[1].body.selection_type).toBe('CATALOGUE');
    expect(confirmCall[1].body.corrections.total_quantity).toBe(10);
    await userEvent.click(screen.getByRole('button', { name: 'View possible lower-cost products' }));
    expect(await screen.findByText('Estimated saving:')).toBeInTheDocument();
    expect(screen.getByText('BDT 12.7000')).toBeInTheDocument();
    expect(screen.getAllByText(/Professional confirmation is required/).length).toBeGreaterThan(0);
  });

  it('supports manual search, none/manual confirmation controls, and keyboard-accessible history deletion', async () => {
    apiRequest.mockImplementation((path, options) => {
      if (path === '/api/medicine-scans?limit=10') return Promise.resolve({ scans: [{ scan_id: scan.scan_id, scan_mode: 'package', status: 'NO_MATCH' }] });
      if (path.startsWith('/api/medicines/search?')) return Promise.resolve({ medicines: [medicine] });
      if (path === `/api/medicine-scans/${scan.scan_id}` && options?.method === 'DELETE') return Promise.resolve({ success: true });
      return baseResponse(path);
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Medicine Identifier' });
    await userEvent.type(screen.getByLabelText('Brand, ingredient, or registration-like reference'), 'A-Pak');
    await userEvent.click(screen.getByRole('button', { name: 'Search catalogue' }));
    expect(await screen.findByText('Synthetic Manufacturer')).toBeInTheDocument();
    const deleteButton = screen.getByRole('button', { name: 'Delete scan' });
    deleteButton.focus();
    expect(deleteButton).toHaveFocus();
    fireEvent.keyDown(deleteButton, { key: 'Enter' });
    await userEvent.click(deleteButton);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/api/medicine-scans/${scan.scan_id}`, { method: 'DELETE' }));
  });
});
