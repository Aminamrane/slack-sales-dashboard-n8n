// freeMonth.js — l'échéance offerte au client qui a parrainé (dev 2026-11-19) : quels mois, et ce qu'on envoie.

import { normalizePaymentMode } from './constants.js';

export const FREE_MONTH_LABEL = 'Mois offert (parrainage)';

const MAX_CHOICES = 12;
const num = (v) => Number(v || 0);
const currentMonthKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }).slice(0, 7);

// Un mois offert n'a de sens que sur une échéance mensuelle : un annuel ou un trimestriel n'en a pas.
const notMonthly = (mode) => ['YEARLY', 'QUARTERLY'].includes(normalizePaymentMode(mode));

// Les échéances qu'on peut offrir : à partir du mois en cours, avec un attendu Owner mensuel. Un mois déjà payé
// reste proposé : ce qu'il a reçu règle d'abord les dettes du client, puis reste en avance ou est remboursé
// (dev 2026-11-19). Un Opti'Lex annuel n'est jamais offert : son annuité reste due. Un mois qui a déjà une demande
// en attente n'est pas proposé une deuxième fois.
export function freeMonthChoices(periods = [], {
  clientMode = null, optilexMode = null, pendingMonths = [], nowKey = currentMonthKey(),
} = {}) {
  if (notMonthly(clientMode)) return [];
  const pending = new Set(pendingMonths);
  return [...periods]
    .filter((p) => !notMonthly(p.payment_mode))
    .map((p) => ({ ...p, key: String(p.period || '').slice(0, 7) }))
    .filter((p) => p.key >= nowKey && !pending.has(p.key))
    .filter((p) => num(p.expected_owner) > 0)
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(0, MAX_CHOICES)
    .map((p) => {
      const optilexMonthly = !notMonthly(p.payment_mode_optilex || optilexMode || p.payment_mode || clientMode);
      const optilex = optilexMonthly ? num(p.expected_optilex_ttc) : 0;
      const paid = num(p.received_owner) + (optilexMonthly ? num(p.received_optilex_ttc) : 0);
      return { key: p.key, owner: num(p.expected_owner), optilex, optilexMonthly, paid: Math.round(paid * 100) / 100 };
    });
}

// Le corps envoyé au geste « mois offert » : le mois, et ce que devient ce qui a déjà été payé.
export function freeMonthBody(month, settle = 'advance') {
  return { period: month, settle: settle === 'refund' ? 'refund' : 'advance' };
}

// Les mois offerts, d'après le journal des gestes : réduction « Mois offert (parrainage) » non annulée.
export function freeMonthsFromOps(ops = []) {
  const months = new Set();
  for (const op of ops || []) {
    if (op?.reverted_at || op?.kind !== 'discount' || !String(op?.label || '').includes(FREE_MONTH_LABEL)) continue;
    for (const p of op.periods || []) months.add(String(p).slice(0, 7));
  }
  return months;
}
