import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../../../services/apiClient.js';
import { dayQuery, rangeQuery } from './period.js';

// Une lecture des Statistiques Finance sur une période. Pendant un changement de période, les chiffres précédents
// restent à l'écran (estompés par la carte) au lieu de laisser un trou ; seule la dernière demande compte.
// `days` (facultatif, { from, to } en jours de Paris) : les deux taux par sales de la Performance Sales ; sans lui, rien ne change.
export function useStatistic(name, range, days = null) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);
  const dayFrom = days?.from || null;
  const dayTo = days?.to || null;
  const query = dayFrom ? dayQuery({ from: dayFrom, to: dayTo }) : rangeQuery(range);

  useEffect(() => {
    const mine = ++latest.current;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    apiClient.get(`/api/v1/finance-statistics/${name}?${query}`)
      .then((data) => {
        if (mine !== latest.current) return;
        // Le serveur rappelle les jours qu'il a lus (`period.days`). Un serveur qui les ignorerait enverrait des mois entiers sous une
        // période en jours : aucun chiffre plutôt que de faux chiffres.
        if (dayFrom && (data?.period?.days?.from !== dayFrom || data?.period?.days?.to !== dayTo)) {
          setState({ data: null, loading: false, error: 'Cette période n’est pas encore disponible sur le serveur.' });
          return;
        }
        setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (mine === latest.current) setState((previous) => ({ ...previous, loading: false, error: error?.message || 'Lecture impossible.' }));
      });
  }, [name, query, attempt, dayFrom, dayTo]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
