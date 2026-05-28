// constants.js — single source of truth for the Tracking Finance page.
//
// All enum values mirror the backend Pydantic validators. Sending any value
// outside these lists triggers a 422 from `PATCH /api/v1/finance-periods/{id}`.
// Keep in sync with backend `app/schemas/client_finance.py`.

// ── Roles allowed on this page ───────────────────────────────────────────
export const ALLOWED_ROLES = ['admin', 'finance_director', 'finance_team'];

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

// ── Column labels (SACRED — finance team vocabulary, verbatim) ───────────
//
// CES LABELS SONT FIGÉS PAR LE DEV. Aucune reformulation autorisée.
// Toute modification = casse le workflow de l'équipe finance.
// Source : brief 3e passe Tracking Finance (2026-05-08).
export const COLUMN_LABELS = {
  numero:               'Numéro client',
  societe:              'Nom client + entreprise',
  etat:                 'État',
  statusDetail:         'État détail',
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
  overdueOwnerCum:      'Retard de paiement sur les mois précédents Owner',
  overdueOptilexCum:    'Retard de paiement sur les mois précédents Opti\'lex',
  receivedOverdueOwner: 'Montant récupéré sur les créances des mois précédents Owner',
  receivedOverdueOpti:  'Montant récupéré sur les créances des mois précédents Opti\'lex',
  pspOwner:             'Check Owner',
  pspOptilex:           'Check Opti\'lex',
  payDateOwner:         'Date paiement Owner',
  payDateOptilex:       'Date paiement Opti\'lex',
};

// ── Editable enums (backend Pydantic strict) ─────────────────────────────
export const PSP_OPTIONS = ['Learnypay', 'IFX', 'whop', 'Quonto'];

// État client (top-level enum, modifiable via dropdown col 3 du tableau).
// Mirror exact des valeurs backend (`clients.etat`).
export const ETAT_OPTIONS = [
  'a_signe',
  'en_attente',
  'resilie',
  'sans_suite',
  'liquidation',
  'pause',
  'self_resiliation',
  'retractation',
];

export const FINANCE_STATUS_DETAILS = [
  'Non traité',
  'Traité',
  'Relancer Owner',
  'Relancer Optilex',
  'A partiellement validé sur certaine structure',
  'En attente de retour',
  'À rembourser',
  'Relancé à voir si pas payé',
  'Promesse de règlement',
  'Attente retour cabinet',
  'Prélèvement en cours',
  'Pas de réponse',
  'Promesse de règlement partiel',
  'RDV lancement reprogrammé',
  'VIP',
  'Mandataire',
];

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

export const EMPLOYEE_RANGES = [
  '1-2',
  '3-5',
  '6-10',
  '11-20',
  '21-50',
  '51-100',
  '101-200',
  '201-300',
  '301-400',
  '+400',
];

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
  const idx = str.lastIndexOf(' - ');
  if (idx === -1) {
    return { societeName: str, representant: null };
  }
  return {
    societeName: str.slice(0, idx).trim() || str,
    representant: str.slice(idx + 3).trim() || null,
  };
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
