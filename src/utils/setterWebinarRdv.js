// RDV webinaire de la setteuse (demande dev 05/10/2026) : logique pure de l'onglet « RDV webinaire »
// de sa tracking sheet. Données : GET /api/v1/tracking/setter/webinar-rdv (lecture seule).
// Dates du RDV = heure-mur du CRM (« 2026-10-08T20:00:00 ») : lues telles quelles, jamais converties.

export const OUTCOME_LABELS = {
  upcoming: 'À venir',
  held: 'Honoré',
  no_show: 'No-show',
  to_qualify: 'À qualifier',
  removed: 'R2 retiré',
};

export const OUTCOME_HINTS = {
  upcoming: 'Le rendez-vous n\'a pas encore eu lieu.',
  held: 'Le commercial a indiqué que le rendez-vous a eu lieu.',
  no_show: 'Le prospect ne s\'est pas présenté.',
  to_qualify: 'Rendez-vous passé : le commercial n\'a pas encore saisi le résultat.',
  removed: 'Le commercial a retiré le R2 de la fiche, sans résultat.',
};

export const OUTCOME_TONES = {
  upcoming: '#3b82f6',
  held: '#10b981',
  no_show: '#ef4444',
  to_qualify: '#f59e0b',
  removed: '#94a3b8',
};

export const SUMMARY_KEYS = ['upcoming', 'held', 'no_show', 'to_qualify'];

const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function wallParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return { y, mo, d, h, mi };
}

// « jeu. 8 oct. · 20 h » ou « jeu. 8 oct. · 20 h 30 » (heure-mur, sans conversion de fuseau).
export function fmtRdv(iso) {
  const p = wallParts(iso);
  if (!p) return 'Date inconnue';
  const weekday = WEEKDAYS[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()];
  const hour = p.mi ? `${p.h} h ${String(p.mi).padStart(2, '0')}` : `${p.h} h`;
  return `${weekday} ${p.d} ${MONTHS[p.mo - 1]} · ${hour}`;
}

// Instant réel de la réservation (avec fuseau), affiché en heure de Paris.
export function fmtBooked(iso) {
  if (!iso) return '';
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' }).format(instant);
}

export function assignedLabel(assigned) {
  if (!assigned || assigned.state === 'unassigned') return 'En attente d\'affectation';
  if (assigned.state === 'archived') return 'Lead archivé';
  return assigned.name || 'Commercial inconnu';
}

// Les RDV à venir d'abord (le plus proche en tête), puis les autres (le plus récent en tête).
export function orderRdv(items) {
  const list = Array.isArray(items) ? [...items] : [];
  const key = (r) => String(r.rdv_at || '');
  const upcoming = list.filter((r) => r.outcome === 'upcoming').sort((a, b) => key(a).localeCompare(key(b)));
  const others = list.filter((r) => r.outcome !== 'upcoming').sort((a, b) => key(b).localeCompare(key(a)));
  return [...upcoming, ...others];
}
