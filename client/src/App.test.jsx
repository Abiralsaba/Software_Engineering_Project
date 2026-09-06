import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

describe('React route protection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirects an unauthenticated dashboard request to the citizen login', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard.html?from=bookmark']}>
        <AuthProvider><App /></AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /Login to Portal/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'গণপ্রজাতন্ত্রী বাংলাদেশ' })).toBeInTheDocument();
  });

  it.each(['/todo.html', '/community.html', '/shop.html', '/health.html', '/water.html', '/tax.html', '/education.html', '/land.html', '/agriculture.html', '/nid.html', '/passport.html'])('protects %s with the citizen guard', async path => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider><App /></AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /Login to Portal/i })).toBeInTheDocument();
  });

  it.each(['/admin-nid.html', '/admin-passport.html', '/admin-health.html', '/admin-water.html', '/reports.html'])('protects %s with the admin guard', async path => {
    render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /Sign In to Admin Panel/i })).toBeInTheDocument();
  });
});
