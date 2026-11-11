// Lecture des Statistiques Finance (dev 10/11/2026) : libellés, couleurs et regroupements calculés à partir des
// réponses du serveur. Aucun chiffre n'est recalculé ici : le serveur compte, la page présente.
const NBSP = ' ';
export const eur = (value, digits = 0) => (value == null || Number.isNaN(Number(value)) ? '–'
  : `${Number(value).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${NBSP}€`);
export const count = (value) => (value == null ? '–' : Number(value).toLocaleString('fr-FR'));
export const pct = (rate, digits = 1) => (rate == null ? '–'
  : `${(Number(rate) * 100).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${NBSP}%`);
export const plural = (n, one, many = `${one}s`) => `${count(n)} ${Number(n) > 1 ? many : one}`;

const SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
// « 2026-11-05 » ou un horodatage ISO → « 05/11/2026 » et « 5 nov. ». Les dates du serveur sont déjà à l'heure de Paris.
export const dayFR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '–');
export const dayShort = (iso) => (iso ? `${Number(iso.slice(8, 10))} ${SHORT[Number(iso.slice(5, 7)) - 1]}` : '–');

export const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';

// ── Origines ────────────────────────────────────────────────────────────────────────────────────────
// Trois familles, comme dans le Suivi des ventes : la publicité (lead affecté ou repris au pool commun), le travail
// d'un setter (RDV posé, cold call, seconde chance), et les autres canaux.
export const ORIGIN_GROUPS = [
  { key: 'ads', label: 'Publicité', hint: 'Lead venu de la publicité, traité par le sales', sources: ['affectation', 'pool'], detail: 'Origine de la publicité' },
  { key: 'setters', label: 'Initiative d’un setter', hint: 'Le rendez-vous vient du travail d’un setter', sources: ['setter_rdv', 'second_chance', 'ccs'], detail: 'Setter à l’initiative' },
  { key: 'others', label: 'Autres canaux', hint: 'Parrainage, LinkedIn, webinaire, cold call du sales', sources: ['referral', 'linkedin', 'webinar', 'cold_call', 'other'], detail: null },
];
// Teinte de chaque origine : `color` pour les barres, `tone` pour l'étiquette pastel de la même famille.
const ORIGIN_TONE = {
  affectation: { color: '#8fbdf3', tone: 'blue' }, pool: { color: '#7fd3df', tone: 'cyan' },
  setter_rdv: { color: '#86d3a6', tone: 'green' }, second_chance: { color: '#aaa5ee', tone: 'lilac' }, ccs: { color: '#ecd36a', tone: 'yellow' },
  referral: { color: '#f4b183', tone: 'peach' }, linkedin: { color: '#f2a0a0', tone: 'red' }, webinar: { color: '#b9dc8a', tone: 'lime' },
  cold_call: { color: '#cfc8bd', tone: 'beige' }, other: { color: '#dedad3', tone: 'beige' },
};
export const originColor = (key) => (ORIGIN_TONE[key] || ORIGIN_TONE.other).color;
export const originTone = (key) => (ORIGIN_TONE[key] || ORIGIN_TONE.other).tone;

export function originGroups(byOrigin = []) {
  const total = byOrigin.reduce((sum, o) => sum + (o.sales || 0), 0);
  const share = (n) => (total ? n / total : 0);
  const known = new Map(byOrigin.map((o) => [o.key, o]));
  return ORIGIN_GROUPS.map((group) => {
    const items = group.sources.map((key) => known.get(key)).filter((o) => o && o.sales > 0)
      .map((o) => ({ ...o, color: originColor(o.key), share: share(o.sales) }))
      .sort((a, b) => b.sales - a.sales);
    const sales = items.reduce((sum, o) => sum + o.sales, 0);
    return { ...group, items, sales, share: share(sales), received_eur: items.reduce((sum, o) => sum + (o.received_eur || 0), 0) };
  }).filter((group) => group.sales > 0);
}

// Ce qui précise l'origine d'une vente : l'origine de la publicité, ou le setter à l'initiative.
export const originDetail = (line) => {
  const group = ORIGIN_GROUPS.find((g) => g.sources.includes(line.origin));
  if (group?.key === 'ads') return line.lead_origin || null;
  if (group?.key === 'setters') return line.setter || null;
  return null;
};

// ── Paiement d'une vente ────────────────────────────────────────────────────────────────────────────
export const PAYMENT = {
  paid: { label: 'A payé', tone: 'green' },
  unpaid: { label: 'Pas encore payé', tone: 'red' },
  upcoming: { label: 'Échéance à venir', tone: 'blue' },
  pending: { label: 'Date à fixer', tone: 'amber' },
  retracted: { label: 'Rétractée', tone: 'grey' },
  unlinked: { label: 'Fiche introuvable', tone: 'ghost' },
};
export const PAYMENT_ORDER = ['paid', 'unpaid', 'upcoming', 'pending', 'retracted', 'unlinked'];
export const paymentMeta = (status) => PAYMENT[status] || PAYMENT.unlinked;

export function paymentNote(payment = {}) {
  if (payment.status === 'paid') {
    return payment.first_paid_on ? `le ${dayShort(payment.first_paid_on)}`
      : payment.first_paid_month ? `en ${SHORT[Number(payment.first_paid_month.slice(5, 7)) - 1]}` : '';
  }
  if (payment.status === 'unpaid') return payment.due_on ? `attendu le ${dayShort(payment.due_on)}` : '';
  if (payment.status === 'upcoming') return payment.due_on ? `prévu le ${dayShort(payment.due_on)}` : '';
  if (payment.status === 'pending') return 'pas encore de date de prélèvement';
  if (payment.status === 'unlinked') return 'pas de fiche client reliée à la vente';
  return '';
}

const fold = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterSales(lines = [], { status = 'all', origin = null, group = null, person = null, query = '' } = {}) {
  const sources = group ? ORIGIN_GROUPS.find((g) => g.key === group)?.sources : null;
  const needle = fold(query.trim());
  return lines.filter((line) => (status === 'all' || line.payment?.status === status)
    && (!origin || line.origin === origin)
    && (!sources || sources.includes(line.origin))
    && (!person || line.sales_person === person)
    && (!needle || [line.client, line.sales_person, line.numero_client, line.lead_origin, line.setter, line.origin_label].some((v) => fold(v).includes(needle))));
}

export const statusCounts = (lines = []) => lines.reduce((acc, line) => {
  const key = line.payment?.status || 'unlinked';
  acc[key] = (acc[key] || 0) + 1;
  acc.all += 1;
  return acc;
}, { all: 0 });

export const sumBy = (lines, pick) => lines.reduce((sum, line) => sum + (Number(pick(line)) || 0), 0);

// ── Rendez-vous d'onboarding ────────────────────────────────────────────────────────────────────────
export const OUTCOME = {
  no_show: { label: 'No show', tone: 'red' },
  held: { label: 'Onboarding tenu', tone: 'green' },
  moved_before: { label: 'Déplacé avant le jour', tone: 'grey' },
  unknown: { label: 'Déplacé, moment inconnu', tone: 'grey' },
  upcoming: { label: 'À venir', tone: 'blue' },
  rescheduling: { label: 'À recaler', tone: 'amber' },
};
export const outcomeMeta = (step) => (step.outcome === 'no_show' && step.level === 'to_confirm'
  ? { label: 'À confirmer', tone: 'amber' } : OUTCOME[step.outcome] || OUTCOME.unknown);
export const LEVEL = { certain: 'Certain', probable: 'Probable', to_confirm: 'À confirmer' };
export const ONBOARDING_STATUS = {
  no_show: { label: 'No show', tone: 'red' },
  to_confirm: { label: 'À confirmer', tone: 'amber' },
  held: { label: 'Tenu', tone: 'green' },
  upcoming: { label: 'À venir', tone: 'blue' },
  rescheduling: { label: 'À recaler', tone: 'amber' },
  none: { label: 'Pas de date', tone: 'ghost' },
};

// Lignes d'un sales dans une carte de taux : ses cas d'abord, puis le reste.
export const byPerson = (rows = [], name) => rows.filter((row) => row.sales_person === name);

// Hauteur des barres d'un historique : la plus haute fait 100 %, une valeur absente 0.
export function barHeights(values = []) {
  const max = Math.max(0, ...values.map((v) => Number(v) || 0));
  return values.map((v) => (max > 0 && v ? Math.max(4, Math.round(((Number(v) || 0) / max) * 100)) : 0));
}
