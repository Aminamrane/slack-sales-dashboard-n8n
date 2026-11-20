// Fonctions pures de la page « Enregistrements sales » (aucun React, aucun réseau) : regroupement par équipe, recherche, totaux, tri des analyses.
// Elles reprennent à l'identique les règles de l'ancienne grille (SalesRecordingsGrid) et de l'ancienne fiche (SalesRecordingsDetail).

export const NO_TEAM = 'Sans équipe';

// Entier français ; tout ce qui n'est pas un nombre (inconnu, « — ») reste « — » et ne devient jamais « NaN » ni « 0 ».
export const fmtN = (value) => (typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('fr-FR').format(value) : '—');

export const initialsOf = (name) => String(name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const salesName = (s) => s?.name || s?.full_name || s?.email || '';
export const teamOf = (s) => s?.team || NO_TEAM;

// Minuscules sans accents : « elodie » trouve « Élodie ».
const fold = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr');

export const matchesSearch = (s, query) => {
  const q = fold(query).trim();
  return !q || fold(`${s.name || s.full_name || ''} ${s.email || ''}`).includes(q);
};

// Couleur d'équipe : l'API n'en donne pas pour cette page, on en attribue une par rang (deux équipes voisines n'ont jamais la même), « Sans équipe » reste neutre.
export const TONES = ['green', 'blue', 'amber', 'peach', 'terra'];

// Équipes dans l'ordre d'arrivée des données (comme avant), « Sans équipe » en dernier ; une équipe vide après filtre disparaît.
export function groupTeams(sales, { query = '', team = '' } = {}) {
  const order = [];
  const seen = new Set();
  for (const s of sales || []) {
    const t = teamOf(s);
    if (!seen.has(t)) { seen.add(t); order.push(t); }
  }
  order.sort((a, b) => (a === NO_TEAM) - (b === NO_TEAM));
  const groups = order.map((label, i) => ({ key: label, label, tone: label === NO_TEAM ? null : TONES[i % TONES.length], members: [] }));
  const byLabel = new Map(groups.map((g) => [g.label, g]));
  for (const s of sales || []) {
    if (team && teamOf(s) !== team) continue;
    if (!matchesSearch(s, query)) continue;
    byLabel.get(teamOf(s)).members.push(s);
  }
  return { teams: order, groups: groups.filter((g) => g.members.length > 0) };
}

export const sharedCount = (s) => s?.nb_shared ?? (Array.isArray(s?.recordings) ? s.recordings.filter((r) => r.shared).length : 0);

// Appels Allo du mois d'un sales : null tant que la lecture est en cours, « — » (null affiché) si le compte n'est pas relié.
export function callsOf(s, calls) {
  if (!calls || calls.loading) return { value: null, pending: true };
  const entry = calls.byEmail?.[String(s.email || '').toLowerCase()];
  return { value: entry && typeof entry.calls === 'number' ? entry.calls : null, pending: false };
}

export function totalsOf(data, calls) {
  const sales = data?.sales || [];
  return {
    sales: data ? sales.length : null,
    calls: calls?.loading ? null : (calls?.total ?? null),
    scored: data ? sales.reduce((n, s) => n + (s.nb_scored || 0), 0) : null,
    videos: data?.totals?.videos ?? null,
    docs: data?.totals?.transcriptions ?? null,
  };
}

// Fichiers d'un sales, répartis comme dans la fiche : vidéos, notes / transcriptions, partagés avec lui.
export function splitFiles(recordings) {
  const all = Array.isArray(recordings) ? recordings : [];
  return {
    videos: all.filter((r) => r.kind === 'video' && !r.shared),
    notes: all.filter((r) => (r.kind === 'note' || r.kind === 'transcript') && !r.shared),
    shared: all.filter((r) => r.shared),
  };
}

// Analyses d'un sales : la plus récente d'abord.
export const sortScorecards = (list) => (list || []).slice().sort((a, b) => (b.rdv_date || '').localeCompare(a.rdv_date || ''));

// Palier d'un score (mêmes seuils qu'avant : 80 / 70 / 60).
export const scoreBand = (score) => (score >= 80 ? 'top' : score >= 70 ? 'good' : score >= 60 ? 'mid' : 'low');

export const fmtDate = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); } catch { return String(iso).slice(0, 10); }
};

// « 2026-W31 » → « Semaine 31 · 2026 »
export const fmtPeriod = (p) => {
  if (!p) return '';
  const m = /^(\d{4})-W(\d{1,2})$/.exec(p);
  return m ? `Semaine ${parseInt(m[2], 10)} · ${m[1]}` : p;
};

// Nom du prospect d'une analyse, sans la parenthèse finale.
export const prospectName = (sc) => String(sc?.prospect || 'Prospect').split('(')[0].trim();
