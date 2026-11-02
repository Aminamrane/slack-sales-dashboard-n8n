import { useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';

// Données et réglages communs de Perf Setter. Les lectures sont celles de l'ancien onglet « Setters » de la Performance Sales (mêmes
// routes, mêmes paramètres) : rien n'est écrit, rien n'est recalculé ici.

// Les setters du mois et leurs appels Allo : deux lectures indépendantes, l'échec d'Allo n'empêche pas le reste (« Appels indisponibles »).
// `refreshKey` relance les lectures (bouton « Actualiser »).
export function useSetterMonth(month, refreshKey = 0) {
  const [state, setState] = useState({ data: null, calls: null, error: false });
  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month || '')) return undefined;
    let alive = true;
    setState({ data: null, calls: null, error: false });
    apiClient.get(`/api/v1/monitoring/performance/v2/setters?period=${month}`).then((d) => alive && setState((s) => ({ ...s, data: d }))).catch(() => alive && setState((s) => ({ ...s, error: true })));
    apiClient.get(`/api/v1/monitoring/performance/v2/setters/calls?period=${month}`).then((d) => alive && setState((s) => ({ ...s, calls: d }))).catch(() => alive && setState((s) => ({ ...s, calls: { status: 'error', setters: {} } })));
    return () => { alive = false; };
  }, [month, refreshKey]);
  return state;
}

// Jours ouvrés du mois (pilotage.days de la Performance Sales : écoulés, restants, total) : les moyennes par jour et le volume d'appels
// « pour l'objectif » s'appuient sur le MÊME calendrier que la Performance Sales. Absent (lecture en cours ou en échec) : pas de moyenne par jour.
export function useMonthDays(month, refreshKey = 0) {
  const [days, setDays] = useState(null);
  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month || '')) return undefined;
    let alive = true;
    setDays(null);
    apiClient.get(`/api/v1/monitoring/performance/v2?period=${month}`).then((d) => alive && setDays(d?.pilotage?.days || null)).catch(() => {});
    return () => { alive = false; };
  }, [month, refreshKey]);
  return days;
}
