import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../context/AuthContext.jsx';
import LoginPage from './LoginPage.jsx';

vi.mock('../../utils/alerts.js', () => ({
  alerts: {
    success: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined)
  }
}));

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
}

describe('citizen login workflow', () => {
  it('stores the sanitized citizen token and routes to the dashboard', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ token: '"signed-token"' })));

    render(
      <MemoryRouter initialEntries={['/index.html']}>
        <AuthProvider>
          <Routes>
            <Route path="/index.html" element={<LoginPage />} />
            <Route path="/dashboard.html" element={<h1>React dashboard reached</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/Email Address/i), 'alice.demo@nationx.test');
    await user.type(screen.getByLabelText(/^Password/i), 'NationX-Demo-2026!');
    await user.click(screen.getByRole('button', { name: /Login to Portal/i }));

    expect(await screen.findByRole('heading', { name: 'React dashboard reached' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('signed-token');
  });

  it('preserves the admin hash entry point', () => {
    render(
      <MemoryRouter initialEntries={['/index.html#admin']}>
        <AuthProvider><LoginPage /></AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Admin Portal' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Admin Email/i)).toBeInTheDocument();
  });
});
