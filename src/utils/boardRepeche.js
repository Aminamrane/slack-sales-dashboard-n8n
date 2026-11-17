// Clients repêchés et no show qualifié (dev 17/11/2026) : textes, filtre et historique du board, sans React.
// Le serveur décide (fiche de conservation, fenêtre de repêchage, qualification) ; ici on l'affiche.
import { weatherFilter } from './weatherCase.js';

export const RESILIATION = 'En cours de résiliation';
// Qui remplit la fiche de conservation : le Client Success et la direction (même liste que le serveur).
export const CONSERVATION_ROLES = ['customer_success_manager', 'admin', 'ceo'];
export const CONSERVATION_ISSUES = [
  { key: 'repeche', label: 'Repêché' },
  { key: 'probleme_operationnel', label: 'Problème opérationnel' },
  { key: 'depart', label: 'Le client part' },
];
export const REPECHE_FILTER = 'repeche';

// JJ/MM : une date seule telle qu'écrite (pas de fuseau), un instant à l'heure de Paris.
export function dayMonth(value) {
  if (!value) return '';
  const day = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) return `${day[3]}/${day[2]}`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' });
}

// Encart de la fenêtre météo : « Client repêché le JJ/MM par X · jusqu'au JJ/MM ».
export function repecheLine(repeche) {
  if (!repeche) return '';
  return `Client repêché le ${dayMonth(repeche.at)}${repeche.by ? ` par ${repeche.by}` : ''} · jusqu'au ${dayMonth(repeche.until)}`;
}

// Ligne d'historique : « No show à l'onboarding du JJ/MM, qualifié par X ».
// « probable » : rendez-vous déplacé le jour même, retrouvé par la statistique de la Finance sans geste du CSM.
export function noShowLine(noShow) {
  return `No show${noShow.level === 'probable' ? ' probable' : ''} à l'onboarding du ${dayMonth(noShow.rdv_date)}${noShow.qualified_by_name ? `, qualifié par ${noShow.qualified_by_name}` : ''}`;
}

// Créneau posé chez le cabinet (heure-mur de Paris, sans fuseau) : « JJ/MM à HHhMM ».
export function slotLabel(slot) {
  const m = String(slot || '').match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[2]}/${m[1]} à ${m[3]}h${m[4]}` : '';
}

// Rangée Météo : les bandes cochées et la pastille « Repêchés » en union (rien de coché = tout passe).
export function matchesMeteo(row, selected) {
  if (!selected.length) return true;
  return selected.includes(weatherFilter(row.meteo_score, row.meteo_context))
    || (selected.includes(REPECHE_FILTER) && !!row.repeche);
}

// Historique de la fiche : changements d'état, fiches de conservation et no shows qualifiés, le plus récent en haut.
export function historyItems(data) {
  const at = (v) => { const t = Date.parse(v || ''); return Number.isNaN(t) ? 0 : t; };
  return [
    ...(data?.history || []).map((h) => ({ ...h, kind: 'etat', key: `etat-${h.id}` })),
    ...(data?.conservations || []).map((c) => ({ ...c, kind: 'conservation', key: `conservation-${c.id}` })),
    ...(data?.no_shows || []).map((n) => ({ ...n, kind: 'no_show', key: `no_show-${n.id}` })),
  ].sort((a, b) => at(b.created_at) - at(a.created_at));
}
