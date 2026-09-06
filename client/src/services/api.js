const STORAGE_KEYS = {
  citizen: 'token',
  admin: 'adminToken'
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function sanitizeToken(token) {
  return typeof token === 'string' ? token.replace(/['"]+/g, '').trim() : '';
}

function clearExpiredSession(audience) {
  if (audience === 'admin') {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    window.location.assign('/index.html#admin');
    return;
  }

  localStorage.removeItem('token');
  window.location.assign('/index.html');
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { error: text } : null;
}

export async function apiRequest(path, options = {}) {
  const {
    audience = 'citizen',
    auth = true,
    body,
    headers: providedHeaders,
    ...fetchOptions
  } = options;

  const headers = new Headers(providedHeaders || {});
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  let requestBody = body;

  if (body !== undefined && body !== null && !isFormData && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  if (auth) {
    const token = sanitizeToken(localStorage.getItem(STORAGE_KEYS[audience]));
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...fetchOptions,
    headers,
    body: requestBody
  });
  const data = await parseResponse(response);

  if (response.status === 401 && auth) {
    clearExpiredSession(audience);
  }

  if (!response.ok) {
    const message = data?.error
      || data?.message
      || data?.errors?.map(error => error.msg).join('\n')
      || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}

export const authApi = {
  citizenLogin: credentials => apiRequest('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: credentials
  }),
  citizenRegister: registration => apiRequest('/api/auth/register', {
    method: 'POST',
    auth: false,
    body: registration
  }),
  sendResetOtp: identity => apiRequest('/api/auth/send-reset-otp', {
    method: 'POST',
    auth: false,
    body: identity
  }),
  verifyResetOtp: payload => apiRequest('/api/auth/reset-password-verify', {
    method: 'POST',
    auth: false,
    body: payload
  }),
  adminLogin: credentials => apiRequest('/api/admin/login', {
    method: 'POST',
    auth: false,
    body: credentials
  }),
  adminRegister: registration => apiRequest('/api/admin/register', {
    method: 'POST',
    auth: false,
    body: registration
  })
};
