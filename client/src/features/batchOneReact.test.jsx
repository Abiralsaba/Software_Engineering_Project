import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import CommunityPage from './community/CommunityPage.jsx';
import ShopPage, { calculateCartTotal } from './shop/ShopPage.jsx';
import TodoPage from './todo/TodoPage.jsx';

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

function renderCitizen(element, path) {
  localStorage.setItem('token', 'signed-token');
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider>{element}</AuthProvider></MemoryRouter>);
}

function profileResponse(path) {
  if (path === '/api/user/profile') return Promise.resolve({ name: 'Synthetic Citizen', nid: 'DEMO-NID' });
  return null;
}

beforeEach(() => {
  apiRequest.mockReset();
});

describe('todo React batch', () => {
  it('renders loading and then the empty board state', async () => {
    let resolveTodos;
    apiRequest.mockImplementation(path => profileResponse(path) || (path === '/api/dashboard/todos' ? new Promise(resolve => { resolveTodos = resolve; }) : Promise.reject(new Error(path))));
    renderCitizen(<TodoPage />, '/todo.html');
    expect(screen.getByText('Loading tasks…')).toBeInTheDocument();
    resolveTodos([]);
    expect((await screen.findAllByText('Drop tasks here')).length).toBe(3);
  });

  it('prevents duplicate task submissions and preserves the due_date payload', async () => {
    let resolveCreate;
    apiRequest.mockImplementation((path, options) => {
      if (profileResponse(path)) return profileResponse(path);
      if (path === '/api/dashboard/todos' && !options) return Promise.resolve([]);
      if (path === '/api/dashboard/todos' && options?.method === 'POST') return new Promise(resolve => { resolveCreate = resolve; });
      return Promise.reject(new Error(path));
    });
    const user = userEvent.setup();
    renderCitizen(<TodoPage />, '/todo.html');
    await user.click(await screen.findByRole('button', { name: /Add Item/i }));
    await user.type(screen.getByLabelText('Task Title'), 'Synthetic task');
    await user.type(screen.getByLabelText('Description'), '<img src=x onerror=alert(1)>');
    fireEvent.change(screen.getByLabelText('Due Date & Time'), { target: { value: '2026-12-15T10:30' } });
    const form = screen.getByRole('dialog', { name: 'New Task' }).querySelector('form');
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/dashboard/todos' && options?.method === 'POST')).toHaveLength(1));
    const createCall = apiRequest.mock.calls.find(([path, options]) => path === '/api/dashboard/todos' && options?.method === 'POST');
    expect(createCall[1].body).toEqual(expect.objectContaining({ title: 'Synthetic task', due_date: expect.stringMatching(/^2026-12-15/) }));
    resolveCreate({ id: 91, ...createCall[1].body, status: 'todo' });
    expect((await screen.findAllByText('Synthetic task')).length).toBeGreaterThan(0);
  });

  it('shows an API error state', async () => {
    apiRequest.mockImplementation(path => profileResponse(path) || Promise.reject(new Error('Todo API unavailable')));
    renderCitizen(<TodoPage />, '/todo.html');
    expect(await screen.findByRole('alert')).toHaveTextContent('Todo API unavailable');
  });
});

describe('community React batch', () => {
  const malicious = '<img src=x onerror=window.__xss=1>';

  it('renders stored content as text and handles empty comments safely', async () => {
    apiRequest.mockImplementation(path => {
      if (profileResponse(path)) return profileResponse(path);
      if (path === '/api/community/groups') return Promise.resolve([{ id: 4, name: malicious, description: '<script>alert(1)</script>', member_count: 1 }]);
      if (path === '/api/community/my-groups') return Promise.resolve([]);
      if (path === '/api/dashboard/summary') return Promise.resolve({ user: { id: 1 } });
      if (path === '/api/community/groups/4') return Promise.resolve({ id: 4, name: malicious, description: '<script>alert(1)</script>', member_count: 1, is_member: true, my_role: 'member', created_by: 2, posts: [{ id: 7, user_id: 2, author_name: 'Other', content: malicious, like_count: 0, comment_count: 0, liked_by_me: 0, created_at: new Date().toISOString() }] });
      if (path === '/api/community/posts/7/comments') return Promise.resolve([]);
      return Promise.reject(new Error(path));
    });
    const user = userEvent.setup();
    renderCitizen(<CommunityPage />, '/community.html');
    await user.click(await screen.findByRole('button', { name: new RegExp('img src=x') }));
    expect((await screen.findAllByText(malicious)).length).toBeGreaterThan(0);
    expect(document.querySelector('[onerror]')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    await user.click(screen.getAllByRole('button', { name: '0' })[1]);
    expect(await screen.findByText('No comments yet.')).toBeInTheDocument();
  });

  it('uses the established multipart group fields and locks duplicate submits', async () => {
    let resolveCreate;
    apiRequest.mockImplementation((path, options) => {
      if (profileResponse(path)) return profileResponse(path);
      if (path === '/api/community/groups' && !options) return Promise.resolve([]);
      if (path === '/api/community/my-groups') return Promise.resolve([]);
      if (path === '/api/dashboard/summary') return Promise.resolve({ user: { id: 1 } });
      if (path === '/api/community/groups' && options?.method === 'POST') return new Promise(resolve => { resolveCreate = resolve; });
      return Promise.reject(new Error(path));
    });
    const user = userEvent.setup();
    renderCitizen(<CommunityPage />, '/community.html');
    await user.click(await screen.findByRole('button', { name: 'Create Group' }));
    await user.type(screen.getByLabelText('Group Name'), 'Synthetic Community');
    await user.type(screen.getByLabelText('Description'), 'DEMO DATA');
    const file = new File(['image'], 'cover.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Cover Image'), file);
    const form = screen.getByRole('button', { name: 'Submit for Approval' }).closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/community/groups' && options?.method === 'POST')).toHaveLength(1));
    const body = apiRequest.mock.calls.find(([path, options]) => path === '/api/community/groups' && options?.method === 'POST')[1].body;
    expect(body.get('name')).toBe('Synthetic Community');
    expect(body.get('description')).toBe('DEMO DATA');
    expect(body.get('cover_image').name).toBe('cover.png');
    resolveCreate({ success: true, message: 'pending' });
  });

  it('renders the discover empty state', async () => {
    apiRequest.mockImplementation(path => {
      if (profileResponse(path)) return profileResponse(path);
      if (path === '/api/community/groups' || path === '/api/community/my-groups') return Promise.resolve([]);
      if (path === '/api/dashboard/summary') return Promise.resolve({ user: { id: 1 } });
      return Promise.reject(new Error(path));
    });
    renderCitizen(<CommunityPage />, '/community.html');
    expect(await screen.findByText('No communities found.')).toBeInTheDocument();
  });
});

describe('shop React batch', () => {
  it('calculates item subtotals and cart totals using numeric quantities', () => {
    expect(calculateCartTotal([{ price: '12.50', quantity: 2 }, { price: 5, quantity: '3' }])).toBe(40);
  });

  it('escapes product content, shows a successful cart state, and locks duplicate adds', async () => {
    let resolveAdd;
    const item = { id: 8, name: '<script>bad()</script>', description: '<img onerror=bad()>', price: '25.00', image_url: '<i class="fas fa-book"></i>' };
    const cartRow = { cart_id: 12, product_id: 8, name: item.name, price: '25.00', quantity: 2, image_url: item.image_url };
    apiRequest.mockImplementation((path, options) => {
      if (profileResponse(path)) return profileResponse(path);
      if (path === '/api/shop/items') return Promise.resolve([item]);
      if (path === '/api/shop/cart' && !options) return resolveAdd ? Promise.resolve([cartRow]) : Promise.resolve([]);
      if (path === '/api/shop/cart' && options?.method === 'POST') return new Promise(resolve => { resolveAdd = resolve; });
      return Promise.reject(new Error(path));
    });
    const user = userEvent.setup();
    renderCitizen(<ShopPage />, '/shop.html');
    const add = await screen.findByRole('button', { name: 'Add to Cart' });
    fireEvent.click(add);
    fireEvent.click(add);
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/shop/cart' && options?.method === 'POST')).toHaveLength(1));
    expect(screen.getByText(item.name)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('[onerror]')).toBeNull();
    resolveAdd({ success: true });
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^Cart 2$/ }));
    expect(within(screen.getByRole('dialog', { name: 'Your Cart' })).getAllByText('৳ 50.00').length).toBeGreaterThan(0);
  });

  it('does not trust a payment success query as proof of payment', async () => {
    apiRequest.mockImplementation(path => {
      if (profileResponse(path)) return profileResponse(path);
      if (path === '/api/shop/items' || path === '/api/shop/cart') return Promise.resolve([]);
      return Promise.reject(new Error(path));
    });
    renderCitizen(<ShopPage />, '/shop.html?status=success&order_id=77');
    expect(await screen.findByRole('status')).toHaveTextContent('not confirmed');
    expect(screen.queryByText('Payment Successful!')).not.toBeInTheDocument();
  });

  it('renders an API error state', async () => {
    apiRequest.mockImplementation(path => profileResponse(path) || Promise.reject(new Error('Shop API unavailable')));
    renderCitizen(<ShopPage />, '/shop.html');
    expect(await screen.findByRole('alert')).toHaveTextContent('Shop API unavailable');
  });
});
