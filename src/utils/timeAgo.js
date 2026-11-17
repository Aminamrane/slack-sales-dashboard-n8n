// Ancienneté d'un message, comme dans les fils d'échanges (« à l'instant », « il y a 5 min », « hier », puis la date).
// Partagé par le fil d'échanges de la fiche Finance et les commentaires facturation de la Tracking Sheet (dev 17/11/2026).

// Les dates sans fuseau du serveur sont en UTC.
export const asDate = (iso) => {
  if (!iso) return null;
  const d = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(iso)) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function timeAgo(iso, now = Date.now()) {
  const d = asDate(iso);
  if (!d) return '';
  const minutes = Math.round((now - d.getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const fullDate = (iso) => asDate(iso)?.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '';
