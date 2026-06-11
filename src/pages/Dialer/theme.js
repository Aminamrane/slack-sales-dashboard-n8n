// src/pages/Dialer/theme.js
//
// Local palette for the Power Dialer page. Mirrors the app's design tokens
// (indigo accent #5b6abf / #7c8adb, Notion-clean surfaces) WITHOUT importing
// or mutating the shared design system — kept page-local on purpose.

export function getTheme(darkMode) {
  return darkMode
    ? {
        pageBg:    '#13141b',
        surface:   '#1e1f28',
        surfaceAlt:'#181922',
        card:      '#1e1f28',
        border:    '#2a2b36',
        borderSoft:'#23242f',
        text:      '#eef0f6',
        textMuted: '#8b8fa0',
        textFaint: '#6b6f7e',
        accent:    '#7c8adb',
        accentBg:  'rgba(124,138,219,0.16)',
        green:     '#32d74b',
        greenBg:   'rgba(50,215,75,0.15)',
        amber:     '#ff9f0a',
        amberBg:   'rgba(255,159,10,0.15)',
        red:       '#ff453a',
        redBg:     'rgba(255,69,58,0.15)',
        shadow:    '0 2px 8px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.25)',
        shadowSoft:'0 1px 3px rgba(0,0,0,0.25)',
      }
    : {
        pageBg:    '#edf0f8',
        surface:   '#ffffff',
        surfaceAlt:'#f6f7fb',
        card:      '#ffffff',
        border:    '#e2e6ef',
        borderSoft:'#eef0f6',
        text:      '#1e2330',
        textMuted: '#787774',
        textFaint: '#9b9a97',
        accent:    '#5b6abf',
        accentBg:  '#eef0fb',
        green:     '#0f7b6c',
        greenBg:   '#ddedea',
        amber:     '#cb912f',
        amberBg:   '#fdecc8',
        red:       '#b74133',
        redBg:     '#ffe2dd',
        shadow:    '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
        shadowSoft:'0 1px 3px rgba(0,0,0,0.04)',
      };
}

// Initials for the avatar bubble.
export function initials(first, last) {
  const a = (first || '').trim();
  const b = (last || '').trim();
  const f = a ? a[0] : '';
  const l = b ? b[0] : '';
  return (f + l).toUpperCase() || '•';
}

// Pretty FR phone grouping for display only (keeps E.164 untouched in data).
export function prettyPhone(raw) {
  const p = (raw || '').trim();
  if (p.startsWith('+33') && p.length === 12) {
    // +33 6 12 34 56 78
    const n = p.slice(3);
    return `+33 ${n[0]} ${n.slice(1, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
  }
  return p;
}

// Human duration : 9 → "9 s", 252 → "4 min 12 s", 3720 → "1 h 02 min".
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, '0')} min`;
}

// Outcome → label + tone, used by the operator console end-of-call chip.
export const OUTCOME_META = {
  done:      { label: 'Répondu',       tone: 'green' },
  no_answer: { label: 'Pas de réponse', tone: 'amber' },
  failed:    { label: 'Échec',          tone: 'red' },
};
