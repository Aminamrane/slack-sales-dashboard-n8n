// Routes « Seconde chance » des setters (/tracking/setter/second-chance du backend).
import apiClient from '../../../services/apiClient';

const BASE = '/api/v1/tracking/setter/second-chance';
const asSetterQuery = (asSetter) => (asSetter ? `?as_setter=${encodeURIComponent(asSetter)}` : '');

export const secondChanceApi = {
  pool: (asSetter) => apiClient.get(`${BASE}${asSetterQuery(asSetter)}`),
  history: (leadId, asSetter) => apiClient.get(`${BASE}/${leadId}/history${asSetterQuery(asSetter)}`),
  claim: (leadId) => apiClient.post(`${BASE}/${leadId}/claim`, {}),
  called: (leadId, note) => apiClient.post(`${BASE}/${leadId}/called`, { note: note || null }),
  release: (leadId, note) => apiClient.post(`${BASE}/${leadId}/release`, { note: note || null }),
  discard: (leadId, reason) => apiClient.post(`${BASE}/${leadId}/discard`, { reason }),
};

export const errorMessage = (err, fallback = 'Une erreur est survenue. Réessayez.') => {
  const detail = err?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
};
