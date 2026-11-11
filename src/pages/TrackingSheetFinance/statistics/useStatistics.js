import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../../../services/apiClient.js';
import { rangeQuery } from './period.js';

// Une lecture des Statistiques Finance sur une période. Pendant un changement de période, les chiffres précédents
// restent à l'écran (estompés par la carte) au lieu de laisser un trou ; seule la dernière demande compte.
export function useStatistic(name, range) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);
  const query = rangeQuery(range);

  useEffect(() => {
    const mine = ++latest.current;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    apiClient.get(`/api/v1/finance-statistics/${name}?${query}`)
      .then((data) => { if (mine === latest.current) setState({ data, loading: false, error: null }); })
      .catch((error) => {
        if (mine === latest.current) setState((previous) => ({ ...previous, loading: false, error: error?.message || 'Lecture impossible.' }));
      });
  }, [name, query, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
