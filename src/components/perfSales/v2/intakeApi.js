import apiClient from '../../../services/apiClient';

// Lectures du détail des fiches et de l'historique d'un lead (Perf Sales, 16/10/2026), gardées le temps de la page.
const fiches = new Map();
export function loadIntake(period) {
  if (!fiches.has(period)) {
    fiches.set(period, apiClient.get(`/api/v1/monitoring/performance/v2/intake/leads?period=${encodeURIComponent(period)}`)
      .catch((e) => { fiches.delete(period); throw e; }));
  }
  return fiches.get(period);
}

// Historique : d'abord sans les appels Allo (immédiat), puis avec (relevé Allo, quelques secondes au premier appel).
const histories = new Map();
export function loadHistory(id, calls) {
  const key = `${id}:${calls ? 1 : 0}`;
  if (!histories.has(key)) {
    histories.set(key, apiClient.get(`/api/v1/monitoring/performance/v2/leads/${id}/history?calls=${calls ? 'true' : 'false'}`)
      .catch((e) => { histories.delete(key); throw e; }));
  }
  return histories.get(key);
}
