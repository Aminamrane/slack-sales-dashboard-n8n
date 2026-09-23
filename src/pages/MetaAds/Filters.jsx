// src/pages/MetaAds/Filters.jsx — barre de filtres façon Search Console.
//
// Des puces de période (7 jours, 28 jours, ce mois-ci, mois dernier, 3 mois,
// personnalisé) et le choix du portefeuille Meta. Une seule puce active,
// teintée de bleu ; la période personnalisée ouvre deux champs de date.

import React, { useState } from 'react';
import Pict from './icons.jsx';

function iso(d) { return d.toISOString().slice(0, 10); }
const today = () => new Date();
const daysAgo = (n) => { const d = today(); d.setDate(d.getDate() - n); return d; };

export const PERIODS = [
  { key: 'd7', label: '7 derniers jours', range: () => ({ since: iso(daysAgo(6)), until: iso(today()) }) },
  { key: 'd28', label: '28 derniers jours', range: () => ({ since: iso(daysAgo(27)), until: iso(today()) }) },
  { key: 'month', label: 'Ce mois-ci', range: () => { const d = today(); return { since: iso(new Date(d.getFullYear(), d.getMonth(), 1)), until: iso(d) }; } },
  { key: 'last_month', label: 'Mois dernier', range: () => { const d = today(); return { since: iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), until: iso(new Date(d.getFullYear(), d.getMonth(), 0)) }; } },
  { key: 'm3', label: '3 derniers mois', range: () => ({ since: iso(daysAgo(89)), until: iso(today()) }) },
  { key: 'custom', label: 'Personnalisé', range: null },
];

export const PORTFOLIOS = [
  { key: 'all', label: 'Les deux portefeuilles' },
  { key: 'owner_technology', label: 'Owner Technology' },
  { key: 'portefeuille2', label: 'Portefeuille 2' },
];

export function Chip({ T, active, onClick, children, icon }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: T.radiusPill, cursor: 'pointer',
        border: `1px solid ${active ? T.accentSoft : T.border}`, background: active ? T.accentBg : T.surface, color: active ? T.primaryStrong : T.textMuted,
        fontSize: 13, fontWeight: 500, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'background 0.12s, border-color 0.12s' }}>
      {icon && <Pict name={icon} size={14} />}{children}
    </button>
  );
}

export default function Filters({ T, periodKey, range, onPeriod, portfolio, onPortfolio }) {
  const [draft, setDraft] = useState({ since: range.since, until: range.until });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.textFaint, marginRight: 2 }}><Pict name="calendar" size={14} /></span>
      {PERIODS.map((p) => (
        <Chip key={p.key} T={T} active={periodKey === p.key} onClick={() => onPeriod(p.key, p.range ? p.range() : draft)}>{p.label}</Chip>
      ))}
      {periodKey === 'custom' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          {['since', 'until'].map((k) => (
            <input key={k} type="date" value={draft[k]} max={iso(today())} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
              onBlur={() => { if (draft.since && draft.until && draft.since <= draft.until) onPeriod('custom', draft); }}
              style={{ height: 32, padding: '0 10px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, fontFamily: 'inherit' }} />
          ))}
        </span>
      )}
      <span style={{ width: 1, height: 22, background: T.border, margin: '0 6px' }} />
      {PORTFOLIOS.map((p) => (
        <Chip key={p.key} T={T} active={portfolio === p.key} onClick={() => onPortfolio(p.key)} icon={p.key === 'all' ? 'portfolio' : undefined}>{p.label}</Chip>
      ))}
    </div>
  );
}
