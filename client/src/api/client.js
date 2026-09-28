const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),

  createProperty: (payload) => request('/properties', { method: 'POST', body: payload }),
  listProperties: () => request('/properties'),
  joinProperty: (joinCode) => request('/properties/join', { method: 'POST', body: { joinCode } }),

  createRequest: (formData) => request('/requests', { method: 'POST', body: formData, isFormData: true }),
  listRequests: () => request('/requests'),
  getRequest: (id) => request(`/requests/${id}`),
  updateRequestStatus: (id, status) =>
    request(`/requests/${id}/status`, { method: 'PATCH', body: { status } }),
};
