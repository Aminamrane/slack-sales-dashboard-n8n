import { parisWallTime } from '../../utils/boardIntegration.js';
import { READ_ONLY_DIRECTION_ROLES } from '../../utils/readOnlyRoles.js';

// constants.js — single source of truth for the Tracking Finance page.
//
// All enum values mirror the backend Pydantic validators. Sending any value
// outside these lists triggers a 422 from `PATCH /api/v1/finance-periods/{id}`.
// Keep in sync with backend `app/schemas/client_finance.py`.

// ── Roles allowed on this page ───────────────────────────────────────────
// Le CEO a les accès de la direction financière depuis le 2026-09-30 (dev :
// « tous les accès à Paul comme à Isma »).
// Rôles qui écrivent sur la page (inchangé).
const FINANCE_WRITE_ROLES = ['admin', 'ceo', 'finance_director', 'finance_team'];
// Accès à la page : ces rôles, plus les rôles en lecture seule de la direction
// (RH, 2026-11-06), qui consultent tout et n'écrivent rien.
export const ALLOWED_ROLES = [...FINANCE_WRITE_ROLES, ...READ_ONLY_DIRECTION_ROLES];

// Toute écriture de la page, au-delà des montants et de la fiche : commentaires,
// filtres enregistrés, pièces de l'historique, fil de l'espace commun, statut et
// recalage de l'onboarding. Faux pour les rôles en lecture seule.
export const canWriteFinance = (role) => FINANCE_WRITE_ROLES.includes(role);

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
const AMOUNT_EDIT_ROLES = ['admin', 'ceo', 'finance_director'];

// Encaissements, dates de paiement, PSP, formule, état board.
export const canEditAmounts = (role) => AMOUNT_EDIT_ROLES.includes(role);

// Modalités, sociétés, associés, contacts.
export const canEditContract = (role) => canWriteFinance(role);

// Équipe finance (Lény, Aurélie, Ingrid) : mêmes leviers que la direction
// dans « Gérer les attendus », mais chaque geste part en DEMANDE à valider
// par Ismahane (dev 2026-09-23). Le serveur fait la même distinction.
export const canProposeAmounts = (role) => role === 'finance_team';

// Filtre « Météo client » du menu Filtre : réservé à des personnes, pas à
// un rôle (décision dev 2026-09-18) — Ismahane (direction financière),
// Aurélie B (équipe finance) et Paul (CEO, mêmes accès qu'Ismahane depuis le
// 2026-09-30). Même mécanique que l'onglet des appels.
const METEO_FILTER_USER_IDS = new Set([
  '94b5dcc1-a1bb-41ac-94fe-14cf047cffef', // Ismahane
  '6b32dc17-528d-4e01-b955-2c49a5f44b6a', // Paul (CEO)
  '6dfc7435-c938-4bd3-b143-a6516b2981bd', // Aurélie B
  '445a5b0d-61e3-4e3b-b1fc-77b04b66df12', // Youcef Amrane — le dev est toujours inclus (règle 2026-09-19)
  '3402830c-035f-4617-ac0f-dc42fa00c8a6', // Ben Issa Amrane (admin) : mêmes accès que le dev (2026-10-15)
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
export const PSP_OPTIONS = ['Learnypay', 'IFX', 'whop', 'Quonto', 'Owner Pay'];

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

// Catégories exclusives, indépendantes de la vision des montants affichés.
// Réutiliser les pastilles pour inclure les variantes historiques Opti'Lex.
export const FINANCE_AUTOMATION_FILTERS = [
  { value: 'finance:auto_owner', label: 'Automatisés Owner', hint: 'Automatisés uniquement chez Owner' },
  { value: 'finance:auto_optilex', label: 'Automatisés OPTI’LEX', hint: 'Automatisés uniquement chez OPTI’LEX' },
  { value: 'finance:auto_both', label: 'Automatisés Owner OPTI’LEX', hint: 'Automatisés chez Owner et OPTI’LEX' },
];

export const financeAutomationFilter = (value) => {
  const { owner, optilex } = autoDebitPastilles(value);
  if (owner === 'green' && optilex === 'green') return 'finance:auto_both';
  if (owner === 'green' && optilex === 'red') return 'finance:auto_owner';
  if (owner === 'red' && optilex === 'green') return 'finance:auto_optilex';
  return null;
};

// Le suivi « Non automatisé » concerne uniquement les clients avec un attendu
// positif sur le mois et la vision affichés, même s'ils ont déjà réglé ce mois.
export const matchesNonAutomated = (row, scope) => {
  if (!(scopedPeriodAmounts(row, scope).expected > 0)) return false;
  const p = autoDebitPastilles(row.auto_debit);
  if (scope === 'owner') return p.owner === 'red';
  if (scope === 'optilex') return p.optilex === 'red';
  return p.owner === 'red' && p.optilex === 'red';
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

// ── Trop-perçus imputés (règle dev 2026-11-06, n°736) ───────────────────────
//
// « Tout le trop-perçu ne reste pas sur le mois en cours. Il va soit aller
// payer un retard, soit aller payer la prochaine mensualité. » Le mois payé
// garde son attendu, déjà réglé en partie ou en totalité. Le serveur fait le
// calcul ; ces helpers ne font que le lire, dans la vision active.
//
// Bloc `imputation_*` du serveur, calculé sur les saisies actuelles comme les
// montants reçus de la ligne. Sans lui (API d'avant le 06/11), le mois garde
// son reçu et son surplus se lit comme avant, sans destination.
const entityImputation = (r, entity) => {
  const imputation = r?.[`imputation_${entity}`];
  if (imputation) return imputation;
  const a = scopedPeriodAmounts(r, entity);
  return { paid_for_month: Math.min(a.received, a.expected), surplus_to_next: Math.max(a.received - a.expected, 0) };
};
const scopedImputation = (r, scope, key) =>
  (scope === 'optilex' ? 0 : toNumber(entityImputation(r, 'owner')[key]) || 0) +
  (scope === 'owner' ? 0 : toNumber(entityImputation(r, 'optilex')[key]) || 0);

// Ce que le mois a reçu pour lui-même : ses encaissements, plus les avances
// des mois précédents, moins son trop-perçu parti ailleurs. Chaque euro compte
// une fois, dans le mois qu'il paie.
export const scopedPaidForMonth = (r, scope) => scopedImputation(r, scope, 'paid_for_month');
// Part du mois payée d'avance par un trop-perçu antérieur.
export const scopedAdvance = (r, scope) => scopedImputation(r, scope, 'advance_applied');
// Trop-perçu du mois : ce qui solde un retard, ce qui part sur les mois suivants.
export const scopedSurplus = (r, scope) => ({
  toPrior: scopedImputation(r, scope, 'surplus_to_prior'),
  toNext: scopedImputation(r, scope, 'surplus_to_next'),
});

// Mois reliés par le serveur, par entité puis additionnés dans la vision :
// `from` = d'où vient l'avance qui paie ce mois, `to` = mois payés par son
// trop-perçu (`month` null : pas encore imputé, ou crédit sans mois d'origine).
export const advanceLinks = (r, scope, side) => {
  const byMonth = new Map();
  for (const entity of ['owner', 'optilex']) {
    if (scope !== 'global' && scope !== entity) continue;
    for (const link of entityImputation(r, entity)[side === 'from' ? 'advance_from' : 'surplus_to'] || []) {
      const amount = toNumber(link.amount) || 0;
      if (amount > 0) byMonth.set(link.period ?? null, (byMonth.get(link.period ?? null) || 0) + amount);
    }
  }
  return [...byMonth].map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => String(a.month ?? '9999').localeCompare(String(b.month ?? '9999')));
};

const deMonth = (label) => (/^[aeiouyàâéèêëîïôöùû]/.test(label) ? `d’${label}` : `de ${label}`);

// « avance d’octobre » : ce qui paie déjà le mois, et d'où ça vient.
export const advanceNote = (r, scope) => {
  const amount = scopedAdvance(r, scope);
  if (!(amount > 0)) return null;
  const links = advanceLinks(r, scope, 'from');
  const months = links.map((l) => l.month).filter(Boolean);
  // Un seul mois d'origine se nomme ; plusieurs sources (mois de plusieurs
  // années, crédit sans mois) se disent « antérieures », détail au survol.
  const text = !months.length ? 'payé d’avance'
    : months.length === 1 && links.length === 1 ? `avance ${deMonth(monthsLabel(months))}` : 'avances antérieures';
  const detail = links.map((l) => `${formatEUR(l.amount)} ${l.month ? `payés en ${formatMonthLabel(l.month).toLowerCase()}` : 'de crédit'}`);
  return { amount, text, title: `Déjà payé d’avance : ${detail.join(', ')}.` };
};

// « → novembre », « → retard, déc. » : où part le trop-perçu du mois.
export const surplusNote = (r, scope) => {
  const { toPrior, toNext } = scopedSurplus(r, scope);
  const amount = toPrior + toNext;
  if (!(amount > 0)) return null;
  const links = advanceLinks(r, scope, 'to');
  const months = links.map((l) => l.month).filter(Boolean);
  const parts = [];
  const detail = [];
  if (toPrior > 0) {
    parts.push('retard');
    detail.push(`${formatEUR(toPrior)} soldent le retard`);
  }
  // Abrégé : la ligne porte aussi la pastille du montant.
  if (months.length) parts.push(monthsLabel(months, { short: true }));
  for (const l of links) {
    detail.push(l.month ? `${formatEUR(l.amount)} paient ${formatMonthLabel(l.month).toLowerCase()}` : `${formatEUR(l.amount)} restent en crédit`);
  }
  if (links.some((l) => !l.month)) parts.push('crédit');
  if (toNext > 0 && !links.length) parts.push('mois suivant');
  return { amount, text: `→ ${parts.join(', ')}`, title: `Trop-perçu de ${formatEUR(amount)} : ${detail.join(', ') || 'mois suivant'}.` };
};

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
  let cash = 0, advances = 0;
  (visibleRows || []).forEach((r) => {
    const a = scopedPeriodAmounts(r, scope);
    expected += a.expected;
    // Reçu affecté au mois : un trop-perçu compte dans le mois qu'il paie,
    // pas deux fois (dev 2026-11-06). L'encaissé brut reste à part.
    received += scopedPaidForMonth(r, scope);
    cash += a.received;
    advances += scopedAdvance(r, scope);
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
    cashTotal: round2(cash), advanceTotal: round2(advances),
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

// Les deux bouts de chaque report (dev 2026-09-28 : « les reports s'affichent
// mal, ce n'est pas intuitif »). Les lignes d'un même report sont écrites dans
// la même transaction, donc avec le même horodatage : les −X (mois déchargés,
// ramenés à période − 1) et le +X (mois qui reçoit). Renvoie, par mois,
// `to` (où sa créance est partie) et `from` (d'où vient ce qu'il reçoit) :
// { 'YYYY-MM': { to: [{ month, amount }], from: [{ month, amount }] } }.
export const deferralLinks = (deferrals, scope) => {
  const groups = new Map();
  for (const d of deferrals || []) {
    if (scope !== 'global' && d.entity !== scope) continue;
    const amount = toNumber(d.amount) || 0;
    if (!amount) continue;
    const key = String(d.period).slice(0, 7);
    const group = groups.get(d.created_at) || { outs: [], ins: [] };
    if (amount < 0) group.outs.push({ month: shiftMonth(key, -1), amount: -amount });
    else group.ins.push({ month: key, amount });
    groups.set(d.created_at, group);
  }
  const links = {};
  const cell = (m) => links[m] || (links[m] = { to: [], from: [] });
  for (const { outs, ins } of groups.values()) {
    const target = ins[0]?.month || null;
    for (const o of outs) cell(o.month).to.push({ month: target, amount: o.amount });
    for (const i of ins) for (const o of outs) cell(i.month).from.push({ month: o.month, amount: o.amount });
  }
  return links;
};

// ── Reports d'attendu (dev 2026-09-28) ───────────────────────────────────
//
// « Le report déplace l'attendu, exactement, donc l'attendu arrive à zéro. »
// Un report (`reports` du profil) a déplacé `amount` de l'attendu de
// `from_month` sur celui de `to_month` : juillet reporté sur août = juillet 0,
// août = son attendu + celui de juillet. Renvoie, dans la vision demandée,
// { 'YYYY-MM': { to: [{ month, amount }], from: [{ month, amount }] } } :
// `to` = où l'attendu du mois est parti, `from` = d'où vient ce qu'il reçoit.
export const reportsByMonth = (reports, scope) => {
  const out = {};
  const cell = (m) => out[m] || (out[m] = { to: [], from: [] });
  for (const r of reports || []) {
    if (scope !== 'global' && r.entity !== scope) continue;
    const amount = toNumber(r.amount) || 0;
    if (!amount || !r.from_month || !r.to_month) continue;
    cell(r.from_month).to.push({ month: r.to_month, amount });
    cell(r.to_month).from.push({ month: r.from_month, amount });
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
  billing_company_owner: 'Société de facturation Owner',
  billing_company_optilex: 'Société de facturation Opti’Lex',
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
  // Rendez-vous retenu par la Finance (départ de facturation), distinct de celui du CSM.
  finance_onboarding_date: "RDV d'onboarding (facturation)",
  responsible: 'Responsable',
};

// ── Visual hints for cells ───────────────────────────────────────────────

// Color palette for finance_status_detail pills. Maps to text + bg colors.
// Falls back to neutral grey if the detail is unknown.
export const STATUS_DETAIL_COLORS = {
  'Traité':                                          { fg: '#0b7a4b', bg: '#e2f6ea' },
  'Non traité':                                      { fg: '#8b867e', bg: '#f4f2ee' },
  'Relancer Owner':                                  { fg: '#7a5a05', bg: '#fbf1c2' },
  'Relancer Optilex':                                { fg: '#7a5a05', bg: '#fbf1c2' },
  'A partiellement validé sur certaine structure':   { fg: '#4a3fc4', bg: '#eae9fb' },
  'En attente de retour':                            { fg: '#4a3fc4', bg: '#eae9fb' },
  'À rembourser':                                    { fg: '#c5221f', bg: '#fde6e6' },
  'Relancé à voir si pas payé':                      { fg: '#7a5a05', bg: '#fbf1c2' },
  'Promesse de règlement':                           { fg: '#1b6fd0', bg: '#e4f0fd' },
  'Attente retour cabinet':                          { fg: '#4a3fc4', bg: '#eae9fb' },
  'Prélèvement en cours':                            { fg: '#0f7286', bg: '#d9f3f7' },
  'Pas de réponse':                                  { fg: '#c5221f', bg: '#fde6e6' },
  'Promesse de règlement partiel':                   { fg: '#1b6fd0', bg: '#e4f0fd' },
  'RDV lancement reprogrammé':                       { fg: '#4a3fc4', bg: '#eae9fb' },
  'VIP':                                             { fg: '#c2500e', bg: '#fde9da' },
  'Mandataire':                                      { fg: '#6a45b8', bg: '#eee9fa' },
};

export const STATUS_DETAIL_FALLBACK = { fg: '#8b867e', bg: '#f4f2ee' };

// Etat client (top-level pill)
export const ETAT_COLORS = {
  a_signe:           { fg: '#0b7a4b', bg: '#e2f6ea', label: 'À signer' },
  en_attente:        { fg: '#7a5a05', bg: '#fbf1c2', label: 'En attente' },
  resilie:           { fg: '#c5221f', bg: '#fde6e6', label: 'Résilié' },
  sans_suite:        { fg: '#8b867e', bg: '#f4f2ee', label: 'Sans suite' },
  liquidation:       { fg: '#c5221f', bg: '#fde6e6', label: 'Liquidation' },
  pause:             { fg: '#4a3fc4', bg: '#eae9fb', label: 'Pause' },
  self_resiliation:  { fg: '#c5221f', bg: '#fde6e6', label: 'Self résil.' },
  retractation:      { fg: '#c2500e', bg: '#fde9da', label: 'Rétractation' },
};

export const ETAT_FALLBACK = { fg: '#8b867e', bg: '#f4f2ee', label: '—' };

// PSP pills (Notion solid green family — "validation" semantic).
export const PSP_COLORS = {
  Learnypay: { fg: '#0b7a4b', bg: '#e2f6ea' },
  IFX:       { fg: '#0b7a4b', bg: '#e2f6ea' },
  whop:      { fg: '#0b7a4b', bg: '#e2f6ea' },
  Quonto:    { fg: '#0b7a4b', bg: '#e2f6ea' },
  'Owner Pay': { fg: '#0b7a4b', bg: '#e2f6ea' },
};
export const PSP_FALLBACK = { fg: '#8b867e', bg: '#f4f2ee' };

// Auto-debit pills (semantic colors per case).
export const AUTO_DEBIT_COLORS = {
  'OUI':                                       { fg: '#0b7a4b', bg: '#e2f6ea' },
  'NON':                                       { fg: '#c5221f', bg: '#fde6e6' },
  'Partiellement Owner':                       { fg: '#4a3fc4', bg: '#eae9fb' },
  'Partiellement Optilex':                     { fg: '#4a3fc4', bg: '#eae9fb' },
  'En attend':                                 { fg: '#7a5a05', bg: '#fbf1c2' },
  'Non souhaitais':                            { fg: '#8b867e', bg: '#f4f2ee' },
  'Partiellement Optilex Non souhaité Owner':  { fg: '#c2500e', bg: '#fde9da' },
};
export const AUTO_DEBIT_FALLBACK = { fg: '#8b867e', bg: '#f4f2ee' };

// Payment specificity pills (Notion blue family).
export const PAYMENT_SPECIFICITY_COLORS = {
  'Paye / 2 sct': { fg: '#1b6fd0', bg: '#e4f0fd' },
  'Paye / 3 sct': { fg: '#1b6fd0', bg: '#e4f0fd' },
  'Paye / 4 sct': { fg: '#1b6fd0', bg: '#e4f0fd' },
  'Paye / 5 sct': { fg: '#1b6fd0', bg: '#e4f0fd' },
};
export const PAYMENT_SPECIFICITY_FALLBACK = { fg: '#8b867e', bg: '#f4f2ee' };

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

// Période d'une pause, restituée à côté du badge d'état de la fiche sans avoir
// à ouvrir le menu. `etat_date` = début, `pause_end_date` = fin connue ; sans
// fin connue elle est « non définie » (la date de relance, `pause_relance_date`,
// ne la remplace pas : elle ne figure que dans l'infobulle). Seule une pause
// posée à la main (`etat_manuel`) porte des dates : celle qui vient du Sheet
// n'en a aucune.
export const pauseRange = (row) => {
  const day = (v) => { const s = formatDateFR(v); return s === '—' ? null : s; };
  const manual = row?.etat_manuel === 'Pause';
  const start = manual ? day(row.etat_date) : null;
  const end = manual ? day(row.pause_end_date) : null;
  const relance = manual ? day(row.pause_relance_date) : null;
  const callback = relance ? `, à relancer le ${relance}` : '';
  if (start && end) return { text: `du ${start} au ${end}`, title: `Pause du ${start} au ${end}` };
  if (start) return { text: `du ${start} · fin non définie`, title: `Pause depuis le ${start}, fin non définie${callback}` };
  if (end) return { text: `jusqu'au ${end}`, title: `Pause jusqu'au ${end}, début non défini` };
  return { text: 'dates non définies', title: `Aucune date de pause renseignée${callback}` };
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

// « novembre », ou « nov., déc. » pour plusieurs mois : les mois reliés à un
// trop-perçu, sans l'année, pour tenir dans une cellule.
const MONTH_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const monthsLabel = (periods, { short = false } = {}) => {
  const months = (periods || []).map((p) => Number(String(p).slice(5, 7))).filter((m) => m >= 1 && m <= 12);
  if (months.length === 1 && !short) return MONTH_LABELS[months[0] - 1].toLowerCase();
  return months.map((m) => MONTH_SHORT[m - 1]).join(', ');
};

// « d’août 2026 », « de septembre 2026 » : le mois précédé de sa préposition.
export const deMonthLabel = (period) => {
  const label = formatMonthLabel(period).toLowerCase();
  return /^[aeiouyàâéèêëîïôöùû]/.test(label) ? `d’${label}` : `de ${label}`;
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

export function formatDateLongFR(iso) {
  const d = parseDateFR(iso);
  if (!d) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
