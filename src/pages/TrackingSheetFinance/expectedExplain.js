// expectedExplain.js — pourquoi un mois du poste Attendus est ce qu'il est.
//
// Demande dev 2026-11-10 (n°565) : « dans Gérer les attendus, faut que ce soit
// clair. Il y a un mois qui est à zéro, on ne sait pas qu'il l'a mis en pause.
// C'est normal que derrière, elle se dise qu'il y a un problème. »
//
// Un mois à 0 € affichait « — » : rien ne disait si c'était une pause, une
// suppression, un mois hors facturation ou un montant jamais touché. Une pause
// levée ou arrivée à sa date ne laissait plus aucune trace à l'écran, alors
// que l'attendu passé à 0 € (« rien dû pendant la pause ») ne revient pas.
//
// Ici chaque mois reçoit une pastille et une phrase, tirées UNIQUEMENT de ce
// que le serveur a enregistré : la pause posée sur la ligne, les opérations du
// client, le départ et la fin de facturation, la perte déclarée. Aucun montant
// n'est recalculé. Quand rien n'est enregistré, on le dit tel quel plutôt que
// de laisser un tiret.

import { advanceLinks, formatDateFR, formatEUR, formatMonthLabel, scopedAdvance } from './constants.js';

// Préfixe posé par le serveur sur le motif d'une pause « rien dû ».
const WAIVED = 'Rien dû pendant la pause';

// Gestes qui changent l'attendu d'un mois. Un reçu saisi ou un reste dû
// corrigé n'expliquent pas un attendu à 0 €.
const EXPECTED_KINDS = new Set(['expected', 'discount', 'defer', 'shift', 'contract']);
// Parmi eux, ceux qui fixent le montant du mois lui-même : ils passent avant
// « avant démarrage » et « hors facturation ».
const DIRECT_KINDS = new Set(['expected', 'discount', 'defer']);

// Au-delà, la liste des opérations peut être tronquée : on ne peut plus
// affirmer qu'un mois n'a « aucun geste enregistré ».
export const EXPLAIN_OPS_LIMIT = 200;

const day = (iso) => {
  const s = formatDateFR(iso);
  return s === '—' ? null : s;
};
const month = (key) => formatMonthLabel(key).toLowerCase();
const sentence = (bits) => bits.filter(Boolean).join(' · ');

// Ce que la ligne garde d'une pause, y compris après sa levée : la reprise ne
// remet à zéro que le drapeau et la date de reprise.
export const pauseFacts = (period) => {
  const raw = String(period?.expected_paused_reason || '').trim();
  const waived = raw.startsWith(WAIVED);
  const motif = (waived ? raw.slice(WAIVED.length).replace(/^\s*[—–-]\s*/, '') : raw).trim() || null;
  const flagged = !!period?.expected_paused;
  return {
    posed: flagged || !!period?.expected_paused_at,
    flagged,
    active: !!period?.expected_pause_active,
    waived,
    motif,
    by: period?.expected_paused_by || null,
    at: day(period?.expected_paused_at),
    until: day(period?.expected_paused_until),
  };
};

// Par mois ('YYYY-MM'), dans l'entité demandée : le dernier geste encore en
// vigueur qui a touché l'attendu (`last`) et la dernière levée de pause
// (`resume`). `ops` arrive du plus récent au plus ancien ; les gestes annulés
// ne comptent pas.
export const expectedOpsByMonth = (ops, entity) => {
  const out = {};
  for (const op of ops || []) {
    if (op.reverted_at) continue;
    if (op.entity && op.entity !== entity) continue;
    const slot = op.kind === 'resume' ? 'resume' : EXPECTED_KINDS.has(op.kind) ? 'last' : null;
    if (!slot) continue;
    for (const p of op.periods || []) {
      const key = String(p).slice(0, 7);
      const cell = out[key] || (out[key] = {});
      if (!cell[slot]) cell[slot] = op;
    }
  }
  return out;
};

// Ce que le serveur a déjà imputé sur le mois depuis un trop-perçu antérieur.
// Le reste dû de la ligne suit l'attendu et le reçu du mois : il ne le déduit pas.
const advanceBit = (period, entity) => {
  const amount = scopedAdvance(period, entity);
  if (!(amount > 0)) return null;
  const detail = advanceLinks(period, entity, 'from')
    .map((l) => `${formatEUR(l.amount)} ${l.month ? `payés en ${month(l.month)}` : 'de crédit'}`);
  return `${formatEUR(amount)} déjà payés d’avance${detail.length ? ` (${detail.join(', ')})` : ''} : le reste dû de cette ligne ne les déduit pas.`;
};

// Le dernier geste posé sur le mois, tel que l'historique l'a enregistré.
const opExplain = (op, row) => {
  const when = day(op.created_at);
  const manualZero = (op.kind === 'expected' || op.kind === 'discount') && row.manual;
  return {
    label: op.kind === 'defer' ? 'Supprimé (perte)' : manualZero ? 'Mis à 0 €' : 'Aucun attendu',
    tone: op.kind === 'defer' ? 'loss' : manualZero ? 'manual' : 'muted',
    quiet: false,
    text: sentence([
      `Dernier geste${when ? ` le ${when}` : ''} : ${op.author_name ? `${op.author_name} ` : ''}${op.label || ''}`.trim(),
      op.reason ? `motif : ${op.reason}` : null,
    ]),
  };
};

const posedBit = (pause) => `Mis en pause${pause.at ? ` le ${pause.at}` : ''}${pause.by ? ` par ${pause.by}` : ''}`;
const waivedBit = (pause, row) => {
  if (!pause.waived) return null;
  return row.attendu === 0
    ? 'rien dû pendant la pause : l’attendu est passé à 0 € et compté en perte'
    : 'rien dû pendant la pause';
};

// La pastille et la phrase d'un mois.
//
//   row    : ligne calculée par le poste ({ key, attendu, recu, status, manual,
//            passe, courant, futur }), dans l'entité affichée.
//   period : ligne servie par le serveur (pause, montant manuel, imputation).
//   ctx    : { entity, monthOps, opsComplete, firstActiveKey, billingStart,
//              billingLastMonth, loss }.
//
// Renvoie { label, tone, text, quiet } :
//   label : libellé de pastille qui REMPLACE celui du statut (sinon null) ;
//   text  : phrase sous la ligne (sinon null) ;
//   quiet : mois sans histoire (hors facturation), qui peut rester estompé :
//           sa phrase tient dans l'infobulle de la pastille.
export const explainExpectedMonth = (row, period, ctx = {}) => {
  const {
    entity = 'owner', monthOps = null, opsComplete = false, firstActiveKey = null,
    billingStart = null, billingLastMonth = null, loss = null,
  } = ctx;
  const none = { label: null, tone: null, text: null, quiet: false };
  const zero = row.status === 'none';
  const pause = pauseFacts(period);

  // ── Pause en cours ────────────────────────────────────────────────
  if (pause.active) {
    return {
      ...none,
      label: row.status === 'paused' || zero ? 'En pause' : null,
      tone: 'paused',
      text: sentence([
        posedBit(pause),
        waivedBit(pause, row) || (row.attendu > 0 ? 'à rattraper après la pause' : null),
        pause.until ? `reprise le ${pause.until}` : 'reprise à décider',
        pause.motif ? `motif : ${pause.motif}` : null,
      ]),
    };
  }

  // ── Pause passée : arrivée à sa date, ou levée à la main ──────────
  if (pause.posed && row.status !== 'paid' && row.status !== 'deferred') {
    const lifted = !pause.flagged;
    const resume = monthOps?.resume;
    const resumeDay = day(resume?.created_at);
    let end = lifted
      ? `pause levée${resumeDay ? ` le ${resumeDay}` : ''}${resume?.author_name ? ` par ${resume.author_name}` : ''}`
      : `pause terminée${pause.until ? ` le ${pause.until}` : ''}`;
    if (row.attendu > 0) end += ' : le mois est de nouveau dû';
    else if (pause.waived) end += ' : l’attendu reste à 0 €';
    return {
      ...none,
      label: zero ? (lifted ? 'Pause levée' : 'Pause terminée') : null,
      tone: 'paused',
      text: sentence([posedBit(pause), waivedBit(pause, row), end, pause.motif ? `motif : ${pause.motif}` : null]),
    };
  }

  // ── Mois qui doit encore quelque chose : ce que le serveur a déjà imputé ──
  if (!zero) {
    if (row.status === 'late' || row.status === 'upcoming' || row.status === 'partial') {
      return { ...none, text: advanceBit(period, entity) };
    }
    return none;
  }

  // ── Mois à 0 € sans pause : dire d'où vient le zéro ───────────────
  if (period?.onboarding_pending) {
    return {
      label: 'Avant onboarding', tone: 'muted', quiet: true,
      text: 'Le rendez-vous d’onboarding n’a pas encore eu lieu : rien n’est demandé au client avant.',
    };
  }
  const op = monthOps?.last;
  if (op && DIRECT_KINDS.has(op.kind)) return opExplain(op, row);
  if (row.manual) {
    const at = day(period?.expected_manual_at);
    return {
      ...none,
      label: 'Mis à 0 €', tone: 'manual',
      text: `Montant fixé à la main${period?.expected_manual_by ? ` par ${period.expected_manual_by}` : ''}${at ? ` le ${at}` : ''} : ni la grille ni le classeur ne le réécrivent.`,
    };
  }
  const startKey = billingStart ? String(billingStart).slice(0, 7) : null;
  if (firstActiveKey ? row.key < firstActiveKey : (startKey && row.key < startKey)) {
    return {
      label: 'Avant démarrage', tone: 'muted', quiet: true,
      text: firstActiveKey
        ? `Premier mois avec un attendu : ${month(firstActiveKey)}.`
        : `La facturation démarre en ${month(startKey)}.`,
    };
  }
  if (billingLastMonth && row.key > billingLastMonth) {
    return {
      label: 'Hors facturation', tone: 'muted', quiet: true,
      text: `Dernier mois facturé, fixé par la direction : ${month(billingLastMonth)}.`,
    };
  }
  if (op) return opExplain(op, row);
  const lossCovers = loss && loss.kind !== 'correction' && (
    (row.passe && loss.clear_past !== false)
    || (row.courant && loss.clear_current !== false)
    || (row.futur && loss.clear_future !== false));
  if (lossCovers) {
    const at = day(loss.declared_at);
    return {
      ...none,
      label: 'Client en perte', tone: 'loss',
      text: sentence([
        `${loss.kind === 'withdrawal' ? 'Rétractation actée' : 'Client déclaré en perte'}${at ? ` le ${at}` : ''}`,
        loss.reason ? `motif : ${loss.reason}` : null,
      ]),
    };
  }
  return {
    ...none,
    label: 'Aucun attendu', tone: 'muted',
    // Sans la liste complète des opérations, on ne peut rien affirmer.
    text: opsComplete
      ? 'Rien n’est enregistré sur ce mois : ni pause, ni report, ni modification de l’attendu.'
      : null,
  };
};
