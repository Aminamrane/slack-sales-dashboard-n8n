// src/utils/readOnlyRoles.js
//
// Lecture seule des pages de la direction (dev 06/11/2026). Les RH (rôle hr)
// voient toutes les pages de la direction financière : barre latérale,
// tableau de bord CEO, Finance, Board Owner/Opti'Lex, Webinaire,
// Auto-affectation, Campagnes. Ils n'y écrivent rien.
//
// Règle d'écran (dev : « faut qu'il puisse le voir, faut pas que ce soit
// caché, mais faut pas qu'il puisse modifier ») : la même page que la
// direction financière, rien n'est retiré. Chaque contrôle qui écrit reste
// visible et DÉSACTIVÉ (grisé, curseur interdit, « Lecture seule » au survol) ;
// un dialogue de saisie ne s'ouvre pas. Les lectures restent actives.
//
// Miroir de READ_ONLY_DIRECTION_ROLES côté API (app/core/roles.py), qui reste
// la garde qui fait foi : le serveur ouvre à ces rôles les routes de lecture
// (GET) de ces pages et refuse toute écriture (403).

export const READ_ONLY_DIRECTION_ROLES = new Set(["hr"]);

export function isReadOnlyViewer(role) {
  return READ_ONLY_DIRECTION_ROLES.has(role);
}

export const READ_ONLY_TITLE = "Lecture seule";

// Attributs d'un contrôle d'écriture désactivé (bouton, champ, sélecteur).
// À étaler APRÈS les props du contrôle : `disabled` et `title` l'emportent.
// L'aspect grisé vient de styles/readOnly.css (attribut data-read-only).
export const READ_ONLY_PROPS = Object.freeze({
  disabled: true,
  title: READ_ONLY_TITLE,
  "aria-disabled": true,
  "data-read-only": "true",
});

// Même marque pour un élément qui n'est pas un contrôle de formulaire (zone
// cliquable, étiquette) : son onClick doit en plus être retiré par l'appelant.
export const READ_ONLY_MARK = Object.freeze({
  title: READ_ONLY_TITLE,
  "aria-disabled": true,
  "data-read-only": "true",
});

// `{}` pour les autres rôles : rien ne change pour eux.
export function readOnlyProps(role) {
  return isReadOnlyViewer(role) ? READ_ONLY_PROPS : {};
}
