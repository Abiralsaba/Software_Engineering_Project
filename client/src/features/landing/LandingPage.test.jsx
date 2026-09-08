import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PublicEntry from './PublicEntry.jsx';
import LandingPage from './LandingPage.jsx';
import { AuthProvider } from '../../context/AuthContext.jsx';

vi.mock('./Landscape.jsx', () => ({ default: () => <div data-renderer="static-test" /> }));

describe('public landing entry', () => {
  it('offers real service destinations and honest medicine/prototype disclosures without API requests', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const { unmount } = render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bangladesh,connected.');
    expect(screen.getByRole('link', { name: /Explore Medicine Identifier/ })).toHaveAttribute('href', '/health.html?section=medicine-identifier');
    expect(screen.getByText(/Not an official government service/)).toBeVisible();
    expect(screen.getByText(/Extraction can make mistakes/)).toHaveTextContent('doctor or pharmacist');
    expect(fetch).not.toHaveBeenCalled();
    expect(document.body).toHaveClass('nx-landing-body'); unmount();
    expect(document.body).not.toHaveClass('nx-landing-body');
  });
  it('closes the mobile navigation on Escape and returns keyboard focus', async () => {
    const user = userEvent.setup(); render(<LandingPage />);
    const toggle = screen.getByLabelText('Open navigation');
    // jsdom does not apply mobile media queries; viewport visibility is covered in Playwright.
    toggle.style.display = 'block';
    await user.click(toggle); expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}'); expect(toggle).toHaveAttribute('aria-expanded', 'false'); expect(toggle).toHaveFocus();
  });
  it.each(['/index.html#signin', '/index.html#admin'])('keeps authentication available at %s', path => {
    render(<MemoryRouter initialEntries={[path]}><AuthProvider><PublicEntry /></AuthProvider></MemoryRouter>);
    expect(screen.getByRole('button', { name: path.endsWith('admin') ? /Sign In to Admin Panel/ : /Login to Portal/ })).toBeVisible();
  });
});
