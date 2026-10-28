// Statistiques du dashboard CEO, calculées à partir des lignes du board Owner/Opti'Lex
// (GET /optilex/board) et des montants de la Finance (GET /ceo-dashboard/owner-arr).
// Fonctions pures, sans React : les chiffres des cartes sont testables tels quels.
// Les règles sont celles du board (prédicats importés, jamais recopiés) : chaque
// chiffre est vérifiable en un clic dans l'onglet correspondant du board.
import { displayEtat, matchesSignedClient, isCurrentProductClient, EXITED_ETATS } from './boardClientState.js';
import { isActiveOnboardingUpcoming, isActiveOnboardingOverdue } from './boardPredicates.js';
import { parisWallTime } from './boardIntegration.js';
import { meteoBandOf } from './meteoBands.js';
import { lossArr } from './lossArr.js';

export const MONTH_LABELS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// Dernier jour du mois d'une clé 'YYYY-MM', en ISO court : les dates du board
// sont comparées en chaînes (YYYY-MM-DD), indépendamment du fuseau du client.
export const periodEndISO = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
export const dateOnly = (v) => (v ? String(v).slice(0, 10) : null);
export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
// « octobre 2026 » : libellé d'une clé de mois, en minuscules comme dans une phrase.
export const periodLabelOf = (key) => (key && key !== 'all'
  ? `${MONTH_LABELS_FR[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`.toLowerCase()
  : null);

// États de SORTIE : c'est leur `etat_date` qui date le mouvement, et c'est ce
// qui permet de savoir qu'un client aujourd'hui parti était actif avant.
export const BOARD_TERMINAL_ETATS = new Set(['Résiliation', 'Rétractation', 'Self-Résiliation', 'Liquidation']);
export const BOARD_RESILIE = 'Résiliation';
export const BOARD_RETRACTE = 'Rétractation';

// Options du sélecteur de période : "Tout" + les 24 derniers mois (antériorité couvrant
// largement les états datés du board, dont les plus anciens remontent à 2025).
export function etatPeriodOptions(now = new Date()) {
  const list = [{ key: 'all', label: 'Tout' }];
  for (let i = 0; i < 24; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push({ key: monthKey(d), label: `${MONTH_LABELS_FR[d.getMonth()]} ${d.getFullYear()}` });
  }
  return list;
}

// Le snapshot du Sheet ne connaît que la colonne "État" brute ; le board, lui,
// applique la vraie règle (état affiché calculé par le back). On compte donc ICI
// avec `displayEtat` et les prédicats du board eux-mêmes. null tant que le board
// n'est pas chargé → les cartes montrent "—" plutôt qu'un chiffre faux.
export function computeBoardStats(boardRows, etatPeriod = 'all', ownerArr = null, now = new Date()) {
  if (!Array.isArray(boardRows)) return null;
  // Périmètre = lignes ÉTABLIES, comme le "X clients" affiché en tête du board :
  // un contrat encore en vol n'est pas un client tant que la vente n'est pas
  // déclarée. Sans ce filtre, le total ne retomberait pas sur ses pattes.
  const established = boardRows.filter((r) => !r.is_pending_contract);
  const allTime = etatPeriod === 'all';
  const end = allTime ? null : periodEndISO(etatPeriod);
  const inPeriod = (v) => { const d = dateOnly(v); return !!d && d.slice(0, 7) === etatPeriod; };
  // Signé au plus tard à la fin de la période. Les clients sans date de
  // signature ne sont comptés qu'en "Tout" : on ne les place pas d'office
  // dans un mois qu'on ne connaît pas.
  const signedBy = (r) => {
    if (allTime) return true;
    const d = dateOnly(r.owner_signed_at);
    return !!d && d <= end;
  };

  // ── STOCKS : la photo du parc à la fin de la période ──
  const total = established.filter(signedBy).length;
  // Un client aujourd'hui sorti était ACTIF avant sa sortie : `etat_date` le dit.
  // Les états intermédiaires (pause, en cours de…) ne sont PAS historisés : ils
  // comptent à leur valeur actuelle. Approximation assumée.
  const isActif = (r) => {
    if (!signedBy(r)) return false;
    const e = displayEtat(r);
    if (matchesSignedClient(r, e)) return true;
    if (allTime || !BOARD_TERMINAL_ETATS.has(e)) return false;
    const d = dateOnly(r.etat_date);
    return !!d && d > end;   // sorti après la fin de période → encore actif à cette date
  };
  const actifs = established.filter(isActif).length;

  // ── FLUX : les entrées dans l'état pendant la période ──
  const exitsOf = (name) => established
    .filter((r) => displayEtat(r) === name && (allTime || inPeriod(r.etat_date)));
  const countEtat = (name) => exitsOf(name).length;

  // ── HISTORIQUE DES SORTIES : hors filtre ──
  // 12 derniers mois dont le mois courant, par état. Une sortie sans `etat_date`
  // n'entre dans aucun mois : on ne la place pas au hasard.
  const currentMonthKey = monthKey(now);
  // `weight` : 1 par sortie pour les comptes, son ARR pour les cartes d'ARR.
  const monthlyExits = (etatName, weight = () => 1) => {
    const byMonth = {};
    established.forEach((r) => {
      if (displayEtat(r) !== etatName) return;
      const k = (dateOnly(r.etat_date) || '').slice(0, 7);
      if (k) byMonth[k] = (byMonth[k] || 0) + weight(r);
    });
    const series = [];
    const months = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = monthKey(d);
      months.push(k);
      series.push(byMonth[k] || 0);
    }
    return { series, months, thisMonth: byMonth[currentMonthKey] || 0 };
  };
  const resiliesExits = monthlyExits(BOARD_RESILIE);
  const retractesExits = monthlyExits(BOARD_RETRACTE);
  // Bulle d'une colonne de sorties : la courbe des 12 mois, ce qui la précède, ce qui la suit, ce qui
  // n'a pas de date d'effet. Les quatre font le total de l'état, sans période (comme la courbe).
  const exitDetail = (name, exits) => {
    const all = established.filter((r) => displayEtat(r) === name);
    const keyOf = (r) => (dateOnly(r.etat_date) || '').slice(0, 7);
    const first = exits.months[0];
    const lastKey = exits.months[exits.months.length - 1];
    const peak = exits.series.reduce((best, v, i) => (v > best.count ? { key: exits.months[i], count: v } : best), { key: null, count: 0 });
    return {
      total: all.length,
      last12: exits.series.reduce((a, b) => a + b, 0),
      older: all.filter((r) => keyOf(r) && keyOf(r) < first).length,
      later: all.filter((r) => keyOf(r) > lastKey).length,
      undated: all.filter((r) => !keyOf(r)).length,
      peak,
    };
  };

  // ── ARR PERDU : part Owner des MÊMES sorties que « Résiliés » et « Rétractés »
  // (même filtre de période), montants de la Finance. null tant qu'ils manquent.
  const arrStats = (name) => {
    if (!ownerArr) return null;
    const thisMonth = established.filter((r) => displayEtat(r) === name
      && (dateOnly(r.etat_date) || '').slice(0, 7) === currentMonthKey);
    return {
      ...lossArr(exitsOf(name), ownerArr),
      thisMonth: lossArr(thisMonth, ownerArr),
      series: monthlyExits(name, (r) => ownerArr[r.numero_client] || 0).series,
    };
  };

  // ── À DATE : insensibles à la période ──
  // Un RDV "à venir" est par nature dans le futur, et la météo est un relevé courant.
  // Seul l'onboarding Owner est suivi : les RDV d'intégration (rdv_lancement) n'existent plus.
  const parisNow = parisWallTime(now);
  // Rétention à la fin de la période choisie, jamais au-delà d'aujourd'hui (le mois en cours n'est pas fini).
  const todayISO = parisNow.slice(0, 10);
  const retentionAsOf = allTime || end > todayISO ? todayISO : end;
  const retention = computeRetention(established, retentionAsOf, allTime ? currentMonthKey : etatPeriod);
  // Bulle « RDV onboarding à venir » : les mêmes RDV que le compteur, rangés par échéance, et le prochain.
  const inAWeek = new Date(Date.parse(`${todayISO}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  const rdvOf = (r) => String(r.rdv_onboarding_date_manual || r.rdv_onboarding_date);
  const upcoming = established.filter((r) => isActiveOnboardingUpcoming(r, parisNow));
  const nextRdv = upcoming.filter((r) => !isActiveOnboardingOverdue(r, parisNow)).map(rdvOf).sort()[0] || null;
  const onboardingDetail = {
    today: upcoming.filter((r) => rdvOf(r).slice(0, 10) === todayISO).length,
    week: upcoming.filter((r) => rdvOf(r).slice(0, 10) > todayISO && rdvOf(r).slice(0, 10) <= inAWeek).length,
    later: upcoming.filter((r) => rdvOf(r).slice(0, 10) > inAWeek).length,
    next: nextRdv,
  };
  const signedNow = established.filter((r) => matchesSignedClient(r, displayEtat(r)));
  const scores = signedNow
    .map((r) => r.meteo_score)
    .filter((s) => typeof s === 'number' && Number.isFinite(s) && s >= 1 && s <= 5);
  const meteoBands = { rouge: 0, orange: 0, vert: 0 };
  scores.forEach((s) => { const b = meteoBandOf(s); if (b) meteoBands[b] += 1; });

  return {
    period: etatPeriod,
    periodLabel: periodLabelOf(etatPeriod),
    total,
    actifs,
    resilies: countEtat(BOARD_RESILIE),
    retractes: countEtat(BOARD_RETRACTE),
    resiliesSeries: resiliesExits.series,
    resiliesThisMonth: resiliesExits.thisMonth,
    retractesSeries: retractesExits.series,
    retractesThisMonth: retractesExits.thisMonth,
    seriesMonths: resiliesExits.months,
    arrResilies: arrStats(BOARD_RESILIE),
    arrRetractes: arrStats(BOARD_RETRACTE),
    currentMonthKey,
    currentMonthLabel: `${MONTH_LABELS_FR[now.getMonth()].toLowerCase()} ${now.getFullYear()}`,
    // Même compteur que « Onboarding à venir » du menu Onboarding du board : clients partis exclus.
    onboarding: upcoming.length,
    onboardingOverdue: established.filter((r) => isActiveOnboardingOverdue(r, parisNow)).length,
    onboardingDetail,
    resiliesDetail: exitDetail(BOARD_RESILIE, resiliesExits),
    retractesDetail: exitDetail(BOARD_RETRACTE, retractesExits),
    // Hors de la carte « Résiliés » (état Résiliation seul), mais comptées dans les taux, comme la Finance.
    selfResilies: countEtat('Self-Résiliation'),
    meteoAvg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    meteoRated: scores.length,
    meteoSigned: signedNow.length,
    pendingResiliation: established.filter((r) => displayEtat(r) === 'En cours de résiliation' && signedBy(r)).length,
    pendingRetraction: established.filter((r) => displayEtat(r) === 'En cours de rétractation' && signedBy(r)).length,
    meteoBands,
    ...retention,
    // Les clients en cours (durée de vie, taux global) ne sont pas l'onglet Signé : l'écart, état par état.
    lifetimeGap: gapFromActifs(established, isActif, (r) => isLifetimeOpenAt(r, retentionAsOf), retentionAsOf),
    inCourseGap: gapFromActifs(established, isActif, (r) => isInCourseAt(r, retentionAsOf), retentionAsOf),
  };
}

// Client en cours à une date (définition de la Finance) : signé au plus tard ce jour-là et pas encore
// sorti ; pause, attente Opti'Lex et sorties en cours comprises. Sans date de signature : placé nulle part.
const isInCourseAt = (r, d) => {
  const signed = dateOnly(r.owner_signed_at);
  if (!signed || signed > d) return false;
  if (!EXITED_ETATS.includes(displayEtat(r))) return true;
  const x = dateOnly(r.etat_date);
  return !!x && x > d;
};
// Client encore là pour la durée de vie : en cours à cette date, rétractés exclus.
const isLifetimeOpenAt = (r, d) => displayEtat(r) !== 'Rétractation' && isInCourseAt(r, d);

const frDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
// Pourquoi un client en cours n'est pas actif (pause, attente Opti'Lex, liquidation en cours…), et
// pourquoi un actif n'est pas en cours (pas de date de signature…).
const addedReason = (r, asOf) => {
  const e = displayEtat(r);
  return EXITED_ETATS.includes(e) ? `${e}, effet après le ${frDate(asOf)}` : (e || 'Sans état');
};
const removedReason = (r, asOf) => {
  const signed = dateOnly(r.owner_signed_at);
  if (!signed) return 'Sans date de signature';
  if (signed > asOf) return `Signés après le ${frDate(asOf)}`;
  if (displayEtat(r) === 'Rétractation') return 'Rétractés';
  return displayEtat(r) || 'Sans état';
};

// Écart entre les clients actifs et un autre périmètre de clients, par raison, du plus grand au plus
// petit : actifs + ajoutés − retirés = périmètre, à l'unité près, sans rien d'arrondi ni de supposé.
export function gapFromActifs(rows, isActif, isIn, asOf) {
  const added = new Map();
  const removed = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  rows.forEach((r) => {
    const a = isActif(r);
    const i = isIn(r);
    if (i && !a) bump(added, addedReason(r, asOf));
    if (a && !i) bump(removed, removedReason(r, asOf));
  });
  const list = (m) => [...m].map(([label, count]) => ({ label, count }))
    .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label, 'fr'));
  return { added: list(added), removed: list(removed) };
}

// Résiliation au sens de la Finance (onglet « Résiliation/Rétractation » de Perf.Financière) :
// les self-résiliations en font partie.
export const RESILIATION_ETATS = ['Résiliation', 'Self-Résiliation'];
const dayNumber = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
const lastDayBefore = (monthKeyStr) => {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
};

// Rétention à la date `asOf` (AAAA-MM-JJ), mêmes définitions que la Finance, vérifiées contre
// sa feuille du 14/05/2026 (36 résiliations pour 521 clients en cours ; le CRM en donne 36 pour 520).
//  - client en cours à une date : signé au plus tard ce jour-là et pas encore sorti (pause, attente
//    Opti'Lex et sorties en cours comprises) ; un client sans date de signature n'est placé nulle part ;
//  - résiliation du mois : résiliations datées dans le mois ÷ clients en cours la veille du 1er ;
//  - résiliation globale : résiliations depuis le début ÷ clients en cours à `asOf` ;
//  - durée de vie moyenne : de la signature Owner à la date d'effet de la sortie, ou à `asOf` pour
//    un client encore là (elle gagne un jour chaque jour) ; rétractés exclus, puisqu'ils n'ont jamais
//    vraiment commencé. Une sortie sans date d'effet, ou datée avant la signature, n'est pas mesurée.
export function computeRetention(established, asOf, monthKeyStr) {
  const exited = (r) => EXITED_ETATS.includes(displayEtat(r));
  const exitDate = (r) => dateOnly(r.etat_date);
  const inCourseAt = isInCourseAt;
  const isResiliation = (r) => RESILIATION_ETATS.includes(displayEtat(r));

  const monthRate = (key, upTo) => {
    const base = established.filter((r) => inCourseAt(r, lastDayBefore(key))).length;
    const count = established.filter((r) => isResiliation(r)
      && (exitDate(r) || '').slice(0, 7) === key && exitDate(r) <= upTo).length;
    return { key, count, base, rate: base ? count / base : null };
  };
  // Le mois précédent, complet, sert de comparaison.
  const previousKey = lastDayBefore(monthKeyStr).slice(0, 7);

  const inCourse = established.filter((r) => inCourseAt(r, asOf)).length;
  const globalCount = established.filter((r) => isResiliation(r) && exitDate(r) && exitDate(r) <= asOf).length;
  const resiliationUndated = established.filter((r) => isResiliation(r) && !exitDate(r)).length;

  const durations = [];
  let open = 0;
  let closed = 0;
  let unmeasured = 0;
  let incoherent = 0;
  established.forEach((r) => {
    if (displayEtat(r) === 'Rétractation') return;
    const signed = dateOnly(r.owner_signed_at);
    if (!signed) { unmeasured += 1; return; }
    if (signed > asOf) return;   // pas encore client à cette date
    let endDate = asOf;
    if (exited(r)) {
      const x = exitDate(r);
      if (!x) { unmeasured += 1; return; }
      if (x <= asOf) { endDate = x; closed += 1; } else open += 1;
    } else open += 1;
    const days = dayNumber(endDate) - dayNumber(signed);
    if (days < 0) { incoherent += 1; return; }
    durations.push(days);
  });
  durations.sort((a, b) => a - b);
  return {
    retentionAsOf: asOf,
    retentionMonthKey: monthKeyStr,
    resiliationMonth: monthRate(monthKeyStr, asOf),
    resiliationPreviousMonth: monthRate(previousKey, periodEndISO(previousKey)),
    resiliationGlobal: { count: globalCount, base: inCourse, rate: inCourse ? globalCount / inCourse : null, undated: resiliationUndated },
    lifetime: {
      averageDays: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
      medianDays: durations.length ? durations[Math.floor(durations.length / 2)] : null,
      measured: durations.length, open, closed, unmeasured, incoherent,
    },
  };
}

// Durée en jours lue en mois et jours (mois moyen de 30,44 jours) : 293 → { months: 9, days: 19 }.
export function monthsAndDays(totalDays) {
  if (totalDays == null) return null;
  const rounded = Math.round(totalDays);
  let months = Math.floor(rounded / 30.4375);
  let days = Math.round(rounded - months * 30.4375);
  if (days >= 30) { months += 1; days = 0; }
  return { months, days };
}

// Onboarding Owner (bloc Produit) : effectués / à réaliser sur le parc produit courant.
export function computeOnboarding(boardRows) {
  if (!Array.isArray(boardRows)) return null;
  const clients = boardRows.filter((r) => !r.is_pending_contract);
  return {
    done: clients.filter((r) => r.rdv_onboarding_done).length,
    remaining: clients.filter((r) => isCurrentProductClient(r, displayEtat(r)) && !r.rdv_onboarding_done).length,
  };
}

// Dirigeants accompagnés : identités NDA (GET /ceo-dashboard/portfolio) des clients
// du parc produit courant. `missing` = dossiers sans dirigeant documenté.
export function computeDirectors(boardRows, identities) {
  if (!Array.isArray(boardRows) || !identities) return null;
  const clients = boardRows.filter((r) => isCurrentProductClient(r, displayEtat(r)));
  return clients.reduce((totals, row) => {
    const identity = identities.clients?.[row.numero_client];
    totals.count += identity?.directors ?? 0;
    if (!identity?.directors_documented) totals.missing++;
    return totals;
  }, { count: 0, missing: 0 });
}
