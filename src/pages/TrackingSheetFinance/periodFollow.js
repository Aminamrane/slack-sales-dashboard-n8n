// periodFollow.js : le mois affiché suit le mois en cours.
//
// Incident 01/10/2026 : un onglet ouvert la veille montrait encore septembre
// le 1er octobre, parce que la page gardait le mois de son ouverture. Les
// trois onboardings du jour (n°729, n°773, n°771) avaient leur attendu en
// octobre : rien ne se voyait.
//
// Règle : tant que la page affiche le mois en cours, elle le SUIT (un onglet
// resté ouvert passe au mois suivant tout seul). Un mois choisi à la main
// (flèches, sélecteur, ou `?period=` dans l'URL) qui n'est pas le mois en
// cours n'est jamais écrasé ; revenir sur le mois en cours réactive le suivi.
//
// État : { period: 'YYYY-MM', following: boolean }. Fonctions pures, le mois
// courant est passé en paramètre (`now`, 'YYYY-MM') pour rester testables.

import { parisToday } from '../../utils/parisDates.js';

const PERIOD_RE = /^20\d{2}-(0[1-9]|1[0-2])$/;

// Le mois en cours à l'heure de Paris, celle du serveur et de la finance :
// un poste réglé sur un autre fuseau (Montréal, vacances) passe au nouveau
// mois à minuit à Paris, pas à son minuit local. Toute la page compare avec
// CE mois (ouverture, choix, contrôle), sinon un mois choisi pourrait être
// pris pour un mois suivi.
export const parisCurrentPeriod = (now = new Date()) => parisToday(now).slice(0, 7);

// Ouverture de la page : `?period=` valide l'emporte ; il ne fige l'affichage
// que s'il désigne un AUTRE mois que le mois en cours.
export const initialPeriodState = (requested, now) => (
  PERIOD_RE.test(requested || '')
    ? { period: requested, following: requested === now }
    : { period: now, following: true }
);

// Choix explicite de l'utilisateur.
export const choosePeriodState = (chosen, now) => ({ period: chosen, following: chosen === now });

// Contrôle périodique : renvoie le MÊME objet quand rien ne change (React
// n'émet alors aucun rendu), sinon le nouvel état sur le mois en cours.
export const followCurrentMonth = (state, now) => (
  state.following && PERIOD_RE.test(now || '') && state.period !== now
    ? { period: now, following: true }
    : state
);

// L'URL porte-t-elle un `?period=` ? Si oui, on le remplace par le mois suivi
// pour qu'un rechargement montre ce qui est affiché. Renvoie la nouvelle
// query string, ou null quand l'URL n'a pas de mois (rien à réécrire).
export const withPeriodParam = (search, period) => {
  const params = new URLSearchParams(search || '');
  if (!params.has('period') || params.get('period') === period) return null;
  params.set('period', period);
  return `?${params}`;
};
