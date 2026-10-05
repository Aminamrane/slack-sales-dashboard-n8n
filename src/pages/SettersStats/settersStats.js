// Page CEO « Setters » (demande dev 05/10/2026, pour Paul) : logique pure, testée.
// Données : GET /api/v1/ceo-dashboard/setters?month=YYYY-MM (calculs côté serveur, voir app/services/ceo_setters.py).
export { OUTCOME_HINTS, OUTCOME_LABELS, OUTCOME_TONES, assignedLabel, fmtRdv } from '../../utils/setterWebinarRdv.js';

const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export const CHANNEL_LABELS = { crm: 'CRM', webinar_link: 'Lien webinaire' };

export function fmtMonth(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''));
  if (!m) return '';
  const label = MONTHS_LONG[Number(m[2]) - 1];
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${m[1]}`;
}

export function fmtMonthShort(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''));
  return m ? `${MONTHS_SHORT[Number(m[2]) - 1]} ${m[1].slice(2)}` : '';
}

export const fmtInt = (n) => new Intl.NumberFormat('fr-FR').format(Number(n) || 0);

export const fmtEuro = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(Number(n) || 0);

// Part des RDV honorés devenus clients. Sans RDV honoré : pas de taux (jamais un 0 % trompeur).
export function conversion(rdv) {
  const held = Number(rdv?.held) || 0;
  if (!held) return null;
  return Math.round((100 * (Number(rdv?.clients) || 0)) / held);
}

export const fmtRate = (pct) => (pct === null || pct === undefined ? 'n/a' : `${pct} %`);

// Date de signature (instant réel, avec fuseau) affichée en heure de Paris.
export function fmtDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

// Mois voisin dans la liste des mois couverts (null au bord).
export function neighbourMonth(months, month, step) {
  const i = (months || []).indexOf(month);
  if (i < 0) return null;
  return months[i + step] ?? null;
}

// Résultat d'un RDV de setter vu par le CEO : client, déjà client, contrat sans déclaration, sinon le résultat du RDV.
export function clientState(row) {
  if (row?.client) return 'client';
  if (row?.already_client) return 'already_client';
  if (row?.signed_not_declared) return 'signed_not_declared';
  return null;
}

export const CLIENT_STATE_LABELS = {
  client: 'Devenu client',
  already_client: 'Déjà client',
  signed_not_declared: 'Contrat signé, vente non déclarée',
};

// Lignes du tableau : les setters qui ont une activité sur le mois, puis les autres (actifs) à zéro.
export function rowsForMonth(setters, month) {
  return (setters || []).map((s) => ({
    ...s,
    month: s.months?.[month] || { rdv: {}, sales: {} },
  })).sort((a, b) => (
    (b.month.sales.count || 0) - (a.month.sales.count || 0)
    || (b.month.rdv.total || 0) - (a.month.rdv.total || 0)
    || (b.totals?.sales?.count || 0) - (a.totals?.sales?.count || 0)
    || String(a.name || '').localeCompare(String(b.name || ''), 'fr')
  ));
}

// Origine du lead d'un client (règle meta_ads_history.sale_channel côté serveur), avec les mots du CEO.
export const ORIGIN_LABELS = {
  webinar: 'Webinaire', ads: 'Ads', cold_call_sales: 'Cold call sales', cold_call_setter: 'Cold call setter',
  partners: 'Partenaires', other: 'Autre',
};
export const ORIGIN_TONES = {
  webinar: '#8b5cf6', ads: '#3b82f6', cold_call_sales: '#f97316', cold_call_setter: '#14b8a6',
  partners: '#64748b', other: '#94a3b8',
};

// Répartition par origine, la plus fréquente d'abord : [[clé, nombre], …].
export function originEntries(origins) {
  return Object.entries(origins || {}).filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || String(ORIGIN_LABELS[a[0]] || a[0]).localeCompare(String(ORIGIN_LABELS[b[0]] || b[0]), 'fr'));
}
