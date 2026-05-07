// constants.js — single source of truth for the Tracking Finance page.
//
// All enum values mirror the backend Pydantic validators. Sending any value
// outside these lists triggers a 422 from `PATCH /api/v1/finance-periods/{id}`.
// Keep in sync with backend `app/schemas/client_finance.py`.

// ── Roles allowed on this page ───────────────────────────────────────────
export const ALLOWED_ROLES = ['admin', 'finance_director', 'finance_team'];

// ── Editable enums (backend Pydantic strict) ─────────────────────────────
export const PSP_OPTIONS = ['Learnypay', 'IFX', 'whop', 'Quonto'];

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

export const formatDateFR = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
