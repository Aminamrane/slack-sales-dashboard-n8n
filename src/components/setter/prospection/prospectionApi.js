// Accès aux routes /prospection du backend (l'API Leads n'est jamais appelée depuis le navigateur).
// Les critères sont ceux de la doc de l'API Leads : département et code NAF pour le stock et les
// listes ; en plus, pour une recherche Pappers : tranches d'effectif, catégories juridiques, âge.
import apiClient from '../../../services/apiClient';

const BASE = '/api/v1/prospection';

export const errorMessage = (err, fallback = 'Une erreur est survenue. Réessayez.') => {
  const detail = err?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return err?.message && err.message !== 'Erreur API' ? err.message : fallback;
};

const query = (params) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') search.set(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const prospectionApi = {
  meta: () => apiClient.get(`${BASE}/meta`),
  stockSize: () => apiClient.get(`${BASE}/stock-size`),
  suggest: (q) => apiClient.get(`${BASE}/suggest${query({ q })}`),
  available: ({ departement, codeNaf, cursor, limit = 50 }) =>
    apiClient.get(`${BASE}/available${query({ departement, code_naf: codeNaf, cursor, limit })}`),
  lists: () => apiClient.get(`${BASE}/lists`),
  createList: ({ name, departement, codeNaf, count }) =>
    apiClient.post(`${BASE}/lists`, { name, departement: departement || null, code_naf: codeNaf || null, count }),
  getList: (id) => apiClient.get(`${BASE}/lists/${id}`),
  deleteList: (id) => apiClient.delete(`${BASE}/lists/${id}`),
  items: (id, { q = '', status = '', page = 1, pageSize = 50 } = {}) =>
    apiClient.get(`${BASE}/lists/${id}/items${query({ q, status, page, page_size: pageSize })}`),
  setStatus: (itemId, status) => apiClient.patch(`${BASE}/items/${itemId}`, { status }),
  removeItem: (itemId) => apiClient.delete(`${BASE}/items/${itemId}`),
  exportCrm: (id, itemIds = null) => apiClient.post(`${BASE}/lists/${id}/export-crm`, { item_ids: itemIds }),
  // R1 pris depuis la liste : `body` = celui du parcours setter (r1_date, target_sales_email, notes, target_calendar).
  placeR1: (itemId, body, email) => apiClient.post(`${BASE}/items/${itemId}/place-r1`, { ...body, email: email || null }),
  // R1 de l'agenda unique : le serveur attribue le commercial (préférence de secteur, puis équité).
  bookR1: (itemId, body, email) => apiClient.post(`${BASE}/items/${itemId}/book-r1`, { ...body, email: email || null }),
  poolStats: ({ departement, codeNaf }) => apiClient.get(`${BASE}/pool-stats${query({ departement, code_naf: codeNaf })}`),
  pappersSearches: () => apiClient.get(`${BASE}/pappers-searches`),
  launchPappers: (body) => apiClient.post(`${BASE}/pappers-searches`, body),
  async downloadCsv(id) {
    const response = await apiClient._authenticatedFetch(`${apiClient.baseUrl}${BASE}/lists/${id}/export.csv`);
    if (!response.ok) throw new Error('Export CSV impossible. Réessayez.');
    const blob = await response.blob();
    const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || 'prospection.csv';
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
