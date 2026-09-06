import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../services/api.js';
import ServiceRequestModal from './ServiceRequestModal.jsx';

vi.mock('../../services/api.js', () => ({ apiRequest: vi.fn() }));
vi.mock('../../utils/alerts.js', () => ({
  alerts: {
    success: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('dashboard service request', () => {
  it('preserves the backend req_ subtype convention', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmitted = vi.fn();
    apiRequest.mockResolvedValue({ message: 'created' });
    render(<ServiceRequestModal onClose={onClose} onSubmitted={onSubmitted} />);

    await user.selectOptions(screen.getByLabelText('Category'), 'identity');
    await user.selectOptions(screen.getByLabelText('Service Type'), 'nid_correction');
    await user.type(screen.getByLabelText(/Unique Number/i), 'DEMO-NID-001');
    await user.type(screen.getByLabelText(/Evidence/i), 'https://drive.google.com/demo');
    await user.type(screen.getByLabelText(/Description/i), 'Synthetic correction request');
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      '/api/dashboard/services/request',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          category: 'identity',
          subCategory: 'req_nid_correction',
          uniqueId: 'DEMO-NID-001'
        })
      })
    ));
    expect(onSubmitted).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
