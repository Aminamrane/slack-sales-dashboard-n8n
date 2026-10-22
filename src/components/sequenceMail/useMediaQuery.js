// src/components/sequenceMail/useMediaQuery.js
//
// Suit une media query (taille d'écran, préférence de mouvement…) : `true` tant qu'elle correspond, et se
// remet à jour quand elle change (redimensionnement, réglage du système).

import { useEffect, useState } from 'react';

/** @param query Media query CSS complète, ex. `(max-width: 899px)`. */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}
