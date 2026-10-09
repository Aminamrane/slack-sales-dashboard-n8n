import {formatDateLongFR, formatDateFR, formatMonthLabel, formatEUR, deMonthLabel} from './constants.js';

export function installmentSubline(inst) {
  // Format long FR (« 12 mars 2026 ») — demande dev 2026-08-19.
  const date = inst.payDate ? formatDateLongFR(inst.payDate) : null;
  const monthLabel = formatMonthLabel(inst.month);
  // Un attendu fixé à la main se signale : la grille ne le réécrira plus. Un
  // report le fixe aussi, mais il se dit lui-même (d'où vient, où part).
  const reportes = (inst.reportedTo?.length || 0) + (inst.reportedFrom?.length || 0);
  const manuel = inst.manual && !reportes ? ' · fixé à la main' : '';
  // Une créance déplacée se lit sur les deux mois : d'où elle part, où elle arrive.
  const report = (inst.deferredOut > 0 ? ` · ${formatEUR(inst.deferredOut)} reportés sur un autre mois` : '')
    + (inst.deferredIn > 0 ? ` · ${formatEUR(inst.deferredIn)} reportés ici` : '')
    + (inst.reportedFrom?.length
      ? ` · dont ${inst.reportedFrom.map((r) => `${formatEUR(r.amount)} reportés ${deMonthLabel(r.month)}`).join(', ')}`
      : '');
  switch (inst.status) {
    case 'regularized':
      return `${monthLabel} · régularisation confirmée`;
    case 'deferred':
      return inst.reportedTo?.length
        ? `${monthLabel} · attendu reporté sur ${inst.reportedTo.map((r) => formatMonthLabel(r.month).toLowerCase()).join(', ')}`
        : `${monthLabel} · créance reportée, attendu inchangé${manuel}`;
    case 'paused':
      return `${monthLabel} · en pause${inst.pauseUntil ? ` jusqu'au ${formatDateFR(inst.pauseUntil)}` : ', reprise à décider'}${manuel}`;
    case 'paid':
      return `${monthLabel}${date ? ` · Prélevée le ${date}` : ''}${manuel}`;
    case 'partial':
      return `${monthLabel} · ${formatEUR(inst.received)} / ${formatEUR(inst.expected)}${date ? ` · Prélevée le ${date}` : ''}`;
    case 'upcoming':
      return `${monthLabel}${date ? ` · Prévue le ${date}` : ''}${manuel}${report}`;
    default: // late
      return `${monthLabel}${date ? ` · Date renseignée : ${date}` : ''}${manuel}${report}`;
  }
}
