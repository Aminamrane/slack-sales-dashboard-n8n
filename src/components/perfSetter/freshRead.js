// Lectures de Perf Setters gardées en mémoire, mais JAMAIS présentées comme à jour passé un délai (audit du 13/11/2026).
// Avant : une lecture gardée le temps de la page (clé = période + bouton « Actualiser ») restait affichée telle quelle des heures durant, tant
// que personne n'appuyait sur « Actualiser » : les RDV posés depuis la première ouverture n'apparaissaient pas en revenant sur l'onglet.
//   · une lecture est « à jour » pendant `ttl` ms, et tant que la version (le compteur du bouton « Actualiser ») est la même ;
//   · au-delà, la dernière valeur reste affichée tout de suite (jamais d'écran blanc, pas de saut) pendant qu'on relit, et la nouvelle la remplace ;
//   · une relecture déjà en cours est partagée : deux composants qui demandent la même clé n'envoient qu'une requête ;
//   · un échec garde la dernière valeur (règle C.7 de la charte : « un échec garde les dernières données »).
// Logique pure et testée (freshRead.test.js) ; le hook React qui la branche est en dessous.
import { useEffect, useRef, useState } from 'react';

export const FRESH_MS = 30_000;

export function createReadStore({ ttl = FRESH_MS, now = Date.now } = {}) {
  const entries = new Map();
  const isFresh = (entry, version) => !!entry && entry.hasValue && entry.version === version && now() - entry.at < ttl;
  return {
    ttl,
    // La dernière valeur connue pour cette clé (même ancienne) et si elle est encore à jour ; null si rien n'a jamais été lu.
    peek(key, version = 0) {
      const entry = entries.get(key);
      return entry && entry.hasValue ? { value: entry.value, at: entry.at, fresh: isFresh(entry, version) } : null;
    },
    // Lecture à jour : celle en mémoire si elle l'est, sinon la relecture en cours (partagée), sinon une nouvelle.
    load(key, loader, version = 0) {
      let entry = entries.get(key);
      if (isFresh(entry, version)) return Promise.resolve(entry.value);
      if (entry?.inflight && entry.inflightVersion === version) return entry.inflight;
      if (!entry) { entry = { hasValue: false }; entries.set(key, entry); }
      let started;
      try { started = Promise.resolve(loader()); } catch (error) { started = Promise.reject(error); }   // la requête part tout de suite (pas de tick de plus)
      entry.inflight = started;
      entry.inflightVersion = version;
      started.then(
        (value) => { if (entry.inflight === started) Object.assign(entry, { value, hasValue: true, at: now(), version, inflight: null }); },
        () => { if (entry.inflight === started) entry.inflight = null; },
      );
      return started;
    },
    clear() { entries.clear(); },
  };
}

// Lecture d'une clé du magasin : { value, error, refreshing }.
//   value      : la dernière valeur connue (null tant que rien n'a été lu) ;
//   error      : vrai seulement si la lecture a échoué ET qu'il n'y a aucune valeur à montrer ;
//   refreshing : une relecture est en cours alors qu'une valeur (ancienne) est déjà affichée.
// `version` : le compteur du bouton « Actualiser » (une version nouvelle impose une relecture) ; `revalidateOnVisible` : relit au retour sur l'onglet du
// navigateur si la valeur n'est plus à jour. `loader` peut changer à chaque rendu sans relancer la lecture.
export function useStoreRead(store, key, loader, { version = 0, enabled = true, revalidateOnVisible = true } = {}) {
  const [state, setState] = useState(() => initialState(store, key, version, enabled));
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  useEffect(() => {
    if (!enabled || !key) { setState({ value: null, error: false, refreshing: false }); return undefined; }
    let alive = true;
    const read = () => {
      const seen = store.peek(key, version);
      if (seen?.fresh) { setState({ value: seen.value, error: false, refreshing: false }); return; }
      setState({ value: seen ? seen.value : null, error: false, refreshing: !!seen });
      store.load(key, () => loaderRef.current(), version)
        .then((value) => { if (alive) setState({ value, error: false, refreshing: false }); })
        .catch(() => { if (alive) setState((s) => ({ value: s.value, error: s.value == null, refreshing: false })); });
    };
    read();
    const onVisible = () => { if (typeof document !== 'undefined' && !document.hidden) read(); };
    if (revalidateOnVisible && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; if (revalidateOnVisible && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible); };
  }, [store, key, version, enabled, revalidateOnVisible]);
  return state;
}

function initialState(store, key, version, enabled) {
  const seen = enabled && key ? store.peek(key, version) : null;
  return { value: seen ? seen.value : null, error: false, refreshing: !!seen && !seen.fresh };
}
