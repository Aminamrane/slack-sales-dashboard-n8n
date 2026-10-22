// src/components/sequenceMail/draftsGuard.js
//
// Garde « brouillons perdus au rechargement » de l'éditeur de mail (PROTOTYPE) : les brouillons ne vivent
// qu'en mémoire (cf. dataStore.js) ; tant qu'il en existe au moins un, recharger ou fermer l'onglet fait
// demander une confirmation au navigateur plutôt que de les perdre en silence.
//
// L'écouteur `beforeunload` est unique et compté : le schéma et l'éditeur appellent chacun ce hook, un seul
// écouteur est posé tant que l'un d'eux est monté ET qu'un brouillon existe ; il est retiré dès qu'il n'y a
// plus de brouillon (« Rétablir l'original ») ou plus de fenêtre pour le porter.
// NB : si toutes les fenêtres de séquence sont fermées, plus aucun composant ne le porte — l'appeler aussi
// depuis un composant monté en permanence (la page) couvrirait ce cas.

import { useEffect } from 'react';
import { useDataStore } from './dataStore';
import { hasAnyDraft } from './mailDraft';

let holders = 0;

/** @brief Demande au navigateur de confirmer le départ (le texte de l'invite n'est plus personnalisable). */
const onBeforeUnload = (event) => {
  event.preventDefault();
  event.returnValue = '';
};

/** @brief Garde `beforeunload` active tant qu'il existe au moins un brouillon en mémoire. */
export function useDraftsUnloadGuard() {
  const hasDraft = useDataStore((d) => hasAnyDraft(d.drafts));
  useEffect(() => {
    if (!hasDraft) return undefined;
    if (holders === 0) window.addEventListener('beforeunload', onBeforeUnload);
    holders += 1;
    return () => {
      holders -= 1;
      if (holders === 0) window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [hasDraft]);
}
