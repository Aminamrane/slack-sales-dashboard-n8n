import { parisWallTime } from '../../utils/boardIntegration.js';

// constants.js — single source of truth for the Tracking Finance page.
//
// All enum values mirror the backend Pydantic validators. Sending any value
// outside these lists triggers a 422 from `PATCH /api/v1/finance-periods/{id}`.
// Keep in sync with backend `app/schemas/client_finance.py`.

// ── Roles allowed on this page ───────────────────────────────────────────
export const ALLOWED_ROLES = ['admin', 'finance_director', 'finance_team'];

// ── Qui peut écrire quoi (décision dev 2026-08-27) ───────────────────────
//
// L'équipe finance (Aurélie B, Lény Perron) consulte tout, filtre, télécharge
// les états de compte et commente — mais ne SAISIT PAS les encaissements.
// Elle peut en revanche entretenir la fiche : modalités, sociétés, associés,
// emails et téléphones.
//
// Ces listes ne font que refléter l'écran : le serveur refuse de son côté
// (`_FINANCE_TEAM_WRITABLE` dans client_finance.py). Une cellule grisée n'est
// pas une permission.
const AMOUNT_EDIT_ROLES = ['admin', 'finance_director'];

// Encaissements, dates de paiement, PSP, formule, état board.
export const canEditAmounts = (role) => AMOUNT_EDIT_ROLES.includes(role);

// Modalités, sociétés, associés, contacts.
export const canEditContract = (role) => ALLOWED_ROLES.includes(role);

// Équipe finance (Lény, Aurélie, Ingrid) : mêmes leviers que la direction
// dans « Gérer les attendus », mais chaque geste part en DEMANDE à valider
// par Ismahane (dev 2026-09-23). Le serveur fait la même distinction.
export const canProposeAmounts = (role) => role === 'finance_team';

// Filtre « Météo client » du menu Filtre : réservé à deux personnes, pas à
// un rôle (décision dev 2026-09-18) — Ismahane (direction financière) et
// Aurélie B (équipe finance). Même mécanique que l'onglet des appels.
const METEO_FILTER_USER_IDS = new Set([
  '94b5dcc1-a1bb-41ac-94fe-14cf047cffef', // Ismahane
  '6dfc7435-c938-4bd3-b143-a6516b2981bd', // Aurélie B
  '445a5b0d-61e3-4e3b-b1fc-77b04b66df12', // Youcef Amrane — le dev est toujours inclus (règle 2026-09-19)
]);
export const canFilterMeteo = (user) => METEO_FILTER_USER_IDS.has(user?.id);

// Vision « Global » (Owner + Opti'lex) : ouverte à tous ceux qui ont accès à
// la page. Demande dev 2026-09-23 : « il faut qu'on voie tous la même chose »,
// la vision n'est pas une question de droits (l'équipe finance était limitée
// à Owner, et lisait donc d'autres totaux que la direction). Porte purement
// front : la liste renvoie déjà les deux entités.
export const canUseGlobalScope = () => true;

// Clients « Attente Opti'Lex » du board : Owner signé, contrat Opti'Lex encore
// en vol, pas de numéro client ni d'attendu. La finance doit les voir, avec un
// flag et un filtre (demande dev 2026-09-18). La ligne est SYNTHÉTIQUE : elle
// vient du board (source de vérité de cet état), n'a aucun montant, n'est pas
// éditable et ne compte dans aucun total.
export const PENDING_OPTILEX_LABEL = "Attente Opti'Lex";
export const isPendingOptilexRow = (r) => r?.pending === true;
export const pendingFinanceRow = (br, period) => {
  const societe = (br.crm_societe || br.contact_name || '').trim();
  const contact = (br.contact_name || '').trim();
  return {
    id: `pending:${br.row_key || br.email || societe}`,
    pending: true,
    period,
    board: br,
    client: {
      id: null,
      numero_client: null,
      societe,
      company_name: null,
      representative_name: contact && contact !== societe ? contact : null,
      email: br.email || null,
      phone: br.contact_phone || null,
      etat: null,
      owner_signed_at: br.owner_signed_at || null,
      optilex_status: br.optilex_status || null,
      optilex_sent_at: br.optilex_sent_at || br.optilex_scheduled_at || null,
      identity_aliases: [],
      contact_emails: [],
      contact_phones: [],
    },
  };
};

// Vue « Onboarding » : la date d'onboarding Owner de la ligne, comparée à
// aujourd'hui. 'past' = déjà passée (le jour même compte comme passé),
// 'upcoming' = encore à venir. Sans date connue, la ligne n'est dans aucune
// des deux phases : on n'affirme rien qu'on ne sait pas.
// Comparaison sur le JOUR calendaire (heure-mur), jamais sur l'instant : une
// date ISO « 2026-09-18 » est minuit UTC, soit 02:00 à Paris — la lire comme
// un instant la ferait passer « à venir » le jour même.
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const onboardingPhaseOf = (r, today = new Date()) => {
  const raw = r?.client?.rdv_onboarding;
  const d = parseDateFR(raw);
  if (!d) return null;
  const key = /^\d{4}-\d{2}-\d{2}/.test(String(raw).trim()) ? String(raw).trim().slice(0, 10) : dayKey(d);
  return key > dayKey(today) ? 'upcoming' : 'past';
};

// Vue « Attente Opti'Lex » (dev 2026-09-23) : où en est le rendez-vous
// d'intégration Opti'Lex de la ligne du board ? Quatre états, parce qu'un RDV
// coché « effectué » sur le board et une date simplement passée ne sont pas la
// même chose (dev) :
//   'done'     : jalon « effectué » coché sur le board (fait foi, quelle que soit la date)
//   'past'     : date dépassée mais pas marquée effectuée
//   'upcoming' : date du jour ou à venir
//   'none'     : aucune date de RDV
// Dates comparées en jour calendaire Paris, comme le board (`parisWallTime`).
export const OPTILEX_INTEGRATION_PHASE_KEYS = ['done', 'past', 'upcoming', 'none'];
export const optilexIntegrationPhaseOf = (br, now = new Date()) => {
  if (!br) return 'none';
  if (br.rdv_lancement_done === true) return 'done';
  const raw = br.rdv_lancement_date;
  if (!raw) return 'none';
  return String(raw).slice(0, 10) < parisWallTime(now).slice(0, 10) ? 'past' : 'upcoming';
};

// ── Commentable cells ────────────────────────────────────────────────────
//
// Maps `colKey` (frontend column key from `COLS_FULL` in TableView.jsx) to
// `field_name` (backend value accepted by `/api/v1/finance-periods/{row_id}/comments`).
//
// Adding a new commentable cell : add the colKey here AND make sure the
// backend accepts the corresponding `field_name` enum value. Both sides
// must agree (the backend rejects unknown field_name with 422).
export const COMMENTABLE_FIELDS = {
  etat:              'etat',
  overdueCurrent:    'overdue_current',
  overdueOwnerCum:   'overdue_owner_cumulative',
  overdueOptilexCum: 'overdue_optilex_cumulative',
};

// Depuis la refonte "vision" (2026-08-18), les colonnes de retard cumulé sont
// scope-dépendantes : la colonne `overdueCum` pointe vers le champ Owner OU
// Opti'lex selon la vision active. En vision Globale la colonne est une somme
// → pas de fil de commentaires (le backend n'a pas de field_name "somme").
export const SCOPED_COMMENT_FIELDS = {
  owner:   { etat: 'etat', overdueCum: 'overdue_owner_cumulative' },
  optilex: { etat: 'etat', overdueCum: 'overdue_optilex_cumulative' },
  global:  { etat: 'etat' },
};

// ── Column labels (SACRED — finance team vocabulary, verbatim) ───────────
//
// CES LABELS SONT FIGÉS PAR LE DEV. Aucune reformulation autorisée.
// Toute modification = casse le workflow de l'équipe finance.
// Source : brief 3e passe Tracking Finance (2026-05-08).
export const COLUMN_LABELS = {
  numero:               'Numéro client',
  societe:              'Nom client + entreprise',
  etat:                 'État',
  rdvLancement:         'RDV lancement',
  rdvOnboarding:        'RDV onboarding',
  paymentMode:          'Mode de paiement (Annuel / Mensuel)',
  paymentSpec:          'Modalité de paiement',
  autoDebit:            'Prélèvement automatisé',
  expectedOwner:        'Montant Attendu Owner',
  expectedOptilex:      'Montant Attendu Opti\'lex',
  receivedOwner:        'Montant Récupéré Owner',
  receivedOptilex:      'Montant Récupéré Opti\'lex',
  overdueCurrent:       'Retard de paiement',
  overdueOwnerCum:      'Créances antérieures attendues au début du mois Owner',
  overdueOptilexCum:    'Créances antérieures attendues au début du mois Opti\'lex',
  receivedOverdueOwner: 'Montant récupéré sur les créances des mois précédents Owner',
  receivedOverdueOpti:  'Montant récupéré sur les créances des mois précédents Opti\'lex',
  pspOwner:             'Check Owner',
  pspOptilex:           'Check Opti\'lex',
  payDateOwner:         'Date paiement Owner',
  payDateOptilex:       'Date paiement Opti\'lex',
  // 2026-08-18 (phase 2 condensation) : colonne compacte fusionnant
  // Mode + Modalité + Prélèvement. Nouveau libellé validé par le brief
  // finance — les libellés historiques ci-dessus restent intacts.
  modalites:            'Modalités',
};

// Libellé scope-dépendant : reprend le libellé sacré et retire UNIQUEMENT le
// suffixe d'entité (« Montant Récupéré Owner » → « Montant Récupéré »).
// Aucune autre reformulation — l'entité active est portée par le sélecteur de
// vision + le header de groupe (brief phase 2, 2026-08-18).
export const stripEntitySuffix = (label) =>
  String(label || '').replace(/\s+(Owner|Opti'lex)$/i, '');

// ── Editable enums (backend Pydantic strict) ─────────────────────────────
export const PSP_OPTIONS = ['Learnypay', 'IFX', 'whop', 'Quonto'];

// 2026-08-18 : `ETAT_OPTIONS` (enum snake_case `clients.etat`) et
// `FINANCE_STATUS_DETAILS` (colonne « État détail ») supprimés. La colonne
// État du tableau affiche/pose désormais l'état du board Owner/Opti'Lex
// (cf. components/BoardEtatCell.jsx) — le PATCH `etat` sur finance-periods
// est mort côté backend, et « État détail » a été retirée du tableau.
// `ETAT_COLORS` / `STATUS_DETAIL_COLORS` plus bas restent : encore importés
// par ClientDetailModal.jsx (legacy conservé), EditableCell.jsx et les
// fallbacks lecture seule du DetailPanel.

export const PAYMENT_SPECIFICITIES = [
  'Paye / 2 sct',
  'Paye / 3 sct',
  'Paye / 4 sct',
  'Paye / 5 sct',
];

export const AUTO_DEBIT_OPTIONS = [
  'OUI',
  'NON',
  'Partiellement Owner',
  'Partiellement Optilex',
  'En attend',
  'Non souhaitais',
  'Partiellement Optilex Non souhaité Owner',
];

export const PAYMENT_MODES = ['MONTHLY', 'YEARLY'];

// Libellés FR du mode de paiement. QUARTERLY : exposé par le backend via
// `client.payment_mode` normalisé (fallback quand la period n'a rien).
export const PAYMENT_MODE_LABELS = {
  MONTHLY:   'Mensuel',
  YEARLY:    'Annuel',
  QUARTERLY: 'Trimestriel',
};

// Canonicalise un mode de paiement vers l'enum MONTHLY/YEARLY/QUARTERLY.
// Accepte l'enum backend ET les libellés FR du board (`periodicite` :
// « Mensuel » / « Annuel » / « Trimestriel », casse variable) — source du
// 4e fallback de la chaîne modalité (2026-08-21). Null si inconnu/absent.
const PAYMENT_MODE_CANON = {
  MONTHLY: 'MONTHLY', YEARLY: 'YEARLY', QUARTERLY: 'QUARTERLY',
  MENSUEL: 'MONTHLY', ANNUEL: 'YEARLY', TRIMESTRIEL: 'QUARTERLY',
};
export const normalizePaymentMode = (m) =>
  PAYMENT_MODE_CANON[String(m || '').trim().toUpperCase()] || null;

export const paymentModeLabel = (m) =>
  PAYMENT_MODE_LABELS[normalizePaymentMode(m)] || null;

// ── Modalités compactes (colonne fusionnée, phase 2 2026-08-18) ──────────

// « Paye / N sct » → N (chip « N× »). Null si le format ne matche pas.
export const parsePaymentSpecCount = (spec) => {
  const m = String(spec || '').match(/Paye\s*\/\s*(\d+)\s*sct/i);
  return m ? parseInt(m[1], 10) : null;
};

// Dérive l'état des deux pastilles prélèvement O (Owner) / X (Opti'lex)
// depuis l'enum `auto_debit`. States : 'green' | 'red' | 'wait' | 'none'.
// Match case-insensitive : la DB contient des variantes de casse ('Non').
// Source unique — utilisée par la cellule Modalités ET le filtre
// « Non automatisé » (index.jsx). Ne pas dupliquer cette table.
export const autoDebitPastilles = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return { owner: 'none', optilex: 'none' };
  }
  const canon = AUTO_DEBIT_OPTIONS.find(
    (o) => o.toUpperCase() === String(value).trim().toUpperCase()
  ) || null;
  switch (canon) {
    case 'OUI':                                      return { owner: 'green', optilex: 'green' };
    case 'NON':
    case 'Non souhaitais':                           return { owner: 'red',   optilex: 'red' };
    case 'Partiellement Owner':                      return { owner: 'green', optilex: 'red' };
    case 'Partiellement Optilex':
    case 'Partiellement Optilex Non souhaité Owner': return { owner: 'red',   optilex: 'green' };
    case 'En attend':                                return { owner: 'wait',  optilex: 'wait' };
    default:                                         return { owner: 'none',  optilex: 'none' };
  }
};

// ── Vision Owner / Opti'lex / Global (phase 2-3) ─────────────────────────
//
// Champs backend par entité — source UNIQUE du mapping vision → colonnes.
// Consommée par TableView (rendu + PATCH), index.jsx (filtres) et
// DetailPanel (KPIs / état de compte). Ne pas dupliquer cette table.
export const SCOPE_FIELDS = {
  owner: {
    expected:        'expected_owner',
    received:        'received_owner',
    overdueCum:      'overdue_owner_cumulative',
    receivedOverdue: 'received_overdue_owner',
    psp:             'psp_owner',
    payDate:         'payment_date_owner',
    dueDate:         'due_date_owner',
  },
  optilex: {
    expected:        'expected_optilex_ttc',
    received:        'received_optilex_ttc',
    overdueCum:      'overdue_optilex_cumulative',
    receivedOverdue: 'received_overdue_optilex_ttc',
    psp:             'psp_optilex',
    payDate:         'payment_date_optilex',
    dueDate:         'due_date_optilex',
  },
};

// Date à montrer dans « Date paie. » pour un mois : la date RÉELLE saisie si
// elle existe, sinon l'échéance calculée par le moteur (jour du dernier
// paiement reporté sur le mois). Plus jamais la projection du classeur, dont
// la formule « +30 jours » dérive d'un jour par mois et finit dans le mois
// précédent (règle dev 2026-09-23).
export const displayedPayDate = (row, fields) => {
  const actual = row?.[fields.payDate];
  if (actual && !row?.[`${fields.payDate}_projected`]) return { value: actual, projected: false };
  return { value: row?.[fields.dueDate] || null, projected: true };
};

// Each entity is allocated separately: credits never offset another client's
// arrears or the other entity. The fallback supports a rolling API deployment.
const entityPosition = (r, entity) => {
  const balance = r[`balance_${entity}`];
  if (balance) return Object.fromEntries(Object.entries(balance).map(([k, v]) => [k, toNumber(v) || 0]));
  const current = toNumber(r[`overdue_${entity}_current_month`]) || 0;
  const prior = toNumber(r[`overdue_${entity}_cumulative`]) || 0;
  const priorRemaining = Math.max(prior + Math.min(current, 0), 0);
  return {
    current_overdue: Math.max(current + Math.min(prior, 0), 0),
    prior_remaining: priorRemaining,
    opening_debt: Math.max(prior, 0),
    recovered_prior: Math.max(Math.max(prior, 0) - priorRemaining, 0),
    not_due: 0,
    credit: Math.max(-(current + prior), 0),
  };
};
const scopedPosition = (r, scope, key) =>
  (scope === 'optilex' ? 0 : entityPosition(r, 'owner')[key] || 0) +
  (scope === 'owner' ? 0 : entityPosition(r, 'optilex')[key] || 0);

export const scopedOverdueCurrent = (r, scope) => scopedPosition(r, scope, 'current_overdue');
export const scopedOverdueCum = (r, scope) => scopedPosition(r, scope, 'prior_remaining');
export const scopedOpeningDebt = (r, scope) => scopedPosition(r, scope, 'opening_debt');
export const entityCredit = (r, entity) => entityPosition(r, entity).credit;
export const scopedCredit = (r, scope) => scopedPosition(r, scope, 'credit');

// Ancienneté de la créance, en mois, dans la vision active.
//
// Le serveur donne le premier mois d'une dette JAMAIS soldée depuis
// (`overdue_*_since`) : un mois remis à zéro repart de zéro. On en déduit le
// nombre de mois écoulés. `null` = pas de dette datée (ou entité sans dette).
//
// En vision Globale, on retient la dette la PLUS ANCIENNE des deux entités :
// c'est celle qui commande la relance.
export const creanceAgeMonths = (r, scope, period = null) => {
  const dates = [];
  for (const entity of ['owner', 'optilex']) {
    if (scope !== 'global' && scope !== entity) continue;
    const position = entityPosition(r, entity);
    const since = r[`opening_${entity}_since`] || r[`overdue_${entity}_since`];
    if ((position.opening_debt > 0 || position.prior_remaining > 0) && since) dates.push(since);
  }
  if (!dates.length) return null;
  const [y, m] = String(dates.sort()[0]).slice(0, 7).split('-').map(Number);
  const now = new Date();
  const [cy, cm] = period ? period.slice(0, 7).split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  return (cy - y) * 12 + cm - m;
};

export const matchesPriorDebt = (r, scope, age = 'all', period = null) => {
  if (scopedOpeningDebt(r, scope) <= 0 && scopedOverdueCum(r, scope) <= 0) return false;
  if (age === 'all') return true;
  const months = creanceAgeMonths(r, scope, period);
  return months === null ? age === 'recent' : age === 'old' ? months >= 2 : months < 2;
};

// Totaux du bandeau, calculés sur les lignes RÉELLEMENT AFFICHÉES.
//
// Demande dev 2026-09-01 : « il faut que les totaux changent selon le filtre
// sélectionné, même un filtre qu'ils créent eux-mêmes. » L'appelant passe donc
// les lignes après filtrage ; ici on ne fait que sommer.
//
// Vit dans ce fichier, avec les autres règles, pour être testable et ne pas
// pouvoir diverger de ce que le tableau affiche.
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export const computeKpis = (visibleRows, scope, allCount = null) => {
  let expected = 0, received = 0, overdue = 0, overdueCum = 0;
  let openingDebt = 0, recoveredPrior = 0, notDue = 0, credit = 0;
  (visibleRows || []).forEach((r) => {
    const a = scopedPeriodAmounts(r, scope);
    expected += a.expected;
    received += a.received;
    overdue += scopedOverdueCurrent(r, scope);
    overdueCum += scopedOverdueCum(r, scope);
    openingDebt += scopedOpeningDebt(r, scope);
    recoveredPrior += scopedPosition(r, scope, 'recovered_prior');
    notDue += scopedPosition(r, scope, 'not_due');
    credit += scopedCredit(r, scope);
  });
  const total = (visibleRows || []).length;
  return {
    total, totalAll: allCount === null ? total : allCount,
    filtered: allCount !== null && allCount !== total,
    expectedGlobal: round2(expected), receivedTotal: round2(received),
    overdueTotal: round2(overdue), overdueTotalWithCum: round2(overdue + overdueCum),
    overdueCumTotal: round2(overdueCum), openingDebt: round2(openingDebt),
    recoveredPrior: round2(recoveredPrior), notDue: round2(notDue), credit: round2(credit),
    receivedPct: formatPercent(received, expected),
    overdueRecoveredPct: formatPercent(recoveredPrior, openingDebt),
  };
};

// « Retard à date » = retard du mois + anciennes créances restantes. Les crédits sont distincts.
// Une seule définition, pour que la tuile de la fiche, la colonne du tableau
// et les filtres ne puissent pas diverger (incident n°454, 2026-08-29).
export const scopedOverdueToDate = (r, scope) =>
  scopedOverdueCurrent(r, scope) + scopedOverdueCum(r, scope);

// Total encaissé par le client DEPUIS LE DÉBUT (échéances + arriérés),
// servi par le backend sur chaque ligne. Un total nul = aucune échéance
// jamais réglée, ce que la ligne mensuelle seule ne peut pas dire.
export const scopedReceivedTotal = (r, scope) =>
  (scope === 'optilex' ? 0 : (toNumber(r.received_total_owner) || 0)) +
  (scope === 'owner' ? 0 : (toNumber(r.received_total_optilex_ttc) || 0));

// « A payé au moins une fois dans sa vie de client » (règle dev 2026-09-18),
// QUELLE QUE SOIT la vision et l'entité. Le serveur le dit (`client.ever_paid`,
// qui connaît aussi le cash collecté par le classeur avant l'historique de la
// base, octobre 2025) ; à défaut, le total encaissé des deux entités.
export const hasEverPaid = (r) =>
  r?.client?.ever_paid === true || scopedReceivedTotal(r, 'global') > 0;

// Montants d'une period (row timeline) dans la vision active. `payDate` :
// par entité en vision entité ; en Globale, Owner en priorité (une somme de
// dates n'existe pas, on montre la première date connue).
export const scopedPeriodAmounts = (p, scope) => {
  if (scope === 'global') {
    return {
      expected:        (toNumber(p.expected_owner) || 0) + (toNumber(p.expected_optilex_ttc) || 0),
      received:        (toNumber(p.received_owner) || 0) + (toNumber(p.received_optilex_ttc) || 0),
      receivedOverdue: (toNumber(p.received_overdue_owner) || 0) + (toNumber(p.received_overdue_optilex_ttc) || 0),
      payDate:         p.payment_date_owner || p.payment_date_optilex || null,
    };
  }
  const f = SCOPE_FIELDS[scope];
  return {
    expected:        toNumber(p[f.expected]) || 0,
    received:        toNumber(p[f.received]) || 0,
    receivedOverdue: toNumber(p[f.receivedOverdue]) || 0,
    payDate:         p[f.payDate] || null,
  };
};

// ── Reports de créance (2026-09-07) ──────────────────────────────────────
//
// « Reporter ne change pas l'attendu, il change la créance. » Un report vit
// dans `client_finance_adjustment` (kind 'defer') : −X daté du mois QUI SUIT
// le mois déchargé, +X daté du mois de destination. Pour l'affichage, on
// ramène chaque mouvement au mois qu'il concerne : le −X au mois déchargé
// (période − 1), le +X au mois qui reçoit.
//
// Renvoie { 'YYYY-MM': { out, in } } dans la vision demandée (owner, optilex
// ou global).
export const deferralsByMonth = (deferrals, scope) => {
  const out = {};
  for (const d of deferrals || []) {
    if (scope !== 'global' && d.entity !== scope) continue;
    const amount = toNumber(d.amount) || 0;
    if (!amount) continue;
    const key = String(d.period).slice(0, 7);
    const month = amount < 0 ? shiftMonth(key, -1) : key;
    const cell = out[month] || (out[month] = { out: 0, in: 0 });
    if (amount < 0) cell.out += -amount; else cell.in += amount;
  }
  return out;
};

// Corrections du reste dû (kind 'outstanding', dev 2026-09-23) : un ajustement
// de créance daté du mois SUIVANT le mois corrigé, quel que soit son signe.
// Renvoie { 'YYYY-MM': delta } ramené au mois corrigé, dans la vision demandée.
export const outstandingByMonth = (corrections, scope) => {
  const out = {};
  for (const c of corrections || []) {
    if (scope !== 'global' && c.entity !== scope) continue;
    const amount = toNumber(c.amount) || 0;
    if (!amount) continue;
    const month = shiftMonth(String(c.period).slice(0, 7), -1);
    out[month] = (out[month] || 0) + amount;
  }
  return out;
};

// ── Recherche client (2026-08-21) ────────────────────────────────────────

// Normalisation insensible casse/accents (NFD + strip diacritiques).
export const normalizeSearch = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

// Un numéro de téléphone se cherche par ses chiffres : « 06 12 » trouve
// « 0612345678 » comme « +33 6 12 ». Vide si la saisie n'est pas numérique.
export const searchDigits = (s) => {
  const raw = String(s || '').trim();
  return /^[\d\s.+()-]+$/.test(raw) ? raw.replace(/\D/g, '') : '';
};

// Formes comparables d'un numéro : chiffres bruts, et forme nationale quand
// il est écrit en international (+33 7 98… ↔ 07 98…). Les deux sont gardées
// pour qu'une saisie dans l'un ou l'autre format retrouve le numéro.
export const phoneForms = (s) => {
  const d = String(s || '').replace(/\D/g, '');
  if (!d) return [];
  const forms = [d];
  if (d.startsWith('0033')) forms.push(`0${d.slice(4)}`);
  else if (d.startsWith('33') && d.length === 11) forms.push(`0${d.slice(2)}`);
  return forms;
};

// Prédicat de recherche d'une row finance-period — source UNIQUE partagée
// entre le filtre de TableView et le compteur de résultats d'index.jsx.
// Champs : numéro client, société (contient aussi le représentant),
// representative_name, alias d'identité (nom CRM, sociétés et associés
// rattachés), email principal et contacts secondaires de la fiche
// (contact_emails / contact_phones, tables partagées avec le board).
export const matchesClientSearch = (r, normalizedQuery) => {
  if (!normalizedQuery) return true;
  const c = r.client || {};
  const texts = [c.numero_client, c.societe, c.company_name, c.representative_name, c.email,
    ...(c.identity_aliases || []), ...(c.contact_emails || [])];
  if (texts.some((v) => v && normalizeSearch(v).includes(normalizedQuery))) return true;
  const wanted = phoneForms(searchDigits(normalizedQuery));
  if (!wanted.length || wanted[0].length < 4) return false;
  return [c.phone, ...(c.contact_phones || [])]
    .some((v) => phoneForms(v).some((form) => wanted.some((w) => form.includes(w))));
};

// ── Vues-filtres (chips, phase 2 2026-08-18) ─────────────────────────────

// États board de la vue « Résiliés / Rétractés ».
// Comparés à `displayEtat(boardRow)` (OptilexBoard.jsx — source de vérité).
//
// Uniquement les états ACTÉS. Un « En cours de résiliation » n'est pas un
// client résilié : la procédure est ouverte, il reste facturé, et la finance
// doit continuer à le suivre. Les compter ici faisait annoncer 132 clients
// sortis là où le board en montre 99 (correction 2026-08-25).
export const TERMINATED_BOARD_ETATS = new Set([
  'Résiliation',
  'Self-Résiliation',
  'Rétractation',
]);

// États qu'on ACTE depuis la finance, et qui engagent une sortie client. Les
// choisir ouvre le dialogue de sortie (date d'effet, sort des créances) au
// lieu de poser l'état à la volée — demande dev 2026-09-03 : « quand elle acte
// une résiliation, ça doit ouvrir le pop-up sortie client ».
export const ACTED_EXIT_ETATS = new Set([
  'Résiliation',
  'Rétractation',
  'Self-Résiliation',
  'Liquidation',
]);

// États de FIN DE RELATION, actés ou en cours : la relation s'arrête (ou va
// s'arrêter) et la finance doit trancher ce qu'il advient des créances —
// récupérées, ou passées en perte. Les « en cours de » comptent : la
// procédure est ouverte, la question se pose déjà.
export const EXIT_ETATS = new Set([
  'Liquidation',
  'En cours de liquidation',
  'Résiliation',
  'En cours de résiliation',
  'Rétractation',
  'En cours de rétractation',
  'Self-Résiliation',
]);

// Masquage facultatif dans « Créances antérieures » (demande du 15/09/2026).
// Utilise l'état affiché du board, y compris une liquidation en cours.
export const isLiquidationEtat = (boardEtat) =>
  boardEtat === 'Liquidation' || boardEtat === 'En cours de liquidation';

// Un client « à sortir » : dans un état de fin de relation, avec des créances
// antérieures encore dues dans la vision active, et sans perte actée.
// L'alerte de sa fiche reste valable même si la finance choisit de masquer
// les liquidations dans la vue de suivi : le masquage ne solde aucune dette.
export const isExitCandidate = (r, boardEtat, scope) =>
  !!boardEtat && EXIT_ETATS.has(boardEtat)
  && !r?.client?.is_loss
  && scopedOverdueCum(r, scope) > 0;

// Tranches de la GRILLE TARIFAIRE (table `tarifs` du backend), et rien
// d'autre : c'est sur elles que le prix est calculé. La liste précédente
// (11-20, 21-50, 51-100, 101-200, 201-300, 301-400, +400) datait d'avant la
// grille actuelle — elle n'affichait aucun libellé au-delà de 6-10 et, plus
// grave, proposait à l'édition des tranches sans tarif : les choisir mettait
// l'attendu du client à zéro (corrigé 2026-08-26).
export const EMPLOYEE_RANGES = [
  '1-2',
  '3-5',
  '6-10',
  '11-19',
  '20-29',
  '30-39',
  '40-49',
  '50-74',
  '75-99',
  '100-149',
  '150-199',
  '200-249',
  '250-299',
  '300-349',
  '350-400',
];

// Les valeurs en base sont sales : « 6_-_10 », « 3-5salariés », « 11 - 19 »
// cohabitent avec la forme canonique. On nettoie le bruit de saisie sans
// jamais réinterpréter la tranche elle-même (un « 3-4 » reste « 3-4 »).
export const normalizeEmployeeRange = (v) => {
  if (!v) return null;
  const cleaned = String(v)
    .replace(/salari[ée]s?/gi, '')
    .replace(/[\s_]+/g, '')
    .trim();
  return cleaned || null;
};

// Libellé affiché : la tranche suivie de « salariés ». Vaut pour toutes les
// valeurs, y compris celles hors grille, sinon la fiche affichait « 11-19 »
// nu à côté d'un « 3-5 salariés » (retour dev 2026-08-26).
export const employeeRangeLabel = (v) => {
  const r = normalizeEmployeeRange(v);
  return r ? `${r} salariés` : null;
};


// ── Contacts typés (fiche client) ────────────────────────────────────────
//
// Miroir exact de CONTACT_LABELS côté backend (finance_client_profile.py).
// `value` est ce qui part au POST/PATCH ; `label` est l'affichage FR.
export const CONTACT_LABEL_OPTIONS = [
  { value: 'perso',       label: 'Perso' },
  { value: 'pro',         label: 'Pro' },
  { value: 'associe',     label: 'Associé' },
  { value: 'comptable',   label: 'Comptable' },
  { value: 'facturation', label: 'Facturation' },
];

// Libellés FR du journal de la fiche client (finance_sheet_change).
export const PROFILE_CHANGE_LABELS = {
  employee_range: 'Effectif',
  siren:          'SIREN',
  contact_email:  'Email',
  contact_phone:  'Téléphone',
  etat:           'État',
  nom:            'Nom client',
  sales:          'Sales',
  modalite:       'Modalité',
  prelevement_automatise: 'Prélèvement automatisé',
  date_signature: 'Date de signature',
  payment_promise: 'Promesse de règlement',
  loss:           'Perte client',
  societe_couverte: 'Société couverte',
  associe: 'Associé',
  rdv_onboarding: "RDV d'onboarding",
  responsible: 'Responsable',
};

// ── Visual hints for cells ───────────────────────────────────────────────

// Color palette for finance_status_detail pills. Maps to text + bg colors.
// Falls back to neutral grey if the detail is unknown.
export const STATUS_DETAIL_COLORS = {
  'Traité':                                          { fg: '#065f46', bg: '#d1fae5' },
  'Non traité':                                      { fg: '#6b7280', bg: '#f3f4f6' },
  'Relancer Owner':                                  { fg: '#92400e', bg: '#fef3c7' },
  'Relancer Optilex':                                { fg: '#92400e', bg: '#fef3c7' },
  'A partiellement validé sur certaine structure':   { fg: '#3730a3', bg: '#e0e7ff' },
  'En attente de retour':                            { fg: '#3730a3', bg: '#e0e7ff' },
  'À rembourser':                                    { fg: '#991b1b', bg: '#fee2e2' },
  'Relancé à voir si pas payé':                      { fg: '#92400e', bg: '#fef3c7' },
  'Promesse de règlement':                           { fg: '#1e40af', bg: '#dbeafe' },
  'Attente retour cabinet':                          { fg: '#3730a3', bg: '#e0e7ff' },
  'Prélèvement en cours':                            { fg: '#0e7490', bg: '#cffafe' },
  'Pas de réponse':                                  { fg: '#991b1b', bg: '#fee2e2' },
  'Promesse de règlement partiel':                   { fg: '#1e40af', bg: '#dbeafe' },
  'RDV lancement reprogrammé':                       { fg: '#3730a3', bg: '#e0e7ff' },
  'VIP':                                             { fg: '#7c2d12', bg: '#fed7aa' },
  'Mandataire':                                      { fg: '#581c87', bg: '#f3e8ff' },
};

export const STATUS_DETAIL_FALLBACK = { fg: '#6b7280', bg: '#f3f4f6' };

// Etat client (top-level pill)
export const ETAT_COLORS = {
  a_signe:           { fg: '#065f46', bg: '#d1fae5', label: 'À signer' },
  en_attente:        { fg: '#92400e', bg: '#fef3c7', label: 'En attente' },
  resilie:           { fg: '#991b1b', bg: '#fee2e2', label: 'Résilié' },
  sans_suite:        { fg: '#6b7280', bg: '#f3f4f6', label: 'Sans suite' },
  liquidation:       { fg: '#991b1b', bg: '#fee2e2', label: 'Liquidation' },
  pause:             { fg: '#3730a3', bg: '#e0e7ff', label: 'Pause' },
  self_resiliation:  { fg: '#991b1b', bg: '#fee2e2', label: 'Self résil.' },
  retractation:      { fg: '#7c2d12', bg: '#fed7aa', label: 'Rétractation' },
};

export const ETAT_FALLBACK = { fg: '#6b7280', bg: '#f3f4f6', label: '—' };

// PSP pills (Notion solid green family — "validation" semantic).
export const PSP_COLORS = {
  Learnypay: { fg: '#0f7b6c', bg: '#cfe9e3' },
  IFX:       { fg: '#0f7b6c', bg: '#cfe9e3' },
  whop:      { fg: '#0f7b6c', bg: '#cfe9e3' },
  Quonto:    { fg: '#0f7b6c', bg: '#cfe9e3' },
};
export const PSP_FALLBACK = { fg: '#6b7280', bg: '#f3f4f6' };

// Auto-debit pills (semantic colors per case).
export const AUTO_DEBIT_COLORS = {
  'OUI':                                       { fg: '#065f46', bg: '#d1fae5' },
  'NON':                                       { fg: '#991b1b', bg: '#fee2e2' },
  'Partiellement Owner':                       { fg: '#3730a3', bg: '#e0e7ff' },
  'Partiellement Optilex':                     { fg: '#3730a3', bg: '#e0e7ff' },
  'En attend':                                 { fg: '#92400e', bg: '#fef3c7' },
  'Non souhaitais':                            { fg: '#6b7280', bg: '#f3f4f6' },
  'Partiellement Optilex Non souhaité Owner':  { fg: '#7c2d12', bg: '#fed7aa' },
};
export const AUTO_DEBIT_FALLBACK = { fg: '#6b7280', bg: '#f3f4f6' };

// Payment specificity pills (Notion blue family).
export const PAYMENT_SPECIFICITY_COLORS = {
  'Paye / 2 sct': { fg: '#1e40af', bg: '#dbeafe' },
  'Paye / 3 sct': { fg: '#1e40af', bg: '#dbeafe' },
  'Paye / 4 sct': { fg: '#1e40af', bg: '#dbeafe' },
  'Paye / 5 sct': { fg: '#1e40af', bg: '#dbeafe' },
};
export const PAYMENT_SPECIFICITY_FALLBACK = { fg: '#6b7280', bg: '#f3f4f6' };

// Lookup label par valeur enum (pour les dropdowns et display).
export const etatLabel = (etat) => (ETAT_COLORS[etat]?.label) || etat || '—';

// ── Numeric helpers ──────────────────────────────────────────────────────

// Backend stores Decimal as string (preserves precision). Frontend parses
// to number for display and arithmetic, then re-serializes as string in
// PATCH bodies. NULL stays NULL.
export const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export const formatEUR = (v, { withSymbol = true } = {}) => {
  const n = toNumber(v);
  if (n === null) return '—';
  const formatted = n.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `${formatted} €` : formatted;
};

/**
 * Ratio → « 57,38 % ». Retourne null si le dénominateur est nul/absent :
 * l'appelant n'affiche alors RIEN (pas de « 0 % » ni de NaN trompeur).
 * Utilisé par les KPI du bandeau (taux de récupération, taux de
 * récupération sur créances antérieures) — vocabulaire du classeur finance.
 */
export const formatPercent = (numerator, denominator) => {
  const d = toNumber(denominator);
  const n = toNumber(numerator);
  if (!d || d === 0) return null;
  const pct = ((n || 0) / d) * 100;
  if (!Number.isFinite(pct)) return null;
  return `${pct.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;
};

/**
 * Parse une date dans un des formats émis par le backend / la DB :
 *   - ISO 8601 : "2026-05-18", "2026-05-18T07:00:00.000Z", "2026-05-18T07:00:00+02:00"
 *   - Français : "18/05/2026", "18/05/26" (year < 100 → +2000)
 * Retourne un objet Date ou null si parse impossible.
 *
 * Pourquoi ce helper : `new Date("18/05/2026")` est interprété en US
 * (MM/DD/YYYY → 5 août 2026 sur Chrome, Invalid Date sur Safari récent),
 * et provoque des bugs en cascade dans la page Tracking Finance.
 * Source de vérité unique — utilisé par formatDateFR, getOverdueStatus,
 * filtres "RDV à venir", etc.
 */
export const parseDateFR = (s) => {
  if (!s) return null;
  const str = String(s).trim();
  // ISO : contient un T ou commence par YYYY-MM-DD
  if (str.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Français DD/MM/YYYY ou DD/MM/YY (suffixe libre tolérant : "18/05/2026 14:30")
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const d = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

export const formatDateFR = (iso) => {
  const d = parseDateFR(iso);
  if (!d) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Pattern observé sur 89% des clients (539/604) : `clients.societe` contient
 * "Nom Société - Prénom Nom du dirigeant" (parfois avec plusieurs tirets si le
 * nom de société contient lui-même un " - "). Convention : la part après le
 * DERNIER " - " est le représentant, le reste est le nom de société.
 *
 * Exemples :
 *   "LA FONTAINE SANCERROISE - Julien Niez"
 *      → { societeName: "LA FONTAINE SANCERROISE", representant: "Julien Niez" }
 *   "SASU CVR SERVICES - CVR SERVICES - PINON Mathieu"
 *      → { societeName: "SASU CVR SERVICES - CVR SERVICES", representant: "PINON Mathieu" }
 *   "2CL DENTAIRE"
 *      → { societeName: "2CL DENTAIRE", representant: null }
 *
 * Hors-bande : `representative_name` exposé par le backend reste toujours
 * `null` (pas de jointure fiable `clients` ↔ `client_data`). Ce helper est
 * donc la source pratique pour le représentant sur Tracking Finance.
 */
export const splitSocieteRep = (societe) => {
  if (!societe) return { societeName: null, representant: null };
  const str = String(societe).trim();

  // Normalise le représentant : multi-personnes séparées par « / » avec
  // espacement irrégulier en base (« Gaetan CEROUTER /Patrice FERRET ») →
  // « A / B » homogène. 41 cas en base (2026-08-21).
  const cleanRep = (s) => {
    const r = s.trim().replace(/\s*\/\s*/g, ' / ');
    return r || null;
  };

  // 1. Séparateur canonique « - » entouré d'espaces (539/722 cas). Le
  //    DERNIER l'emporte : les noms de société contenant eux-mêmes « - »
  //    ou « + » restent entiers (« SM Technologies + E.Solutions - X »).
  const idx = str.lastIndexOf(' - ');
  if (idx !== -1) {
    return {
      societeName: str.slice(0, idx).trim() || str,
      representant: cleanRep(str.slice(idx + 3)),
    };
  }

  // 2. Tiret collé d'UN côté (« …Ambulance- Hamou AMRANE », « X -Y ») :
  //    dernier tiret avec un espace d'au moins un côté. Les tirets collés
  //    des deux côtés (« Jean-Claude », « E-commerce ») ne matchent pas.
  const looseSep = /(\s-|-\s)/g;
  let m;
  let lastLoose = -1;
  let lastLen = 0;
  while ((m = looseSep.exec(str)) !== null) {
    lastLoose = m.index;
    lastLen = m[0].length;
  }
  if (lastLoose > 0) {
    const left = str.slice(0, lastLoose).trim();
    const right = cleanRep(str.slice(lastLoose + lastLen));
    if (left && right) return { societeName: left, representant: right };
  }

  // 3. Société seule (181 cas), aucune personne détectée.
  return { societeName: str, representant: null };
};

// ── Month nav helpers ────────────────────────────────────────────────────

const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// 'YYYY-MM' helpers
export const formatMonthLabel = (period) => {
  if (!period) return '—';
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return `${MONTH_LABELS[m - 1]} ${y}`;
};

export const shiftMonth = (period, delta) => {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
};

export const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// 'YYYY-MM-DD' (returned by backend) → 'YYYY-MM' for the period selector
export const periodFromDate = (dateStr) => {
  if (!dateStr) return null;
  return String(dateStr).slice(0, 7);
};

// ── Friendly labels for audit field names ────────────────────────────────
export const AUDIT_FIELD_LABELS = {
  expected_owner:                'Attendu Owner',
  expected_optilex_ttc:          'Attendu Opti\'Lex',
  received_owner:                'Reçu Owner',
  received_optilex_ttc:          'Reçu Opti\'Lex TTC',
  received_overdue_owner:        'Reçu créance Owner',
  received_overdue_optilex_ttc:  'Reçu créance Opti\'Lex',
  payment_date_owner:            'Date paiement Owner',
  payment_date_optilex:          'Date paiement Opti\'Lex',
  psp_owner:                     'PSP Owner',
  psp_optilex:                   'PSP Opti\'Lex',
  finance_status_detail:         'Détail état finance',
  payment_specificity:           'Particularité',
  auto_debit:                    'Prélèv. auto',
  employee_range:                'Tranche salariés',
  payment_mode:                  'Mode paiement',
};

// Keep the historical representative even after correcting the company name.
export const splitClientIdentity = (client) => {
  const original = splitSocieteRep(client?.societe);
  return {
    societeName: client?.company_name || original.societeName,
    representant: client?.representative_name || original.representant,
  };
};

export const ndaPersonLabel = (person) => {
  const full = person.fullName || '';
  const extra = [['birthName', 'nom de naissance'], ['maritalName', 'nom marital']]
    .filter(([key]) => person[key] && !full.toLocaleLowerCase('fr').includes(person[key].toLocaleLowerCase('fr')))
    .map(([key, label]) => `${label} : ${person[key]}`);
  return [full, ...extra].filter(Boolean).join(' · ');
};

export const distinctCrmName = (profile) => {
  const key = (name) => normalizeSearch(name || '').split(/\s+/).sort().join(' ');
  return profile?.crm_name && !(profile?.representatives || []).some(p => key(p.fullName) === key(profile.crm_name))
    ? profile.crm_name : null;
};
