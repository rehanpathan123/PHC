/**
 * API service layer — all HTTP calls go through here.
 * Uses Vite proxy so we don't need to hardcode the backend URL.
 */
const BASE = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('phc_token');
}

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const resp = await fetch(BASE + path, { ...options, headers });

  if (!resp.ok) {
    let detail = 'Request failed';
    try {
      const err = await resp.json();
      detail = err.detail || detail;
    } catch (_) {}
    const error = new Error(detail);
    error.status = resp.status;
    throw error;
  }

  // 204 No Content
  if (resp.status === 204) return null;
  return resp.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email, password) =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => apiRequest('/api/auth/me'),
};

// ── Patients ──────────────────────────────────────────────────────────────────

export const patientsApi = {
  list: () => apiRequest('/api/patients'),
  create: (data) =>
    apiRequest('/api/patients', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => apiRequest(`/api/patients/${id}`),
};

// ── Risk ──────────────────────────────────────────────────────────────────────

export const riskApi = {
  assess: (data) =>
    apiRequest('/api/risk-assessment', { method: 'POST', body: JSON.stringify(data) }),
};

// ── PHCs ──────────────────────────────────────────────────────────────────────

export const phcsApi = {
  list: () => apiRequest('/api/phcs'),
  nearby: (lat, lon, radiusKm = 50, medicineId = null) => {
    let url = `/api/phcs/nearby?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`;
    if (medicineId) url += `&medicine_id=${medicineId}`;
    return apiRequest(url);
  },
};

// ── Inventory ─────────────────────────────────────────────────────────────────

export const inventoryApi = {
  getByPhc: (phcId) => apiRequest(`/api/inventory?phc_id=${phcId}`),
  getAllMedicines: () => apiRequest('/api/inventory/all'),
  update: (id, data) =>
    apiRequest(`/api/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  availability: (medicineId, currentPhcId = 1) =>
    apiRequest(`/api/inventory/availability?medicine_id=${medicineId}&current_phc_id=${currentPhcId}`),
};

// ── Requests ──────────────────────────────────────────────────────────────────

export const requestsApi = {
  list: () => apiRequest('/api/medicine/requests'),
  create: (data) =>
    apiRequest('/api/medicine/requests', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, status) =>
    apiRequest(`/api/medicine/requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
};

// ── Sync ──────────────────────────────────────────────────────────────────────

export const syncApi = {
  status: () => apiRequest('/api/sync/status'),
  push: (records) =>
    apiRequest('/api/sync', { method: 'POST', body: JSON.stringify(records) }),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
  stats: () => apiRequest('/api/dashboard/stats'),
};

// ── AI ────────────────────────────────────────────────────────────────────────

export const aiApi = {
  status: () => apiRequest('/api/ai/status'),
  extractSymptoms: (text) =>
    apiRequest('/api/ai/extract-symptoms', { method: 'POST', body: JSON.stringify({ text }) }),
  patientSummary: (data) =>
    apiRequest('/api/ai/patient-summary', { method: 'POST', body: JSON.stringify(data) }),
  riskExplanation: (data) =>
    apiRequest('/api/ai/risk-explanation', { method: 'POST', body: JSON.stringify(data) }),
  phcRecommendation: (data) =>
    apiRequest('/api/ai/phc-recommendation', { method: 'POST', body: JSON.stringify(data) }),
  demandForecast: (phcId, medicineId) =>
    apiRequest(`/api/ai/demand-forecast?phc_id=${phcId}&medicine_id=${medicineId}`),
  stockoutAlerts: (phcId) =>
    apiRequest(`/api/ai/stockout-alerts?phc_id=${phcId}`),
  anomalies: (phcId) =>
    apiRequest(`/api/ai/anomalies?phc_id=${phcId}`),
  copilot: (question) =>
    apiRequest('/api/ai/copilot', { method: 'POST', body: JSON.stringify({ question }) }),
};

