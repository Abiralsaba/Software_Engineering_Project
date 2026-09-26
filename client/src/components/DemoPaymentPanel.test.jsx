import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DemoPaymentPanel from './DemoPaymentPanel.jsx';

describe('local payment checkout', () => {
  it('requires a positive amount and never contacts a gateway', () => {
    const request = vi.spyOn(globalThis, 'fetch');
    render(<DemoPaymentPanel service="Land-tax" />);
    expect(screen.queryByText(/SIMULATED — NOT GATEWAY VERIFIED/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open demo checkout' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Demo amount (BDT)'), { target: { value: '250.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open demo checkout' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Mobile banking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simulate presentation payment' }));
    expect(screen.getByRole('status')).toHaveTextContent('Simulation completed');
    expect(screen.getByRole('status')).toHaveTextContent('Mobile banking · BDT 250.50');
    expect(screen.getByRole('status')).toHaveTextContent('NOT A PAYMENT RECEIPT');
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
  });
  it.each([['Simulate declined payment', 'Demo payment declined'], ['Cancel demo checkout', 'Demo checkout cancelled']])('supports %s and retry', (button, message) => {
    render(<DemoPaymentPanel service="Passport" amount={5750} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open demo checkout' }));
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(screen.getByRole('status')).toHaveTextContent(message);
    fireEvent.click(screen.getByRole('button', { name: 'Start another demo' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open demo checkout' })).toBeEnabled();
  });
  it('rejects an invalid supplied amount', () => {
    render(<DemoPaymentPanel service="Passport" amount={-1} />);
    expect(screen.getByRole('button', { name: 'Open demo checkout' })).toBeDisabled();
  });
});
