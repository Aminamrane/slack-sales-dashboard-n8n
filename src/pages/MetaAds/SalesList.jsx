// src/pages/MetaAds/SalesList.jsx — les ventes de la période, une par une.
//
// Le total est celui du Suivi des ventes (mêmes déclarations, même fenêtre) :
// la page doit pouvoir être vérifiée vente par vente. Chaque ligne dit d'où
// vient le client (créa Meta, webinaire, cold call…) et à quelle ligne du
// tableau elle a été rattachée pour l'onglet courant.

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const nf = new Intl.NumberFormat('fr-FR');
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const LEVEL_LABEL = { ad: 'Créa', adset: 'Ensemble', campaign: 'Campagne' };

const BUCKETS = [
  { key: 'meta', label: 'rattachées à une créa', short: 'Créa Meta', tone: 'green' },
  { key: 'webinaire', label: 'webinaire', short: 'Webinaire', tone: 'accent' },
  { key: 'hors_meta', label: 'hors Meta', short: 'Hors Meta', tone: 'muted' },
  { key: 'sans_client', label: 'sans client', short: 'Sans client', tone: 'red' },
];

const toneColor = (T, tone) => ({ green: T.green, accent: T.accent, muted: T.textMuted, red: T.red }[tone] || T.textMuted);

/** Chips de synthèse : « 30 rattachées à une créa · 5 webinaire · 10 hors Meta ». */
export function SalesSummaryLine({ sales, T, style }) {
  if (!sales) return null;
  const parts = BUCKETS.filter((b) => sales[b.key] > 0 || b.key === 'meta');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12.5, color: T.textMuted, ...style }}>
      {parts.map((b, i) => (
        <span key={b.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span style={{ color: T.textFaint }}>·</span>}
          <span style={{ width: 7, height: 7, borderRadius: 99, background: toneColor(T, b.tone), flexShrink: 0 }} />
          <strong style={{ color: T.text, fontVariantNumeric: 'tabular-nums' }}>{nf.format(sales[b.key] || 0)}</strong> {b.label}
        </span>
      ))}
    </div>
  );
}

function BucketPill({ bucket, T }) {
  const b = BUCKETS.find((x) => x.key === bucket) || BUCKETS[2];
  const color = toneColor(T, b.tone);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 99, fontSize: 11.5, fontWeight: 600,
      color, background: T.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
      {b.short}
    </span>
  );
}

/**
 * @param sales  bloc `sales` de l'API : { total, meta, webinaire, hors_meta, sans_client, ca, detail: [...] }
 * @param level  onglet courant (ad | adset | campaign) : nomme la colonne « Rattachée à »
 */
export default function SalesList({ sales, level, T }) {
  const [open, setOpen] = useState(true);
  if (!sales) return null;
  const rows = sales.detail || [];
  const th = { textAlign: 'left', padding: '10px 14px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: T.textFaint, whiteSpace: 'nowrap' };
  const td = { padding: '10px 14px', fontSize: 13, color: T.text, whiteSpace: 'nowrap', verticalAlign: 'middle' };

  return (
    <div style={{ marginTop: 18, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.shadow, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 14, padding: '15px 18px', border: 'none', background: 'transparent',
          color: T.text, cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Ventes de la période</span>
            <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, background: T.accentBg, color: T.accent, fontVariantNumeric: 'tabular-nums' }}>
              {nf.format(sales.total || 0)}
            </span>
            <span style={{ fontSize: 12.5, color: T.textFaint }}>{eur.format(sales.ca || 0)} déclarés</span>
          </div>
          <SalesSummaryLine sales={sales} T={T} style={{ marginTop: 8 }} />
        </div>
        <ChevronDown size={17} style={{ color: T.textMuted, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }} />
      </button>

      {open && (
        <div style={{ overflowX: 'auto', borderTop: `1px solid ${T.borderSoft}` }}>
          {rows.length === 0 ? (
            <div style={{ padding: '28px 18px', textAlign: 'center', fontSize: 13.5, color: T.textMuted }}>Aucune vente déclarée sur cette période.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  {['DATE', 'CLIENT', 'N°', 'VENDEUR', 'MONTANT', 'ORIGINE DU LEAD', `${(LEVEL_LABEL[level] || 'Créa').toUpperCase()} RATTACHÉE`, 'FAMILLE'].map((h, i) => (
                    <th key={h} style={{ ...th, textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                    <td style={{ ...td, color: T.textMuted, fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.date)}</td>
                    <td style={{ ...td, fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.client || '—'}</td>
                    <td style={{ ...td, color: T.textMuted }}>{r.numero_client || '—'}</td>
                    <td style={{ ...td, color: T.textMuted }}>{r.seller || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{eur.format(r.amount || 0)}</td>
                    <td style={{ ...td, color: T.textMuted }}>{r.origin || '—'}</td>
                    <td style={{ ...td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.attributed_to ? (
                        <span title={r.on_row === false ? 'Cette créa n’a pas de dépense Meta sur la période affichée' : undefined}>
                          {r.attributed_to}
                          {r.on_row === false && <span style={{ marginLeft: 8, fontSize: 11, color: T.textFaint }}>hors fenêtre Meta</span>}
                        </span>
                      ) : <span style={{ color: T.textFaint }}>—</span>}
                    </td>
                    <td style={td}><BucketPill bucket={r.bucket} T={T} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
