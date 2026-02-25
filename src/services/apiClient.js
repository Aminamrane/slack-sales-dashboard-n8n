const API_URL = import.meta.env.VITE_API_URL || 'https://api.ownertechnology.com';

const TOKEN_KEY = "auth_token";
const REFRESH_KEY = "refresh_token";
const USER_KEY = "auth_user";

async function safeJson(res) {
  const txt = await res.text();
  try { return txt ? JSON.parse(txt) : null; } catch { return { raw: txt }; }
}

class ApiClient {
  constructor() {
    this.baseUrl = API_URL;
  }

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  }

  getPermissions() {
    const perms = localStorage.getItem('permissions');
    return perms ? JSON.parse(perms) : {};
  }

  setPermissions(permissions) {
    localStorage.setItem('permissions', JSON.stringify(permissions));
  }

  hasAccess(pageKey) {
    const permissions = this.getPermissions();
    // Admin a toujours accès à tout
    const user = this.getUser();
    if (user?.role === 'admin') return true;
    // Sinon, vérifier les permissions
    return permissions[pageKey] === true;
  }

  clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('permissions');
  }

  // Tente de rafraîchir l'access token via le refresh token
  async _refreshAccessToken() {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return false;

      const data = await safeJson(res);
      const newToken = data?.access_token || data?.data?.access_token;
      const newRefresh = data?.refresh_token || data?.data?.refresh_token;

      if (!newToken) return false;

      localStorage.setItem(TOKEN_KEY, newToken);
      if (newRefresh) localStorage.setItem(REFRESH_KEY, newRefresh);

      return true;
    } catch {
      return false;
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    };

    console.log('[API] Request:', { url, method: config.method, body: options.body });

    let response = await fetch(url, config);

    console.log('[API] Response:', { status: response.status, ok: response.ok });

    // Token expiré → tenter un refresh silencieux
    if (response.status === 401) {
      const refreshed = await this._refreshAccessToken();

      if (refreshed) {
        // Retry avec le nouveau token
        config.headers['Authorization'] = `Bearer ${this.getToken()}`;
        response = await fetch(url, config);
        console.log('[API] Retry after refresh:', { status: response.status });
      }

      // Si refresh échoué ou retry encore 401 → logout réel
      if (!refreshed || response.status === 401) {
        this.clearAuth();
        window.location.href = '/login';
        return;
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[API] Error:', error);
      throw new Error(error.detail || 'Erreur API');
    }

    return response.json();
  }

  // ============ GENERIC HTTP METHODS ============
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // ============ AUTH ============
  async login(email, password) {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(email).trim().toLowerCase(),
        password: String(password),
      }),
    });

    const payload = await safeJson(res);

    // Si l'API répond une erreur (401/400/500), on remonte un message clair
    if (!res.ok) {
      const msg =
        payload?.detail ||
        payload?.message ||
        payload?.error ||
        `Erreur login (HTTP ${res.status})`;
      throw new Error(msg);
    }

    // ✅ Ici on gère les 2 formats possibles :
    // - backend renvoie direct { access_token, user, permissions }
    // - OU { data: { access_token, user, ... } }
    const data = payload?.data ?? payload;

    const token =
      data?.access_token ||
      data?.token ||
      data?.accessToken ||
      null;

    if (!token) {
      // DEBUG: on veut voir ce que l'API renvoie réellement
      console.error("Login payload unexpected:", payload);
      throw new Error("Réponse login invalide : token manquant.");
    }

    const user = data?.user ?? null;

    // Stockage cohérent
    localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);

    // Stocker le refresh token si présent
    const refreshToken = data?.refresh_token || null;
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);

    // Stocker les permissions si présentes
    if (data.permissions) {
      this.setPermissions(data.permissions);
    }

    return data;
  }

  async getMe() {
    const token = this.getToken();
    if (!token) throw new Error("No token");

    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await safeJson(res);
    if (!res.ok) {
      const msg = payload?.detail || payload?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const data = payload?.data ?? payload;

    // Update stored user with fresh data from backend
    const userData = data?.user ?? data;
    if (userData?.id) {
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    }

    return data;
  }

  async logout() {
    // Révoquer le refresh token côté backend
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      try {
        await fetch(`${this.baseUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch { /* fire-and-forget */ }
    }
    this.clearAuth();
    window.location.href = '/login';
  }

  // ============ PASSWORD ============
  async changePassword(currentPassword, newPassword) {
    return this.post('/api/v1/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  // ============ LEADS ============
  async getLeads(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/v1/leads${query ? `?${query}` : ''}`);
  }

  async getLead(id) {
    return this.request(`/api/v1/leads/${id}`);
  }

  async updateLead(id, data) {
    return this.request(`/api/v1/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async assignLead(id, assignedTo) {
    return this.request(`/api/v1/leads/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assigned_to: assignedTo }),
    });
  }

  async unassignLead(id) {
    return this.request(`/api/v1/leads/${id}/unassign`, {
      method: 'POST',
    });
  }

  async getAssignableUsers() {
    return this.request('/api/v1/users/assignable');
  }

  // ============ TRACKING ============
  async getMyLeads() {
    return this.request('/api/v1/tracking/my-leads');
  }

  async updateTracking(id, data) {
    return this.request(`/api/v1/tracking/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ============ USERS (Admin) ============
  async getUsers() {
    return this.request('/api/v1/users');
  }

  async createUser(data) {
    return this.request('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============ LEADERBOARD ============
  async getLeaderboardStats(period = 'current_month') {
    return this.request(`/api/v1/leaderboard/stats?period=${period}`);
  }

  // ============ WORKING DAYS ============
  async getWorkingDays() {
    return this.get('/api/v1/users/me/working-days');
  }

  async updateWorkingDays(days) {
    return this.put('/api/v1/users/me/working-days', { working_days: days });
  }

  // ============ EOD STATUS ============
  async getEodStatus() {
    return this.get('/api/v1/eod/status');
  }

  // ============ MONITORING ============
  async getLeadQuality(period = 'current_month') {
    return this.request(`/api/v1/monitoring/lead-quality?period=${period}`);
  }

  async getLeaderboardChart() {
    return this.request('/api/v1/leaderboard/chart');
  }
}

export const apiClient = new ApiClient();
export default apiClient;
