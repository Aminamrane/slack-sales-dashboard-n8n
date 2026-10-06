// Rendez-vous passés que le commercial doit encore qualifier (pop-up quotidien, dev 06/10/2026).
// Les dates de RDV sont des heures-mur de Paris (jamais converties) : on compare les chaînes.
import { parisToday } from './parisDates.js';

export const QUALIFY_WINDOW_DAYS = 7;
const OPEN = { r1: new Set(['', 'rescheduled']), r2: new Set(['', 'reporte']), r3: new Set(['', 'reporte']) };

const dayShift = (iso, days) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const wallTime = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(0, 16) : '');

// Un RDV par étape (R1, R2, R3) et par lead : date dans les 7 jours précédents (pas aujourd'hui),
// résultat vide ou « reporté » (la nouvelle date est passée sans résultat). Les leads signés sont exclus.
export function rdvsToQualify(leads, today = parisToday(), windowDays = QUALIFY_WINDOW_DAYS) {
  const since = dayShift(today, -windowDays);
  const out = [];
  for (const lead of leads || []) {
    if (!lead?.id || lead.status === 'signed') continue;
    for (const stage of ['r1', 'r2', 'r3']) {
      const at = wallTime(lead[`${stage}_date`] || lead[stage]);
      if (!at) continue;
      const day = at.slice(0, 10);
      if (day >= today || day < since) continue;
      if (!OPEN[stage].has(String(lead[`${stage}_result`] || '').trim())) continue;
      out.push({ key: `${lead.id}-${stage}-${at}`, lead, stage, at });
    }
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

// « mardi 6 octobre à 10 h 30 », lu sur la chaîne (heure-mur de Paris).
export function rdvLabel(at) {
  if (!wallTime(at)) return '';
  const day = new Date(`${at.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  return `${day} à ${Number(at.slice(11, 13))} h ${at.slice(14, 16)}`;
}
