import { useEffect, useState } from 'react';
import apiClient from '../../../services/apiClient';

// RDV posés par jour par les setters (/monitoring/performance/v2/setters/placed), gardés le temps de la page.
const cache = new Map();
export function usePlacements(start, end) {
  const [state, setState] = useState([null, false]);
  useEffect(() => {
    if (!start || !end) return undefined;
    let alive = true;
    const key = `${start}|${end}`;
    setState([null, false]);
    if (!cache.has(key)) {
      cache.set(key, apiClient.get(`/api/v1/monitoring/performance/v2/setters/placed?start=${start}&end=${end}`).catch((e) => { cache.delete(key); throw e; }));
    }
    cache.get(key).then((d) => alive && setState([d, false])).catch(() => alive && setState([null, true]));
    return () => { alive = false; };
  }, [start, end]);
  return state;
}

const pad = (n) => String(n).padStart(2, '0');
export const monthRange = (ym) => { const [y, m] = ym.split('-').map(Number); return [`${ym}-01`, `${ym}-${pad(new Date(y, m, 0).getDate())}`]; };
