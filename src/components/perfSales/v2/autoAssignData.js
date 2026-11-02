import { useEffect, useState } from 'react';
import apiClient from '../../../services/apiClient';
import { fr } from './model';

// Données de l'auto-affectation (/monitoring/performance/v2/auto-assign) : la période, la requête, le chargement.
// Partagé par l'onglet Auto-affectation de la Performance Sales (leads ADS → sales) et par l'onglet « RDV Setter → Sales »
// de Perf Setter : un seul appel, un seul calcul de période. `refreshKey` relance la lecture (bouton « Actualiser »).

export function periodQuery(period, month) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const back = (n) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const base = /^\d{4}-\d{2}$/.test(month || '') ? month : today.slice(0, 7);
  const [y, m] = base.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  if (period.key === 'month') return `period=${base}`;
  if (period.key === '7d') return `start=${back(6)}&end=${today}`;
  if (period.key === '30d') return `start=${back(29)}&end=${today}`;
  if (period.key === 'prev') return `period=${prev}`;
  return period.start && period.end && period.start <= period.end ? `start=${period.start}&end=${period.end}` : null;
}

export function shiftDay(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const todayParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
export const longDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
export const pctOf = (v, t) => (t ? `${fr((v / t) * 100, 0)} %` : '');

export function useAutoAssignData(month, refreshKey = 0) {
  const [period, setPeriod] = useState({ key: 'month' });
  const [state, setState] = useState({ data: null, loading: true, error: false });
  useEffect(() => {
    const q = periodQuery(period, month);
    if (!q) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    apiClient.get(`/api/v1/monitoring/performance/v2/auto-assign?${q}`)
      .then((data) => alive && setState({ data, loading: false, error: false }))
      .catch(() => alive && setState({ data: null, loading: false, error: true }));
    return () => { alive = false; };
  }, [period, month, refreshKey]);
  const analytics = state.data ? { period: { start: state.data.start, end: shiftDay(state.data.end, 1) } } : null;
  return { period, setPeriod, state, analytics };
}
