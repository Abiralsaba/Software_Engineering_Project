import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import CitizenShell from './CitizenShell.jsx';

vi.mock('../services/api.js', async importOriginal => {
  const original = await importOriginal();
  return { ...original, apiRequest: vi.fn().mockResolvedValue({}) };
});

function renderShell(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <CitizenShell><span>Page content</span></CitizenShell>
      </AuthProvider>
    </MemoryRouter>
  );

  return screen.getByText('Page content').closest('.nationx-dashboard');
}

describe('CitizenShell ministry styling scope', () => {
  it.each([
    '/agriculture.html',
    '/land.html',
    '/tax.html',
    '/passport.html',
    '/nid.html',
    '/health.html',
    '/water.html',
    '/education.html'
  ])('applies the ministry visual system on %s', path => {
    expect(renderShell(path)).toHaveClass('nationx-ministry-page');
  });

  it.each(['/dashboard.html', '/profile.html', '/community.html'])('does not apply ministry styling on %s', path => {
    expect(renderShell(path)).not.toHaveClass('nationx-ministry-page');
  });
});
