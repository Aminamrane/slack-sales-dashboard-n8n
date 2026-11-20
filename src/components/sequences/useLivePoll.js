import { useCallback, useEffect, useRef, useState } from 'react';

// Lecture « en direct » d'une ressource (le serveur envoie chaque minute ; la page se met à jour toutes les 20 s).
//
// Ce que fait ce hook et que l'ancienne page ne faisait pas :
//  - rien n'est lu tant que l'onglet du navigateur est caché (plus d'appels pour une page que personne ne regarde) ;
//    au retour dans l'onglet, une lecture repart tout de suite si la dernière date de plus d'un cycle ;
//  - jamais deux lectures de la même ressource en même temps, et la dernière demandée l'emporte (changer de période
//    pendant qu'une lecture est en vol ne laisse plus la réponse périmée écraser la bonne) ;
//  - les données d'une autre clé (autre période, autre séquence) ne sont jamais montrées : un chiffre d'une autre
//    période serait faux ; on repasse par le chargement ;
//  - une lecture en échec garde les dernières données et le dit (`error`) ; sans donnée, c'est un vrai état d'erreur.
//
// `fetcher` peut changer à chaque rendu (il est lu par référence) ; c'est `key` qui décide d'une nouvelle ressource.
export default function useLivePoll(fetcher, { key = 'default', ms = 20000, enabled = true } = {}) {
  const [state, setState] = useState({ key, data: null, error: '', updatedAt: null, busy: false });
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const token = useRef(0);
  const alive = useRef(true);
  const timer = useRef(null);
  const lastAt = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async (forKey) => {
    if (inFlight.current) return false;                     // une lecture à la fois ; la suivante part à son tour
    inFlight.current = true;
    const mine = ++token.current;
    setState((s) => (s.key === forKey ? { ...s, busy: true } : { key: forKey, data: null, error: '', updatedAt: null, busy: true }));
    try {
      const data = await fetchRef.current();
      lastAt.current = Date.now();
      if (alive.current && mine === token.current) setState({ key: forKey, data, error: '', updatedAt: new Date().toISOString(), busy: false });
      return true;
    } catch (e) {
      lastAt.current = Date.now();
      if (alive.current && mine === token.current) setState((s) => ({ ...s, key: forKey, error: e?.message || 'Erreur', busy: false }));
      return false;
    } finally {
      if (mine === token.current) inFlight.current = false;   // une lecture périmée ne libère pas la place de la nouvelle
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
    const schedule = () => {
      clear();
      if (stopped || document.hidden) return;
      timer.current = setTimeout(async () => { await load(key); schedule(); }, ms);
    };
    const onVisible = () => {
      if (document.hidden) { clear(); return; }
      if (Date.now() - lastAt.current >= ms) load(key).then(schedule); else schedule();
    };
    // Nouvelle clé : une lecture immédiate (une éventuelle lecture en vol de l'ancienne clé est périmée, la nouvelle l'emporte).
    token.current += 1;
    inFlight.current = false;
    lastAt.current = 0;
    if (!document.hidden) load(key).then(schedule);
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; clear(); document.removeEventListener('visibilitychange', onVisible); };
  }, [key, ms, enabled, load]);

  // Lecture à la demande (bouton d'actualisation) : relance le cycle.
  const refresh = useCallback(() => load(key), [load, key]);

  const mine = state.key === key;
  return {
    data: mine ? state.data : null,
    error: mine ? state.error : '',
    updatedAt: mine ? state.updatedAt : null,
    busy: mine ? state.busy : true,
    refresh,
  };
}
