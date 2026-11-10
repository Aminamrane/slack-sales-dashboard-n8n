// statement.js — le relevé d'un client mis en mots, mois par mois.
//
// Demande dev 2026-11-10 (n°565) : « avoir quand il a trop payé ou pas assez,
// pourquoi on en est là aujourd'hui, quelque chose de logique et clean ».
//
// Le serveur sert le relevé avec l'historique du client (`timeline.statement`,
// une liste de mois par entité) : ce que chaque mois demande, ce qu'il a reçu,
// le solde qu'il laisse, et vers quel mois chaque euro est parti. Ici on ne
// calcule AUCUN montant de plus : on additionne ce qui est servi, et on écrit
// la phrase. Trois choses sortent de `buildStatement` :
//
//   head   : où en est le client aujourd'hui, et pourquoi ;
//   totals : attendu exigible − reçu ± corrections = ce que dit `head` ;
//   months : chaque mois, son écart, son solde, et où l'argent est allé.

import { formatEUR, formatMonthLabel } from './constants.js';

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? r2(n) : 0;
};
const sum = (links) => r2((links || []).reduce((s, l) => s + l.amount, 0));
const links = (raw) => (raw || [])
  .map((l) => ({ period: l.period ? String(l.period).slice(0, 7) : null, amount: num(l.amount) }))
  .filter((l) => l.amount > 0);
const eur = (v) => formatEUR(r2(v));
const signed = (v) => `${v < 0 ? '−' : '+'}${eur(Math.abs(v))}`;

const month = (period) => formatMonthLabel(period).toLowerCase();
// « d’août », « de juin 2026 »
const de = (label) => (/^[aeiouyàâéèêëîïôöùû]/.test(label) ? `d’${label}` : `de ${label}`);
// « juin », « juin et août », « juin, juillet et août »
const list = (items) => {
  const u = [...new Set(items.filter(Boolean))];
  return u.length <= 1 ? (u[0] || '') : `${u.slice(0, -1).join(', ')} et ${u[u.length - 1]}`;
};

// Solde signé → ce qu'on lit : « Doit 12,00 € », « Avance 12,00 € », « À jour ».
export const balanceLabel = (balance) => {
  const b = r2(balance);
  if (b > 0) return `Doit ${eur(b)}`;
  if (b < 0) return `Avance ${eur(-b)}`;
  return 'À jour';
};

// Un mois servi → nombres, et les trois mouvements que la phrase raconte.
// Tout vient des soldes et des liens servis :
//   gap         : reçu − demandé sur le mois ;
//   settled     : retards antérieurs payés par l'argent de ce mois ;
//   advanceUsed : avance consommée par le mois ; advanceLeft : avance qu'il laisse ;
//   shortfall   : ce que le mois lui-même laisse impayé.
const normalize = (raw) => {
  const m = {
    period: String(raw.period).slice(0, 7),
    expected: num(raw.expected),
    charged: num(raw.charged),
    received: num(raw.received),
    recovered: num(raw.received_overdue),
    adjustment: num(raw.adjustment),
    opening: num(raw.opening),
    closing: num(raw.closing),
    notDue: num(raw.not_due),
    paused: !!raw.paused,
    unpaid: num(raw.unpaid),
    settles: links(raw.settles),
    settledBy: links(raw.settled_by),
    writtenOff: links(raw.written_off),
    advanceFrom: links(raw.advance_from),
    advanceTo: links(raw.advance_to),
  };
  m.paid = r2(m.received + m.recovered);
  m.gap = r2(m.paid - m.charged);
  m.settled = sum(m.settles);
  const before = Math.max(-m.opening, 0);
  const after = Math.max(-m.closing, 0);
  m.advanceUsed = r2(Math.max(before - after, 0));
  m.advanceLeft = r2(Math.max(after - before, 0));
  m.shortfall = r2(Math.max(m.settled + m.advanceLeft - m.advanceUsed - m.gap, 0));
  // Mois sans histoire : rien demandé, rien reçu. La fenêtre y pose la
  // pastille de `expectedExplain` (aucun attendu, avant démarrage, perte…).
  m.quiet = !m.paused && m.charged === 0 && m.paid === 0;
  return m;
};

// Ce qu'un mois doit encore, vu à la fin du mois `at` : ce qui reste impayé
// aujourd'hui, plus ce qu'un mois POSTÉRIEUR à `at` a réglé ou effacé depuis.
const owedAfter = (m, at) => r2(
  m.unpaid
  + sum(m.settledBy.filter((l) => l.period > at))
  + sum(m.writtenOff.filter((l) => !l.period || l.period > at)),
);

// La pastille d'écart du mois.
const gapPill = (m) => {
  if (m.paused) return { label: 'En pause', tone: 'paused' };
  if (m.quiet) return null;
  if (m.gap > 0) return { label: `Trop payé ${signed(m.gap)}`, tone: 'over' };
  if (m.gap === 0) return { label: 'Juste', tone: 'even' };
  if (m.shortfall === 0) return { label: `Avance utilisée ${signed(m.gap)}`, tone: 'even' };
  if (m.notDue > 0 && m.notDue >= m.shortfall) return { label: `Pas encore exigible ${signed(m.gap)}`, tone: 'wait' };
  return { label: `Pas assez ${signed(m.gap)}`, tone: 'short' };
};

// Le solde après le mois. La part pas encore exigible du mois en cours n'est
// pas une dette : elle se lit à côté, pas dans « Doit ».
const balanceCell = (m) => {
  if (m.closing < 0) return { label: balanceLabel(m.closing), tone: 'over', note: null };
  const due = r2(Math.max(m.closing - m.notDue, 0));
  return {
    label: balanceLabel(due),
    tone: due > 0 ? 'short' : 'even',
    note: m.notDue > 0 ? `${eur(m.notDue)} pas encore exigibles` : null,
  };
};

// Ce qui arrive avant le mois sans être ni un attendu ni un encaissement :
// un solde de départ, ou une correction de la finance.
const eventBefore = (m, previous) => {
  if (m.adjustment === 0) return null;
  if (!previous) return { amount: m.adjustment, text: `Solde de départ : ${balanceLabel(m.opening).toLowerCase()}.` };
  return {
    amount: m.adjustment,
    text: `Correction hors encaissement (${signed(m.adjustment)}) : le solde passe de « ${balanceLabel(previous.closing)} » à « ${balanceLabel(m.opening)} ».`,
  };
};

// Le mois ne demande pas ce que son attendu affiche : un report, une
// correction ou une perte lui est rattaché.
const movedBit = (m) => {
  const moved = r2(m.charged - m.expected);
  if (m.paused || moved === 0) return null;
  return moved > 0
    ? `Dont ${eur(moved)} reportés ou corrigés sur ce mois.`
    : `${eur(-moved)} retirés de ce mois (report, correction ou perte).`;
};

// La phrase du mois : ce qui est entré, puis où chaque euro est allé.
const story = (m, all) => {
  const year = m.period.slice(0, 4);
  // Dans la phrase, un mois de la même année se dit sans l'année.
  const ref = (p) => (p.slice(0, 4) === year ? month(p).replace(/ \d{4}$/, '') : month(p));
  const refs = (ls, fallback) => list(ls.map((l) => (l.period ? ref(l.period) : fallback)));

  let intake;
  if (m.paid === 0) intake = 'Rien reçu';
  else if (m.received > 0 && m.recovered > 0) intake = `${eur(m.received)} pour le mois + ${eur(m.recovered)} saisis « sur retard »`;
  else if (m.recovered > 0) intake = `${eur(m.recovered)} saisis « sur retard »`;
  else intake = m.gap === 0 && m.charged > 0 ? 'Mois payé' : `${eur(m.received)} reçus`;

  const bits = [];
  if (m.advanceUsed > 0) {
    const from = refs(m.advanceFrom, 'crédit accordé');
    const role = m.shortfall > 0 ? 'est utilisée' : m.paid > 0 ? 'paie le reste' : 'paie le mois';
    bits.push(`l’avance de ${eur(m.advanceUsed)}${from ? ` (${from})` : ''} ${role}`);
  }
  for (const l of m.settles) {
    const origin = l.period ? all.find((e) => e.period === l.period) : null;
    if (!origin) bits.push(`${eur(l.amount)} paient le retard antérieur`);
    else if (owedAfter(origin, m.period) > 0) bits.push(`${eur(l.amount)} réduisent le retard ${de(ref(l.period))}`);
    else bits.push(`${eur(l.amount)} soldent ${ref(l.period)}`);
  }
  if (m.advanceLeft > 0) {
    const used = m.advanceTo.filter((l) => l.period);
    const open = sum(m.advanceTo.filter((l) => !l.period));
    const removed = r2(m.advanceLeft - sum(m.advanceTo));
    const fate = [];
    if (used.length) fate.push(`${sum(used) === m.advanceLeft ? '' : `${eur(sum(used))} `}utilisés en ${refs(used)}`);
    if (open > 0) fate.push(open === m.advanceLeft ? 'pas encore utilisés' : `${eur(open)} pas encore utilisés`);
    if (removed > 0) fate.push(`${eur(removed)} retirés ensuite par une correction`);
    bits.push(`${eur(m.advanceLeft)} restent en avance${fate.length ? ` (${fate.join(', ')})` : ''}`);
  }
  if (m.shortfall > 0) {
    if (m.notDue > 0 && m.notDue >= m.shortfall) {
      bits.push(`${eur(m.shortfall)} pas encore exigibles`);
    } else {
      const later = sum(m.settledBy);
      const off = sum(m.writtenOff);
      const fate = [];
      if (later > 0) fate.push(`${later === m.shortfall ? '' : `${eur(later)} `}réglés depuis en ${refs(m.settledBy)}`);
      if (m.unpaid > 0) fate.push(`${m.unpaid === m.shortfall ? '' : `${eur(m.unpaid)} `}toujours dus`);
      if (off > 0) fate.push(`${off === m.shortfall ? '' : `${eur(off)} `}effacés par une correction`);
      bits.push(`il manque ${eur(m.shortfall)}${fate.length ? `, ${fate.join(', ')}` : ''}`);
    }
  }

  let text = bits.length ? `${intake} : ${bits.join(', ')}.` : `${intake}.`;
  if (m.paused) text = `En pause, rien n’est demandé. ${text}`;

  // Ce que les mois d'avant doivent encore à la fin de celui-ci.
  const older = r2(Math.max(m.closing, 0) - m.shortfall);
  if (older > 0) {
    const names = all.filter((e) => e.period < m.period && owedAfter(e, m.period) > 0).map((e) => ref(e.period));
    const shown = names.length > 3 ? [...names.slice(0, 3), `${names.length - 3} autre${names.length - 3 > 1 ? 's' : ''} mois`] : names;
    text += names.length ? ` Reste dû d’avant : ${list(shown)}.` : ' Un retard antérieur reste dû.';
  }
  const moved = movedBit(m);
  return moved ? `${text} ${moved}` : text;
};

// La position du client aujourd'hui, et d'où elle vient.
const headOf = (months) => {
  const last = months[months.length - 1];
  const due = r2(Math.max(last.closing - last.notDue, 0));
  const pending = last.notDue > 0 ? `${eur(last.notDue)} ${de(month(last.period))} pas encore exigibles` : null;
  if (due > 0) {
    // Les mois qui portent la dette exigible ; le reste vient d'avant le relevé.
    const owed = months
      .map((m) => ({ period: m.period, amount: r2(m.unpaid - (m === last ? Math.min(m.notDue, m.unpaid) : 0)) }))
      .filter((o) => o.amount > 0);
    const rest = r2(due - sum(owed));
    const parts = owed.map((o) => `${month(o.period)} (${eur(o.amount)})`);
    if (rest > 0) parts.push(`retard antérieur (${eur(rest)})`);
    return { tone: 'short', title: `Le client doit ${eur(due)}`, why: parts.length ? `Impayé : ${parts.join(', ')}` : null, pending };
  }
  if (last.closing < 0) {
    const advance = r2(-last.closing);
    const open = months
      .map((m) => ({ period: m.period, amount: sum(m.advanceTo.filter((l) => !l.period)) }))
      .filter((o) => o.amount > 0);
    const rest = r2(advance - sum(open));
    const parts = open.map((o) => `${month(o.period)} (${eur(o.amount)})`);
    if (rest > 0) parts.push(`crédit accordé (${eur(rest)})`);
    return { tone: 'over', title: `Le client a ${eur(advance)} d’avance`, why: parts.length ? `Payé en trop en ${parts.join(', ')}` : null, pending };
  }
  return { tone: 'even', title: 'Le client est à jour', why: null, pending };
};

// Le relevé d'une entité, prêt à afficher. `raw` = `timeline.statement[entity]`.
// null quand le serveur ne sert pas de relevé, ou qu'il ne s'est rien passé.
export const buildStatement = (raw) => {
  if (!Array.isArray(raw) || !raw.length) return null;
  const all = raw.map(normalize).sort((a, b) => a.period.localeCompare(b.period));
  // Le relevé commence au premier mois où il se passe quelque chose.
  const first = all.findIndex((m) => !m.quiet || m.expected !== 0 || m.opening !== 0 || m.closing !== 0 || m.adjustment !== 0);
  if (first < 0) return null;
  const months = all.slice(first).map((m, i, shown) => ({
    ...m,
    label: formatMonthLabel(m.period),
    pill: gapPill(m),
    balance: balanceCell(m),
    event: eventBefore(m, i > 0 ? shown[i - 1] : null),
    text: m.quiet ? movedBit(m) : story(m, all),
  }));
  const last = months[months.length - 1];
  // L'addition tombe sur la position d'aujourd'hui : la part du mois en cours
  // qui n'est pas encore exigible n'y entre pas (elle est citée à part).
  const notDue = last.closing > 0 ? Math.min(last.notDue, last.closing) : 0;
  const closing = r2(last.closing - notDue);
  return {
    head: headOf(months),
    totals: {
      since: month(months[0].period),
      charged: r2(months.reduce((s, m) => s + m.charged, 0) - notDue),
      paid: r2(months.reduce((s, m) => s + m.paid, 0)),
      adjustment: r2(months.reduce((s, m) => s + m.adjustment, 0)),
      notDue: r2(notDue),
      closing,
      balance: balanceLabel(closing),
    },
    months,
  };
};
