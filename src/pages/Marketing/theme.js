/**
 * Marketing dashboard design system.
 *
 * Inspired by the 5 visual refs in src/assets/marketing/* :
 *  - very light lavender-grey backdrop (#ecedf2 / #f0f1f5) in light mode
 *  - white cards, generous border-radius, soft shadow, airy padding
 *  - one hero card filled with a solid/gradient color (emerald or violet)
 *  - dark navy bold titles, muted grey subtitles, large tabular nums
 *  - emerald / rose trend pills, ▲ / ▼ icons
 *  - floating chart tooltips with soft shadow
 *  - emerald heatmap multi-step palette
 *  - rounded gradient bars
 *
 * Dark mode is supported but the page is best viewed in light mode
 * (the refs are all light) — keep dark mode usable, not optimized.
 */

export const buildTheme = (dark) => ({
  // Page backdrop — lavender-grey in light, deep slate in dark
  backdrop: dark ? '#0f1117' : '#ecedf2',
  // Card surface
  surface: dark ? '#1b1c25' : '#ffffff',
  // Subtle inset surface (nested cards, table head)
  subtle: dark ? '#23242f' : '#f6f7fb',
  // Strong border (cards)
  border: dark ? '#2a2c38' : '#e5e7ee',
  // Muted hairline border (inside cards)
  hairline: dark ? '#23242f' : '#eef0f5',
  // Primary text — dark navy / off-white
  text: dark ? '#eef0f6' : '#101421',
  // Muted text — labels, subtitles
  muted: dark ? '#7f8294' : '#5a6072',
  // Faded text — captions, hints
  faded: dark ? '#5e6273' : '#8b91a3',
  // Soft shadow on cards
  shadow: dark
    ? '0 1px 2px rgba(0,0,0,0.2), 0 6px 18px rgba(0,0,0,0.18)'
    : '0 1px 2px rgba(15,18,30,0.025), 0 4px 14px rgba(15,18,30,0.045)',
  // Stronger shadow for floating tooltips
  shadowFloat: dark
    ? '0 4px 14px rgba(0,0,0,0.35), 0 12px 30px rgba(0,0,0,0.30)'
    : '0 4px 14px rgba(15,18,30,0.08), 0 12px 30px rgba(15,18,30,0.10)',
  // Brand color (kept consistent with existing app accent)
  accent: dark ? '#7c8adb' : '#5b6abf',
  // Tone palette — used by tiles, pills, gauges
  emerald: { fg: '#0e8f5c', bg: '#e8f8f1', strong: '#10b981' },
  rose: { fg: '#c0264a', bg: '#fce7ec', strong: '#ef4444' },
  amber: { fg: '#b45309', bg: '#fef3e2', strong: '#f59e0b' },
  blue: { fg: '#1e40af', bg: '#e6efff', strong: '#3b82f6' },
  fuchsia: { fg: '#9d174d', bg: '#fce7f3', strong: '#ec4899' },
  violet: { fg: '#5b21b6', bg: '#ede9fe', strong: '#8b5cf6' },
  // Hero card gradients (per ref image 2 + image 5)
  heroEmerald: 'linear-gradient(135deg, #10b981 0%, #0e9468 100%)',
  heroViolet: 'linear-gradient(135deg, #9b8dff 0%, #6c5ce7 65%, #5239d6 100%)',
});

/** Format a number with FR locale + thousands separators. */
export const fmtInt = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR').format(n);
};

/** Format euros — no decimals by default. */
export const fmtEur = (n, opts = {}) => {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: opts.decimals ?? 0,
    minimumFractionDigits: 0,
  }).format(n);
};

/** Format percent — accepts already-multiplied value (e.g. 71 → "71.0 %"). */
export const fmtPct = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(1)} %`;
};

/** Duration in mm ss from seconds. */
export const fmtDuration = (seconds) => {
  if (!seconds || seconds < 1) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
};

/** Format ISO datetime as Paris-localized short string. */
export const fmtParisTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Format ISO date as "12 mai" / French short. */
export const fmtShortDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

/** Relative time (now → ISO) — "il y a 3 min", etc. */
export const fmtRelative = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD < 7) return `il y a ${diffD}j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

/** Map a 0-100 score to a contextual evaluation label (gauge). */
export const scoreVerdict = (n) => {
  if (n === null || n === undefined) return { label: 'Données indisponibles', tone: 'muted' };
  if (n >= 60) return { label: 'Excellent', tone: 'emerald' };
  if (n >= 40) return { label: 'Bon, marge de progression', tone: 'amber' };
  if (n >= 20) return { label: 'Moyen — à optimiser', tone: 'amber' };
  return { label: 'Faible — alerte', tone: 'rose' };
};

/** Bar color by open rate. */
export const openRateBarColor = (pct, palette) => {
  if (pct === null || pct === undefined) return palette.faded;
  if (pct >= 50) return palette.emerald.strong;
  if (pct >= 30) return palette.emerald.fg;
  if (pct >= 15) return palette.amber.strong;
  return palette.rose.strong;
};

/** Bar color by click rate (lower thresholds). */
export const clickRateBarColor = (pct, palette) => {
  if (pct === null || pct === undefined) return palette.faded;
  if (pct >= 10) return palette.emerald.strong;
  if (pct >= 5) return palette.amber.strong;
  return palette.rose.strong;
};

/** Inject motion keyframes once at module load. */
const KEYFRAMES_ID = 'marketing-page-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(KEYFRAMES_ID)) {
  const tag = document.createElement('style');
  tag.id = KEYFRAMES_ID;
  tag.textContent = `
    @keyframes mktPageReveal {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes mktCardPop {
      0% { opacity: 0; transform: translateY(10px) scale(0.985); }
      60% { opacity: 1; transform: translateY(-2px) scale(1.005); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes mktNumberTick {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes mktPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes mktSpin {
      to { transform: rotate(360deg); }
    }
    @keyframes mktGaugeDraw {
      from { stroke-dashoffset: 100%; }
      to { stroke-dashoffset: var(--mkt-gauge-target, 50%); }
    }
    @keyframes mktModalBackdropIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes mktModalCardIn {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(tag);
}
