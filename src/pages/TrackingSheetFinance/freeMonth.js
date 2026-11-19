// freeMonth.js — l'échéance offerte au client qui a parrainé (dev 2026-11-19) : quels mois, et ce qu'on envoie.

import { normalizePaymentMode } from './constants.js';

export const FREE_MONTH_LABEL = 'Mois offert (parrainage)';

const MAX_CHOICES = 12;
const num = (v) => Number(v || 0);
const currentMonthKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }).slice(0, 7);

// Un mois offert n'a de sens que sur une échéance mensuelle : un annuel ou un trimestriel n'en a pas.
const notMonthly = (mode) => ['YEARLY', 'QUARTERLY'].includes(normalizePaymentMode(mode));

// Les échéances qu'on peut offrir : à partir du mois en cours, avec un attendu, rien encore reçu pour le mois.
export function freeMonthChoices(periods = [], { clientMode = null, nowKey = currentMonthKey() } = {}) {
  if (notMonthly(clientMode)) return [];
  return [...periods]
    .filter((p) => !notMonthly(p.payment_mode))
    .map((p) => ({ ...p, key: String(p.period || '').slice(0, 7) }))
    .filter((p) => p.key >= nowKey)
    .filter((p) => num(p.expected_owner) + num(p.expected_optilex_ttc) > 0)
    .filter((p) => num(p.received_owner) + num(p.received_optilex_ttc) === 0)
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(0, MAX_CHOICES)
    .map((p) => ({ key: p.key, owner: num(p.expected_owner), optilex: num(p.expected_optilex_ttc) }));
}

// Le corps envoyé : les deux attendus du mois à 0 €, sous le nom du geste.
export function freeMonthBody(month) {
  return {
    entries: [{ period: month, owner: 0, optilex: 0 }],
    reason: FREE_MONTH_LABEL,
    kind: 'discount',
    discount_label: FREE_MONTH_LABEL,
    discount_percent: 100,
  };
}
