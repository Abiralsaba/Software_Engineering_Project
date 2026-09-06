import { describe, expect, it, vi } from 'vitest';
import { apiRequest, sanitizeToken } from './api.js';

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
}

describe('API client contracts', () => {
  it('sanitizes stored JWTs and sends the existing Bearer contract', async () => {
    localStorage.setItem('token', '"citizen-token"');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/api/dashboard/summary');

    const [path, options] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/dashboard/summary');
    expect(options.headers.get('Authorization')).toBe('Bearer citizen-token');
    expect(sanitizeToken("'abc' ")).toBe('abc');
  });

  it('does not force a content type for FormData uploads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ uploaded: true }));
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.append('document_type', 'passport');

    await apiRequest('/api/user/documents', { method: 'POST', body: form, auth: false });

    const options = fetchMock.mock.calls[0][1];
    expect(options.body).toBe(form);
    expect(options.headers.has('Content-Type')).toBe(false);
  });
});
