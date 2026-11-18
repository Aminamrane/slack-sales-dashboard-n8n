// « Analyse financière » (demande de la direction du 26/10/2026) : logique pure de la page.
//
// Ce qui est demandé : le taux de résiliation du mois et depuis le début ; la LTV, c'est-à-dire la durée de vie moyenne
// d'un client chez Owner, qui avance chaque jour sauf pour ceux qui sont partis ; combien de temps un client reste après
// sa première année, et au bout de quand il résilie en moyenne ; puis les niches, SARL / SAS, les gains au total et par
// client.
//
// Tout part des lignes du board Owner/Opti'Lex et des mêmes définitions que le dashboard (`computeRetention`,
// `clientLifetimes`, `resiliationRateOfMonth`) : les chiffres concordent partout.
import { RESILIATION_ETATS, clientLifetimes, computeRetention, periodEndISO, resiliationRateOfMonth } from './ceoDashboardStats.js';
import { displayEtat, withDisplayEtat } from './boardClientState.js';

export const MONTH_DAYS = 30.4375;
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Une durée en jours, lue comme on la dit, jours compris (dev 18/11/2026 : « il faut aussi les jours ») :
// « 10 mois 5 jours », « 1 an 2 mois 5 jours », « 12 jours ». Mois moyen de 30,44 jours, comme le dashboard.
export function lifetimeLabel(days) {
  if (days == null) return '–';
  const total = Math.round(days);
  let months = Math.floor(total / MONTH_DAYS);
  let rest = Math.round(total - months * MONTH_DAYS);
  if (rest >= 30) { months += 1; rest = 0; }
  const years = Math.floor(months / 12);
  const month = months % 12;
  const parts = [years ? `${years} an${years > 1 ? 's' : ''}` : '', month ? `${month} mois` : '', rest ? `${rest} jour${rest > 1 ? 's' : ''}` : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : '0 jour';
}

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const dayNumber = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
const fold = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s-]+/g, ' ').trim();

// ── Les lignes ─────────────────────────────────────────────────────────────────────────────────────────────────────
// La route dédiée (`/ceo-dashboard/financial-analysis`) sert des lignes réduites, sans nom ni numéro ; on les remet
// dans la forme du board, celle que lisent les définitions du dashboard.
export function fromApi(clients) {
  return (Array.isArray(clients) ? clients : []).map((row) => withDisplayEtat({
    is_pending_contract: Boolean(row.pending),
    etat_date: row.etat_date ?? null,
    owner_signed_at: row.signed ?? null,
    secteur_activite: row.sector ?? null,
    legal_form: row.legal_form ?? null,
  }, row.etat));
}

// Ce que la page garde d'une ligne complète du board, quand la route dédiée n'est pas encore là.
export function fromBoard(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => withDisplayEtat({
    is_pending_contract: Boolean(row.is_pending_contract),
    etat_date: row.etat_date ?? null,
    owner_signed_at: row.owner_signed_at ?? null,
    secteur_activite: row.secteur_activite ?? null,
    legal_form: row.legal_form ?? null,
  }, displayEtat(row)));
}

// ── Le mois regardé ────────────────────────────────────────────────────────────────────────────────────────────────
export const monthLabel = (key) => `${MONTHS_FR[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
const shiftMonth = (key, by) => {
  const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

// La date d'arrêté d'un mois : son dernier jour, ou aujourd'hui pour le mois en cours.
export const asOfMonth = (key, today) => (key === today.slice(0, 7) ? today : periodEndISO(key));

// Les mois qu'on peut regarder : du mois de la première signature au mois en cours.
export function monthBounds(rows, today) {
  const first = rows.map((row) => String(row.owner_signed_at || '').slice(0, 7)).filter(Boolean).sort()[0] || today.slice(0, 7);
  return { first, last: today.slice(0, 7) };
}

// ── La durée de vie ────────────────────────────────────────────────────────────────────────────────────────────────

// La rétention mois par mois : parmi les clients signés depuis au moins N mois, la part encore là au bout de N mois.
// Seuls les clients assez anciens pour qu'on le sache comptent ; la courbe s'arrête quand il en reste trop peu.
export function retentionCurve(lives, asOf, { maxMonths = 36, minEligible = 30 } = {}) {
  const today = dayNumber(asOf);
  const points = [{ month: 0, eligible: lives.length, kept: lives.length, rate: lives.length ? 1 : null }];
  for (let month = 1; month <= maxMonths; month += 1) {
    const needed = Math.round(month * MONTH_DAYS);
    const eligible = lives.filter((life) => today - dayNumber(life.signed) >= needed);
    if (eligible.length < minEligible) break;
    const kept = eligible.filter((life) => life.days >= needed).length;
    points.push({ month, eligible: eligible.length, kept, rate: kept / eligible.length });
  }
  return points;
}

// Après la première année : ceux qui l'ont passée, combien sont encore là, et combien de temps ils sont restés au-delà
// (ce temps avance chaque jour pour ceux qui sont encore là).
export function afterFirstYear(lives) {
  const passed = lives.filter((life) => life.days >= 365);
  const gone = passed.filter((life) => !life.open);
  return {
    passed: passed.length,
    stillHere: passed.length - gone.length,
    gone: gone.length,
    extraDays: average(passed.map((life) => life.days - 365)),
  };
}

// « Au bout de quand il résilie en moyenne » : pour les clients partis par résiliation, le temps passé chez nous,
// en moyenne et en médiane, et la répartition par tranche.
const BUCKETS = [[0, 3, 'Moins de 3 mois'], [3, 6, '3 à 6 mois'], [6, 12, '6 mois à 1 an'], [12, 18, '1 an à 18 mois'], [18, 24, '18 mois à 2 ans'], [24, Infinity, 'Plus de 2 ans']];
export function departures(lives) {
  const left = lives.filter((life) => !life.open && RESILIATION_ETATS.includes(displayEtat(life.row)));
  const days = left.map((life) => life.days);
  return {
    count: left.length,
    averageDays: average(days),
    medianDays: median(days),
    afterOneYear: left.filter((life) => life.days >= 365).length,
    buckets: BUCKETS.map(([from, to, label]) => ({
      label,
      count: left.filter((life) => life.days >= from * MONTH_DAYS && life.days < to * MONTH_DAYS).length,
    })),
  };
}

// ── Les résiliations mois par mois ─────────────────────────────────────────────────────────────────────────────────
// Chaque mois de `firstKey` à `lastKey`, même définition que le dashboard ; le mois en cours est compté jusqu'à
// aujourd'hui. Un mois qui partait de moins de `minBase` clients en cours n'est pas comparable (un départ sur dix
// clients fait 10 %) : il est montré, mais marqué.
export function monthlyResiliations(established, firstKey, lastKey, today, { minBase = 30 } = {}) {
  const months = [];
  for (let key = firstKey; key <= lastKey; key = shiftMonth(key, 1)) {
    const month = resiliationRateOfMonth(established, key, asOfMonth(key, today));
    months.push({ ...month, label: monthLabel(key), comparable: month.base >= minBase });
  }
  return months;
}

// Le mois où l'on a le plus résilié : le taux le plus haut parmi les mois comparables (à taux égal, le plus de
// résiliations). `null` sans aucune résiliation.
export function worstMonth(months) {
  return months.filter((month) => month.comparable && month.count > 0)
    .reduce((worst, month) => (!worst || month.rate > worst.rate || (month.rate === worst.rate && month.count > worst.count) ? month : worst), null);
}

// ── De quoi le parc est fait ───────────────────────────────────────────────────────────────────────────────────────

// Le nom d'une niche à l'écran : l'écriture la plus fréquente, avec la seule correction connue (« Micro créche »).
const LABELS = { 'micro creche': 'Micro-crèche' };
export const sectorKey = (text) => fold(text);

// Les niches : les clients rangés par secteur d'activité. Pour chaque secteur : les clients encore là, les résiliés,
// la durée de vie moyenne. Au-delà de `limit`, les secteurs les moins représentés sont réunis en « Autres secteurs » ;
// un client sans secteur est compté à part.
export function sectorBreakdown(lives, limit = 12) {
  const groups = new Map();
  lives.forEach((life) => {
    const raw = String(life.row.secteur_activite || '').trim();
    const key = fold(raw);
    const group = groups.get(key) || { key, labels: new Map(), open: 0, resiliated: 0, days: [] };
    if (raw) group.labels.set(raw, (group.labels.get(raw) || 0) + 1);
    if (life.open) group.open += 1;
    else if (RESILIATION_ETATS.includes(displayEtat(life.row))) group.resiliated += 1;
    group.days.push(life.days);
    groups.set(key, group);
  });
  const total = lives.filter((life) => life.open).length;
  const row = (group, label) => ({ key: group.key, label, open: group.open, resiliated: group.resiliated, clients: group.days.length,
    share: total ? group.open / total : null, averageDays: average(group.days),
    resiliationRate: group.days.length ? group.resiliated / group.days.length : null });
  const nameOf = (group) => LABELS[group.key] || [...group.labels].sort((a, b) => b[1] - a[1]
    || Number(/^\p{Lu}/u.test(b[0])) - Number(/^\p{Lu}/u.test(a[0])) || a[0].localeCompare(b[0], 'fr'))[0][0];
  const named = [...groups.values()].filter((group) => group.key !== '')
    .map((group) => row(group, nameOf(group)))
    .sort((a, b) => b.open - a.open || b.clients - a.clients || a.label.localeCompare(b.label, 'fr'));
  const rest = named.slice(limit);
  const merged = rest.length ? [row({ key: 'others', open: rest.reduce((n, g) => n + g.open, 0), resiliated: rest.reduce((n, g) => n + g.resiliated, 0),
    days: rest.flatMap((g) => Array(g.clients).fill(g.averageDays)) }, `Autres secteurs (${rest.length})`)] : [];
  const unnamed = groups.get('');
  return {
    sectors: [...named.slice(0, limit), ...merged, ...(unnamed ? [row(unnamed, 'Secteur non renseigné')] : [])],
    named: named.length,
    unknown: unnamed ? unnamed.days.length : 0,
  };
}

// Les formes juridiques des clients en cours (« combien il y a de SARL, combien il y a de SAS ») : celles du NDA,
// quand le client en a rempli un.
const FORMS = ['SARL', 'SAS', 'SASU', 'EURL'];
export function legalForms(lives) {
  const here = lives.filter((life) => life.open);
  const counts = new Map();
  let known = 0;
  here.forEach((life) => {
    const form = String(life.row.legal_form || '').trim().toUpperCase();
    if (!form) return;
    known += 1;
    const key = FORMS.includes(form) ? form : 'Autres';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return {
    known,
    unknown: here.length - known,
    forms: [...FORMS, 'Autres'].map((label) => ({ label, count: counts.get(label) || 0, share: known ? (counts.get(label) || 0) / known : null }))
      .filter((item) => item.count > 0),
  };
}

// ── Tout ce que la page montre ─────────────────────────────────────────────────────────────────────────────────────
// À la date `asOf` (AAAA-MM-JJ) du mois `monthKey`. `sector` (clé, `sectorKey`) restreint tous les chiffres à cette
// niche ; la liste des niches, elle, se lit toujours sur tout le parc. `null` tant que les lignes ne sont pas là.
export function financialAnalysis(boardRows, asOf, sector = null, { today = asOf } = {}) {
  if (!Array.isArray(boardRows)) return null;
  const established = boardRows.filter((row) => !row.is_pending_contract);
  const breakdown = sectorBreakdown(clientLifetimes(established, asOf).lives);
  const scoped = sector == null ? established : established.filter((row) => fold(row.secteur_activite) === sector);
  const monthKey = asOf.slice(0, 7);
  const retention = computeRetention(scoped, asOf, monthKey);
  const { lives } = clientLifetimes(scoped, asOf);
  const totalDays = lives.reduce((sum, life) => sum + life.days, 0);
  return {
    asOf,
    monthKey,
    sector,
    ...retention,
    inCourse: retention.resiliationGlobal.base,
    measured: lives.length,
    gone: lives.filter((life) => !life.open).length,
    // Les rétractés n'entrent dans aucun calcul : ils n'ont jamais vraiment commencé.
    retracted: scoped.filter((row) => displayEtat(row) === 'Rétractation' && String(row.owner_signed_at || '').slice(0, 10) <= asOf).length,
    // La LTV, posée comme une division : la somme des durées de vie ÷ le nombre de clients mesurés.
    ltv: { totalDays, totalMonths: totalDays / MONTH_DAYS, clients: lives.length, averageDays: lives.length ? totalDays / lives.length : null },
    curve: retentionCurve(lives, asOf),
    afterFirstYear: afterFirstYear(lives),
    departures: departures(lives),
    months: monthlyResiliations(scoped, monthBounds(scoped, today).first, today.slice(0, 7), today),
    forms: legalForms(lives),
    ...breakdown,
  };
}
