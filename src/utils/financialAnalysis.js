// « Analyse financière » (dev 17/11/2026, demande du 26/10 : la durée de vie d'un client, les taux de résiliation et de
// quoi le parc est fait, pour répondre au fonds). Logique pure : tout part des lignes du board Owner/Opti'Lex et des
// mêmes définitions que le dashboard (`computeRetention`, `clientLifetimes`), pour que les chiffres concordent partout.
import { RESILIATION_ETATS, clientLifetimes, computeRetention } from './ceoDashboardStats.js';
import { displayEtat } from './boardClientState.js';

const MONTH_DAYS = 30.4375;

// Une durée en jours, lue comme on la dit : « 1 an 10 mois », « 9 mois », « 12 jours ».
export function lifetimeLabel(days) {
  if (days == null) return '–';
  const months = Math.round(days / MONTH_DAYS);
  if (months < 1) return `${Math.round(days)} jour${Math.round(days) > 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? `${years} an${years > 1 ? 's' : ''}` : '', rest ? `${rest} mois` : ''].filter(Boolean).join(' ');
}

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const dayNumber = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);

// Rétention dans le temps : parmi les clients signés depuis au moins N mois, la part encore là au bout de N mois.
// Seuls les clients assez anciens pour qu'on le sache comptent : un client signé il y a 4 mois ne dit rien des 12 mois.
export function survival(lives, asOf, thresholds = [3, 6, 12, 18, 24, 36]) {
  const today = dayNumber(asOf);
  return thresholds.map((months) => {
    const needed = Math.round(months * MONTH_DAYS);
    const eligible = lives.filter((life) => today - dayNumber(life.signed) >= needed);
    const kept = eligible.filter((life) => life.days >= needed).length;
    return { months, eligible: eligible.length, kept, rate: eligible.length ? kept / eligible.length : null };
  }).filter((step) => step.eligible > 0);
}

// Après la première année (la question du fonds : « le client, il reste combien de temps après les 1 ans ») : ceux
// qui l'ont passée, combien sont encore là, et combien de temps ils sont restés au-delà. Cette durée avance chaque
// jour pour ceux qui sont encore là.
export function afterFirstYear(lives) {
  const passed = lives.filter((life) => life.days >= 365);
  const gone = passed.filter((life) => !life.open);
  return {
    passed: passed.length,
    stillHere: passed.length - gone.length,
    gone: gone.length,
    extraDays: average(passed.map((life) => life.days - 365)),
    goneExtraDays: average(gone.map((life) => life.days - 365)),
  };
}

const fold = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Les niches : les clients rangés par secteur d'activité (celui de la fiche du board). Pour chaque secteur : les
// clients encore là, les résiliés, et la durée de vie moyenne. Les secteurs les moins représentés sont réunis en
// « Autres secteurs » au-delà de `limit` ; un client sans secteur est compté à part.
export function sectorBreakdown(lives, limit = 12) {
  const groups = new Map();
  lives.forEach((life) => {
    const raw = String(life.row.secteur_activite || '').trim();
    const key = fold(raw) || '';
    const group = groups.get(key) || { key, labels: new Map(), open: 0, resiliated: 0, days: [] };
    if (raw) group.labels.set(raw, (group.labels.get(raw) || 0) + 1);
    if (life.open) group.open += 1;
    else if (RESILIATION_ETATS.includes(displayEtat(life.row))) group.resiliated += 1;
    group.days.push(life.days);
    groups.set(key, group);
  });
  const total = lives.filter((life) => life.open).length;
  const row = (group, label) => ({ key: group.key, label, open: group.open, resiliated: group.resiliated, clients: group.days.length,
    share: total ? group.open / total : null, averageDays: average(group.days) });
  // Le libellé d'un secteur : son écriture la plus fréquente.
  const named = [...groups.values()].filter((group) => group.key !== '')
    .map((group) => row(group, [...group.labels].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))[0][0]))
    .sort((a, b) => b.open - a.open || b.clients - a.clients || a.label.localeCompare(b.label, 'fr'));
  const merge = (list, key, label) => (list.length ? [row({ key, open: list.reduce((n, g) => n + g.open, 0), resiliated: list.reduce((n, g) => n + g.resiliated, 0),
    days: list.flatMap((g) => Array(g.clients).fill(g.averageDays)) }, label)] : []);
  const unnamed = groups.get('');
  return {
    sectors: [...named.slice(0, limit), ...merge(named.slice(limit), 'others', 'Autres secteurs'), ...(unnamed ? [row(unnamed, 'Secteur non renseigné')] : [])],
    named: named.length,
    known: lives.length - (unnamed ? unnamed.days.length : 0),
    unknown: unnamed ? unnamed.days.length : 0,
  };
}

// Tout ce que la page montre, à la date `asOf` (AAAA-MM-JJ) : `null` tant que le board n'est pas chargé.
export function financialAnalysis(boardRows, asOf) {
  if (!Array.isArray(boardRows)) return null;
  const established = boardRows.filter((row) => !row.is_pending_contract);
  const retention = computeRetention(established, asOf, asOf.slice(0, 7));
  const { lives } = clientLifetimes(established, asOf);
  return {
    asOf,
    ...retention,
    inCourse: retention.resiliationGlobal.base,
    survival: survival(lives, asOf),
    afterFirstYear: afterFirstYear(lives),
    ...sectorBreakdown(lives),
  };
}
