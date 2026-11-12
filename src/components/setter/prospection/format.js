// Formats et constantes partagés de la prospection setter.

export const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";
// Police de la tracking sheet setter, reprise par les modales (rendues hors de la page, dans <body>).
export const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

export const fmtInt = (n) => new Intl.NumberFormat('fr-FR').format(Number(n) || 0);

// « LILLE (59000) » : le code postal du siège quand la fiche l'a, sinon le libellé de la source (« LILLE (59) »).
export const locationLabel = (c) => (c.city && c.postal_code ? `${c.city} (${c.postal_code})` : c.location_label);

export const fmtDay = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }).format(d);
};

export const STATUS_META = {
  a_contacter: { label: 'À contacter', dot: '#9d9890' },
  contacte: { label: 'Contactée', dot: '#1b6fd0' },
  repondu: { label: 'A répondu', dot: '#15803d' },
  ecarte: { label: 'Écartée', dot: '#b42318' },
};

export const chipColors = (C, darkMode) => ({
  bg: darkMode ? 'rgba(255,255,255,0.08)' : '#f1eee9',
  text: darkMode ? '#e3e3e3' : '#4a4540',
  close: darkMode ? '#a3a3a3' : '#8b867e',
});

export const inputStyle = (C) => ({
  padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text,
  fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
});

export const fmtDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).format(d);
  const time = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Paris' }).format(d);
  return `${day} à ${time.replace(':', ' h ')}`;
};

// Recherches Pappers : statuts et étapes de GET /lead-searches.
export const PAPPERS_STATUS = {
  pending: { label: 'En file', dot: '#9d9890' },
  running: { label: 'En cours', dot: '#1b6fd0' },
  completed: { label: 'Terminée', dot: '#15803d' },
  failed: { label: 'Échec', dot: '#b42318' },
};
export const PAPPERS_STAGE = { pappers: 'Pappers', managers: 'dirigeants', google: 'Google' };

// Date CRM en heure-mur (« 2026-10-12T10:00 ») : lue telle quelle, jamais convertie de fuseau.
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const fmtWallDateTime = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(iso || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} à ${m[4]} h ${m[5]}` : '';
};
