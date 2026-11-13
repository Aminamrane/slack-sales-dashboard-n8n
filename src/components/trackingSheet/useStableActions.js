import { useLayoutEffect, useRef } from 'react';

// Fonctions d'un grand composant données à des enfants mémorisés (React.memo).
//
// Les fonctions d'un composant sont recréées à chaque rendu : passées telles quelles, elles feraient redessiner tous
// les enfants à chaque fois. Ici l'objet rendu ne change jamais d'identité, et chacune de ses fonctions appelle la
// DERNIÈRE version de celle du parent : aucun état périmé au moment du clic.
//
// À réserver aux fonctions appelées sur un geste (clic, saisie). Ce qui sert pendant le rendu passe par une prop.
export function useStableActions(actions) {
  const latest = useRef(actions);
  useLayoutEffect(() => { latest.current = actions; });
  const stable = useRef(null);
  if (!stable.current) {
    stable.current = Object.fromEntries(Object.keys(actions).map(name => [name, (...args) => latest.current[name](...args)]));
  }
  return stable.current;
}
