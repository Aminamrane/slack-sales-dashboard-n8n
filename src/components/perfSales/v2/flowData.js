import { fr } from './model.js';

// Des fiches de Funnel Leads aux colonnes de l'onglet Canaux (dev 15/10/2026 : « ADS affectés 255, comment c'est
// possible quand Funnel Leads nous dit 444 ? »). Chaque fiche entrante du mois est dans UNE bande, calculée à l'unité
// par le serveur (`intake.flow`) : jamais donnée (motif du moteur), ou donnée et aujourd'hui chez le sales affecté, reprise
// du pool par un autre sales, au pool sans repreneur, dans un autre canal. Les bandes « chez le sales affecté » et
// « repris du pool » sont les colonnes ADS du tableau ci-dessous. Dessin : AdsFlow.jsx, agencement : flowLayout.js.
const OTHER = { linkedin: 'LinkedIn', referral: 'parrainage', webinar: 'webinaire', cold_call: 'cold call', ccs: 'CCS', setter_rdv: 'setter', second_chance: 'seconde chance' };
const GREYS = ['#8b95a7', '#a3abbb', '#b9c0cc', '#cdd2dc', '#dde1e8'];
export const FLOW_GROUPS = {
  given: { label: 'Données à un sales', color: '#1e3a7b', ink: '#ffffff' },
  not: { label: 'Jamais données', color: '#8b95a7', ink: '#121b35' },
};

export function flowNodes(intake) {
  const f = intake?.flow;
  if (!f || !intake.created) return null;
  const others = Object.entries(f).filter(([k, v]) => k.startsWith('other_') && v);
  const column = (own, outside) => (own || 0) + (outside || 0);
  const given = [
    { key: 'ads_affectation', label: 'Chez le sales affecté', value: f.ads_affectation || 0, color: '#1e3a7b',
      lines: ['Le sales que le moteur a choisi l’a toujours (ou l’a reçu après un raté des 6 minutes d’un collègue).',
        `Colonne « ADS affectés » : ${fr(column(f.ads_affectation, f.outside_affectation))}${f.outside_affectation ? ` (dont ${fr(f.outside_affectation)} reçu par la date du formulaire, fiche créée avant le mois)` : ''}.`] },
    { key: 'ads_pool', label: 'Repris du pool par un autre sales', value: f.ads_pool || 0, color: '#7f9ad9',
      lines: ['Reparti au pool commun, puis repris par un autre sales.', `Colonne « ADS repris du pool » : ${fr(column(f.ads_pool, f.outside_pool))}.`] },
    { key: 'pool_waiting', label: 'Au pool, personne ne l’a repris', value: f.pool_waiting || 0, color: '#c3cde3',
      lines: ['Donné à un sales, reparti au pool commun, et pas encore repris : il ne compte pour aucun sales.'] },
    { key: 'others', label: 'Autres canaux', sub: others.map(([k, v]) => `${OTHER[k.slice(6)] || k.slice(6)} ${v}`).join(' · '),
      value: others.reduce((a, [, v]) => a + v, 0), color: '#3e7d5a', lines: ['Fiches entrantes de LinkedIn, parrainage ou webinaire : dans leur canal, pas dans les ADS.'] },
    { key: 'same_contact', label: 'Même contact déjà chez ce sales', value: f.same_contact || 0, color: '#aeb6c6', lines: ['Compté une fois par sales et par contact.'] },
    { key: 'demo', label: 'Comptes de test ou de démo', value: f.demo || 0, color: '#d5dae3', lines: ['Hors statistiques.'] },
  ].filter((n) => n.value > 0);
  const notGiven = [
    { key: 'not_given_small', label: 'Moins de 100 k€, écartées', value: f.not_given_small || 0 },
    { key: 'not_given_duplicate', label: 'Doublons d’un contact déjà reçu', value: f.not_given_duplicate || 0 },
    { key: 'not_given_webinar', label: 'Inscrits webinaire pris par les setters', value: f.not_given_webinar || 0 },
    { key: 'not_given_unclassifiable', label: 'Non classables (tests)', value: f.not_given_unclassifiable || 0 },
    { key: 'not_given_waiting', label: 'Pas encore attribuées', value: f.not_given_waiting || 0 },
  ].filter((n) => n.value > 0).map((n, i) => ({ ...n, color: GREYS[i % GREYS.length], lines: ['Jamais données à un sales : motif du moteur d’affectation (dernier passage).'] }));
  const sum = (list) => list.reduce((a, n) => a + n.value, 0);
  return { total: intake.created, given, notGiven, givenTotal: sum(given), notGivenTotal: sum(notGiven), small: f.small_segment || 0, smallGiven: f.small_given || 0 };
}

export const nodeText = (n) => (n.sub ? `${n.label} (${n.sub})` : n.label);
