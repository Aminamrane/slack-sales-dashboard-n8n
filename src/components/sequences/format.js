// Logique pure de la page « Séquences email » (/ceo/sequences) : formats, entonnoir, répartitions, lignes du tableau.
// Rien ici ne touche au réseau ni à l'écran : tout se teste seul (format.test.js).
//
// Règle de la page : un chiffre inconnu s'affiche « — », jamais « 0 » ; une part dont la base est nulle est « — ».

export const DASH = '—';

/** Nombre entier lisible (espaces fines), « — » si la valeur est absente ou non numérique. */
export function num(v) {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return DASH;
  return new Intl.NumberFormat('fr-FR').format(Number(v));
}

/** Part entière en % de `n` sur `d`, ou null quand la base est nulle / inconnue. */
export function pctOf(n, d) {
  const a = Number(n);
  const b = Number(d);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return Math.round((a / b) * 100);
}
export const pctText = (n, d) => { const p = pctOf(n, d); return p === null ? DASH : `${p} %`; };

/** « 12 % » à partir d'un nombre déjà calculé par le serveur (taux de la confirmation) ; « — » si absent. */
export function rateText(v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return DASH;
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Number(v))} %`;
}

/** JJ/MM/AAAA en UTC (comme l'ancienne page) ; « — » si la date est absente ou illisible. */
export function fmtDate(iso) {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/** « il y a 12 s », « il y a 3 min »… ; « jamais » sans date. `now` injectable pour les tests. */
export function ago(iso, now = Date.now()) {
  if (!iso) return 'jamais';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'jamais';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return `il y a ${Math.floor(s)} s`;
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

/**
 * Horodatage d'un envoi : un instant réel (avec fuseau) s'affiche à l'heure de Paris ; une heure murale sans fuseau
 * est montrée telle quelle (les heures prévues par la règle d'envoi sont déjà à l'heure de Paris).
 */
export function fmtWhen(iso) {
  if (!iso) return DASH;
  const s = String(iso);
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const [d, t = ''] = s.split('T');
    const [, m, day] = d.split('-');
    if (!m || !day) return DASH;
    return `${day}/${m} ${t.slice(0, 5).replace(':', 'h')}`.trim();
  }
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return DASH;
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(date).replace(' ', ' ').replace(':', 'h');
}

/** Initiale d'un nom pour la pastille d'un sales. */
export const initial = (name) => String(name || '').trim().charAt(0).toUpperCase();

// ── Code couleur FIXE : 5 couleurs, chacune avec un sens (voir sequences.css) ───────────────────────
// `data-hue` prend une de ces couleurs, ou la MÊME en plus claire (`-soft`) / plus foncée (`-deep`). Rien d'autre :
// format.test.js passe en revue toutes les couleurs que ce fichier distribue.
export const PALETTE = {
  blue: 'volume et information',
  green: 'conversion et réussite',
  orange: 'attention',
  violet: 'file d’attente et canal secondaire',
  grey: 'neutre ou inactif',
};
export const COLORS = Object.keys(PALETTE);
export const VARIANTS = ['soft', 'deep'];
/** Vrai si `hue` est une des 5 couleurs, ou une de leurs variantes claire / foncée. */
export const isAllowedHue = (hue) => {
  const [base, variant, extra] = String(hue || '').split('-');
  return COLORS.includes(base) && (variant === undefined || VARIANTS.includes(variant)) && extra === undefined;
};

// ── Motifs d'entrée dans une séquence Meta (qualifications) ─────────────────
export const SEGMENTS = {
  refus_r1: { label: 'Refus R1', desc: 'Répondu, pas intéressé', tone: 'orange' },
  injoignable: { label: 'Injoignable', desc: 'Tombé sur répondeur', tone: 'violet' },
  no_show: { label: 'No-show', desc: 'R1 manqué', tone: 'blue' },
};
export const SEGMENT_ORDER = ['refus_r1', 'injoignable', 'no_show'];
export const segmentMeta = (key) => SEGMENTS[key] || { label: key || DASH, desc: '', tone: 'grey' };

/** Répartition des éligibles par motif : lignes, part de chacune et total (la barre empilée n'affiche que n > 0). */
export function segmentsOf(seq) {
  const counts = seq?.segments || {};
  const total = SEGMENT_ORDER.reduce((a, k) => a + (Number(counts[k]) || 0), 0);
  return {
    total,
    rows: SEGMENT_ORDER.map((key) => {
      const n = Number(counts[key]) || 0;
      return { key, n, share: pctOf(n, total), ...SEGMENTS[key] };
    }),
  };
}

// ── Entonnoir strict calculé par le serveur (sequence_stats.py) ──────────────
// Chaque étape est incluse dans la précédente. Barre = part des contactés ; conversion = depuis l'étape précédente.
export const FUNNEL_STEPS = [
  { key: 'cont', label: 'Contactés', field: 'contacted', ref: null, tone: 'blue', hint: '≥ 1 email reçu' },
  { key: 'click', label: 'Ont cliqué', field: 'clicked', ref: 'contacted', tone: 'blue-soft', hint: 'au moins un lien ouvert' },
  { key: 'rdv', label: 'RDV repris', field: 'rebooked', ref: 'clicked', tone: 'green-soft', hint: 'réservé après un clic' },
  { key: 'prez', label: 'Présentés', field: 'presented', ref: 'rebooked', tone: 'green', hint: 'R1 tenu après la reprise' },
  { key: 'sign', label: 'Signés', field: 'signed', ref: 'presented', tone: 'green-deep', hint: 'clients' },
];

export function funnelOf(st) {
  if (!st) return [];
  return FUNNEL_STEPS.map((step) => {
    const raw = st[step.field];
    const value = raw === null || raw === undefined ? null : Number(raw);
    const known = value !== null && Number.isFinite(value);
    const base = step.ref ? st[step.ref] : null;
    const conv = step.ref ? pctOf(value, base) : null;
    const share = known ? pctOf(value, st.contacted) : null;
    return {
      key: step.key, label: step.label, tone: step.tone, hint: step.hint,
      value: known ? value : null,
      conv,
      // largeur de la barre : au moins 3 % quand il y a quelque chose, 0 sinon
      width: !known || value === 0 ? 0 : Math.max(3, share ?? 0),
    };
  });
}

// ── Chiffres du haut de page (les six d'origine) ─────────────────────────────
export function factsOf(st) {
  if (!st) return [];
  const sent = st.sent;
  return [
    { key: 'eligible', label: 'Éligibles', value: st.eligible, hue: 'blue-soft', hint: 'à relancer aujourd’hui' },
    { key: 'sent', label: 'Emails envoyés', value: sent, hue: 'blue', hint: 'tous les envois de la séquence' },
    { key: 'clicked', label: 'Ont cliqué', value: st.clicked, hue: 'blue-deep', hint: 'prospects' },
    { key: 'rebooked', label: 'RDV repris', value: st.rebooked, hue: 'green-soft', hint: 'réservé après un clic' },
    { key: 'presented', label: 'Présentés', value: st.presented, hue: 'green', hint: 'R1 tenu après la reprise' },
    { key: 'signed', label: 'Signés', value: st.signed, hue: 'green-deep', hint: 'clients' },
  ];
}

// ── Anneaux concentriques : clics, RDV repris, signés, en part des contactés ─────────────────────
export function ringsOf(st) {
  if (!st) return [];
  return [
    { key: 'clicked', label: 'Ont cliqué', hue: 'blue', n: st.clicked, pct: pctOf(st.clicked, st.contacted) },
    { key: 'rebooked', label: 'RDV repris', hue: 'green', n: st.rebooked, pct: pctOf(st.rebooked, st.contacted) },
    { key: 'signed', label: 'Signés', hue: 'green-deep', n: st.signed, pct: pctOf(st.signed, st.contacted) },
  ];
}

/** Longueur visible d'un anneau de circonférence `c` pour `pct` % ; null (inconnu) = anneau vide, au-delà de 100 = plein. */
export const ringDash = (pct, c) => (pct === null || pct === undefined || !Number.isFinite(pct) ? 0 : (Math.min(100, Math.max(0, pct)) / 100) * c);

/** Part de chaque segment d'un anneau fractionné (donut), en longueurs de trait avec un petit espace entre deux. */
export function donutSegments(rows, c, gap = 3) {
  const total = rows.reduce((a, r) => a + (Number(r.n) || 0), 0);
  if (total <= 0) return [];
  let offset = 0;
  const live = rows.filter((r) => Number(r.n) > 0);
  return live.map((r) => {
    const len = (Number(r.n) / total) * c;
    const seg = { key: r.key, hue: r.tone || r.hue, dash: Math.max(0, len - (live.length > 1 ? gap : 0)), offset };
    offset += len;
    return seg;
  });
}

// ── Funnel par email (1 à `count`) ───────────────────────────────────────────
export function perEmailOf(seq, count = 10) {
  const list = Array.isArray(seq?.per_email) ? seq.per_email : [];
  const maxSent = Math.max(1, ...list.map((x) => Number(x.sent) || 0));
  return Array.from({ length: count }, (_, i) => {
    const e = list.find((x) => x.email_num === i + 1) || {};
    const sent = Number(e.sent) || 0;
    const clicked = Number(e.clicked) || 0;
    return {
      n: i + 1, sent, clicked, booked: Number(e.booked) || 0,
      height: sent / maxSent,                      // 0..1 : hauteur de la colonne
      clickShare: sent > 0 ? Math.min(1, clicked / sent) : 0, // part de la colonne teintée « cliqué »
    };
  });
}

// ── Tableau des prospects ────────────────────────────────────────────────────
/** Statut d'un prospect contacté, du plus avancé au moins avancé. */
export function statusOf(row) {
  if (row?.signed) return { key: 'signed', label: 'Signé', hue: 'green-deep' };
  if (row?.presented) return { key: 'presented', label: 'Présenté', hue: 'green' };
  if (row?.rebooked) return { key: 'rebooked', label: 'RDV repris', hue: 'green-soft' };
  if (row?.clicked) return { key: 'clicked', label: 'A cliqué', hue: 'blue' };
  return { key: 'sent', label: 'Envoyé', hue: 'grey' };
}

export const ROWS_PAGE = 100;

/**
 * Lignes du tableau : « dans la séquence » (contactés) ou « prospects éligibles » (aperçu serveur), filtrées par la recherche
 * (nom, email, sales), puis coupées à `limit` pour ne pas dessiner des milliers de lignes d'un coup.
 */
export function tableRows(seq, view, query, limit = ROWS_PAGE) {
  if (!seq) return { list: [], matched: 0, eligible: false, total: 0, truncated: false, hidden: 0 };
  const eligible = view === 'eligible';
  const base = (eligible ? seq.eligible_sample : seq.contacted) || [];
  const total = eligible ? Number(seq.stats?.eligible) || 0 : base.length;
  const q = String(query || '').trim().toLowerCase();
  const matched = !q ? base : base.filter((r) => `${r.full_name || ''} ${r.email || ''} ${r.sales || ''}`.toLowerCase().includes(q));
  const list = matched.slice(0, Math.max(0, limit));
  return {
    list, matched: matched.length, eligible, total,
    truncated: eligible && total > base.length,     // l'aperçu serveur est borné : la recherche ne porte que dessus
    hidden: matched.length - list.length,           // lignes trouvées mais pas encore dessinées
  };
}

/** Vue affichée par défaut : « dans la séquence » si elle est active, sinon les éligibles ; le choix de l'utilisateur prime. */
export const effectiveView = (seq, chosen) => chosen || (seq && seq.enabled ? 'in_seq' : 'eligible');

// ── Activité (états des prospects éligibles) ─────────────────────────────────
export const STATE_META = [
  ['en_cours', 'En cours', 'ont reçu au moins un email, la suite est programmée', 'blue'],
  ['en_file', 'En file', 'vont recevoir leur 1er email', 'violet'],
  ['termine', 'Terminés', '10 emails reçus', 'green'],
  ['sorti', 'Sortis', 'RDV repris, signés, désabonnés ou requalifiés', 'grey'],
  ['hors_cible', 'Hors cible', 'entrés en qualification avant l’activation', 'grey'],
  ['recupere', 'Repris', 'récupérés dans le pool commun par un autre sales : séquence coupée', 'orange-soft'],
  ['sans_sales', 'Bloqués', 'ni sales ni ancien sales, ou lead archivé : rien ne part', 'orange'],
  ['doublon', 'Doublons', 'même adresse déjà contactée via une autre fiche', 'grey'],
];

/** Un envoi prévu est « en retard » s'il devait partir il y a plus de 5 minutes. */
export function isLate(dueAt, now = Date.now()) {
  const t = new Date(dueAt).getTime();
  return Number.isFinite(t) && t < now - 5 * 60000;
}
