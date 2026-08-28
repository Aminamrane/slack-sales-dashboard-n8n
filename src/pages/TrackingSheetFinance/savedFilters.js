// savedFilters.js — grammaire des filtres personnels de la page finance.
//
// Demande dev 2026-08-28 : que l'équipe compose ses propres filtres « comme
// dans Excel », les enregistre, et les retrouve sous « Mes filtres ».
//
// Un filtre = des conditions (champ, opérateur, valeur) reliées par ET ou OU.
// Le serveur ne fait que stocker le JSON : toute la sémantique vit ici, donc
// enrichir la grammaire ne demande aucun déploiement backend.

import {
  toNumber, parseDateFR, normalizeSearch,
  scopedPeriodAmounts, scopedOverdueCurrent, scopedOverdueCum,
  paymentModeLabel, autoDebitPastilles,
} from './constants.js';

// ── Champs proposés ────────────────────────────────────────────────────────
// `type` pilote les opérateurs offerts et la saisie de la valeur.
// `get(row, ctx)` lit la valeur dans la vision active — un filtre suit donc
// l'entité affichée, comme le reste de la page.
export const FILTER_FIELDS = [
  {
    key: 'expected', label: 'Attendu', type: 'number',
    get: (r, { scope }) => scopedPeriodAmounts(r, scope).expected,
  },
  {
    key: 'received', label: 'Récupéré', type: 'number',
    get: (r, { scope }) => scopedPeriodAmounts(r, scope).received,
  },
  {
    key: 'overdueCum', label: 'Retard antérieur', type: 'number',
    get: (r, { scope }) => scopedOverdueCum(r, scope),
  },
  {
    key: 'receivedOverdue', label: 'Récupéré antérieur', type: 'number',
    get: (r, { scope }) => scopedPeriodAmounts(r, scope).receivedOverdue,
  },
  {
    key: 'overdueToDate', label: 'Retard à date', type: 'number',
    get: (r, { scope }) => scopedOverdueCurrent(r, scope) + scopedOverdueCum(r, scope),
  },
  {
    key: 'etat', label: 'État', type: 'enum',
    get: (r, { etatOf }) => etatOf(r),
  },
  {
    key: 'modalite', label: 'Modalité de paiement', type: 'enum',
    get: (r) => paymentModeLabel(r.payment_mode) || paymentModeLabel(r.client?.payment_mode),
  },
  {
    key: 'autoDebit', label: 'Prélèvement automatisé', type: 'enum',
    get: (r) => r.auto_debit || null,
  },
  {
    key: 'psp', label: 'Check (PSP)', type: 'enum',
    get: (r, { scope }) => (scope === 'optilex' ? r.psp_optilex : r.psp_owner) || null,
  },
  {
    key: 'paymentPromise', label: 'Promesse de règlement', type: 'enum',
    get: (r) => (r.client?.payment_promise ? 'Oui' : 'Non'),
  },
  {
    key: 'societe', label: 'Nom / entreprise', type: 'text',
    get: (r) => r.client?.societe || '',
  },
  {
    key: 'numero', label: 'N° client', type: 'text',
    get: (r) => r.client?.numero_client || '',
  },
  {
    key: 'rdvOnboarding', label: "RDV d'onboarding", type: 'date',
    get: (r) => r.client?.rdv_onboarding || null,
  },
  {
    key: 'payDate', label: 'Date de paiement', type: 'date',
    get: (r, { scope }) => (scope === 'optilex' ? r.payment_date_optilex : r.payment_date_owner),
  },
];

export const FIELD_BY_KEY = FILTER_FIELDS.reduce((acc, f) => { acc[f.key] = f; return acc; }, {});

// ── Opérateurs, par type de champ ──────────────────────────────────────────
export const OPERATORS = {
  number: [
    { key: 'gt',    label: 'supérieur à',       arity: 1 },
    { key: 'gte',   label: 'supérieur ou égal', arity: 1 },
    { key: 'lt',    label: 'inférieur à',       arity: 1 },
    { key: 'lte',   label: 'inférieur ou égal', arity: 1 },
    { key: 'eq',    label: 'égal à',            arity: 1 },
    { key: 'neq',   label: 'différent de',      arity: 1 },
    { key: 'between', label: 'compris entre',   arity: 2 },
  ],
  text: [
    { key: 'contains', label: 'contient',        arity: 1 },
    { key: 'ncontains', label: 'ne contient pas', arity: 1 },
    { key: 'eq',       label: 'est exactement',  arity: 1 },
    { key: 'empty',    label: 'est vide',        arity: 0 },
    { key: 'nempty',   label: "n'est pas vide",  arity: 0 },
  ],
  enum: [
    { key: 'eq',    label: 'est',            arity: 1 },
    { key: 'neq',   label: "n'est pas",      arity: 1 },
    { key: 'empty', label: 'est vide',       arity: 0 },
    { key: 'nempty', label: "n'est pas vide", arity: 0 },
  ],
  date: [
    { key: 'before', label: 'avant le',        arity: 1 },
    { key: 'after',  label: 'après le',        arity: 1 },
    { key: 'empty',  label: 'est vide',        arity: 0 },
    { key: 'nempty', label: "n'est pas vide",  arity: 0 },
  ],
};

// ── Évaluation ─────────────────────────────────────────────────────────────

function testNumber(value, op, a, b) {
  const v = toNumber(value) || 0;
  const x = toNumber(a) || 0;
  switch (op) {
    case 'gt':  return v > x;
    case 'gte': return v >= x;
    case 'lt':  return v < x;
    case 'lte': return v <= x;
    case 'eq':  return v === x;
    case 'neq': return v !== x;
    case 'between': {
      const y = toNumber(b) || 0;
      const [min, max] = x <= y ? [x, y] : [y, x];
      return v >= min && v <= max;
    }
    default: return true;
  }
}

function testText(value, op, a) {
  const v = normalizeSearch(value || '');
  const x = normalizeSearch(a || '');
  switch (op) {
    case 'contains':  return v.includes(x);
    case 'ncontains': return !v.includes(x);
    case 'eq':        return v === x;
    case 'empty':     return v.trim() === '';
    case 'nempty':    return v.trim() !== '';
    default: return true;
  }
}

function testDate(value, op, a) {
  const d = parseDateFR(value);
  switch (op) {
    case 'empty':  return d === null;
    case 'nempty': return d !== null;
    default: break;
  }
  const ref = parseDateFR(a);
  if (!d || !ref) return false;
  return op === 'before' ? d < ref : d > ref;
}

function testCondition(row, cond, ctx) {
  const field = FIELD_BY_KEY[cond.field];
  if (!field) return true;              // champ inconnu : neutre, pas bloquant
  const value = field.get(row, ctx);
  switch (field.type) {
    case 'number': return testNumber(value, cond.op, cond.value, cond.value2);
    case 'date':   return testDate(value, cond.op, cond.value);
    case 'enum':
      if (cond.op === 'empty')  return !value;
      if (cond.op === 'nempty') return !!value;
      return cond.op === 'neq'
        ? String(value || '') !== String(cond.value || '')
        : String(value || '') === String(cond.value || '');
    default: return testText(value, cond.op, cond.value);
  }
}

// `definition` = { match: 'all' | 'any', conditions: [...] }.
// Une définition vide ne filtre rien : mieux vaut tout montrer qu'une page
// blanche inexplicable.
export const matchesSavedFilter = (row, definition, ctx) => {
  const conds = definition?.conditions || [];
  if (!conds.length) return true;
  return definition.match === 'any'
    ? conds.some((c) => testCondition(row, c, ctx))
    : conds.every((c) => testCondition(row, c, ctx));
};

// Résumé lisible d'un filtre, pour l'infobulle de « Mes filtres ».
export const describeFilter = (definition) => {
  const conds = definition?.conditions || [];
  if (!conds.length) return 'Aucune condition';
  const join = definition.match === 'any' ? ' ou ' : ' et ';
  return conds.map((c) => {
    const f = FIELD_BY_KEY[c.field];
    const ops = OPERATORS[f?.type || 'text'] || [];
    const op = ops.find((o) => o.key === c.op);
    const val = op?.arity === 0 ? ''
      : op?.arity === 2 ? ` ${c.value} et ${c.value2}`
        : ` ${c.value}`;
    return `${f?.label || c.field} ${op?.label || c.op}${val}`;
  }).join(join);
};
