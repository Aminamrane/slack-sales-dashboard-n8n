import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import Card from './Card';
import { fmtInt, fmtPct } from '../theme';

/**
 * Classement sales sur les leads issus d'un webinaire spécifique.
 * Source : endpoint `/api/v1/marketing/webinars/{id}/realtime-leads` →
 * `by_assignee[]` déjà trié desc par closing_rate_pct puis assigned côté
 * backend. On surface en table SaaS premium avec avatars colorés stables
 * (hash sur email), pills closing %.
 *
 * Granularité par sales : leads attribués / signés / taux closing %.
 * Le taux closing dépend très fortement du volume attribué — d'où la
 * colonne "Leads attribués" mise en avant pour contextualiser le %.
 */
function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || name.slice(0, 2).toUpperCase();
}

function hashColor(seed, palette) {
  if (!seed) return palette[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function closingBadgeColor(rate, C) {
  if (rate >= 30) return { bg: C.emerald.bg, fg: C.emerald.fg, bar: C.emerald.strong };
  if (rate >= 15) return { bg: C.amber.bg, fg: C.amber.fg, bar: C.amber.strong };
  if (rate > 0)   return { bg: C.blue.bg,    fg: C.blue.fg,    bar: C.blue.strong };
  return { bg: C.subtle, fg: C.muted, bar: C.faded };
}

export default function SalesWebinarRanking({ data, C }) {
  const rows = useMemo(() => data?.by_assignee || [], [data]);
  const totals = useMemo(() => {
    const totalAssigned = rows.reduce((s, r) => s + (r.assigned || 0), 0);
    const totalSigned = rows.reduce((s, r) => s + (r.signed || 0), 0);
    return {
      totalAssigned,
      totalSigned,
      globalClosing: totalAssigned > 0 ? (totalSigned / totalAssigned) * 100 : 0,
    };
  }, [rows]);

  const avatarPalette = [C.blue.strong, C.emerald.strong, C.fuchsia.strong, C.amber.strong, C.violet.strong, C.rose?.strong || C.amber.strong];

  if (!data) {
    return (
      <Card
        title="Classement sales webinaire"
        subtitle="Performance des commerciaux sur les leads issus du webinaire"
        C={C}
      >
        <div style={{ height: 180, borderRadius: 12, background: C.subtle, animation: 'mktPulse 1.4s ease-in-out infinite' }} />
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card
        title="Classement sales webinaire"
        subtitle="Performance des commerciaux sur les leads issus du webinaire"
        C={C}
      >
        <div style={{ padding: '32px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>
          Aucun lead webinaire trouvé pour cette période.
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Classement sales webinaire"
      subtitle={`${fmtInt(totals.totalAssigned)} leads attribués · ${fmtInt(totals.totalSigned)} signés · taux global ${fmtPct(totals.globalClosing)}`}
      C={C}
      noPadding
    >
      <div style={{ overflow: 'hidden', borderRadius: 'inherit' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 1.4fr) 140px 100px 1.2fr',
          gap: 12,
          padding: '14px 22px',
          borderBottom: `1px solid ${C.hairline}`,
          background: C.subtle,
          fontSize: 10,
          fontWeight: 700,
          color: C.faded,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          <div>Commercial</div>
          <div style={{ textAlign: 'right' }}>Leads attribués</div>
          <div style={{ textAlign: 'right' }}>Signés</div>
          <div style={{ textAlign: 'right' }}>Taux closing</div>
        </div>

        {/* Rows */}
        {rows.map((row, idx) => {
          const name = row.assignee_name || 'Non assigné';
          const email = row.assignee_email;
          const color = hashColor(email || name, avatarPalette);
          const closingColors = closingBadgeColor(row.closing_rate_pct || 0, C);
          const isPodium = idx < 3 && (row.signed || 0) > 0;
          const rankIcons = ['🥇', '🥈', '🥉'];

          return (
            <motion.div
              key={`${email || 'none'}-${idx}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 1.4fr) 140px 100px 1.2fr',
                gap: 12,
                padding: '14px 22px',
                borderBottom: idx === rows.length - 1 ? 'none' : `1px solid ${C.hairline}`,
                alignItems: 'center',
              }}
            >
              {/* Commercial */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                {row.assignee_avatar_url ? (
                  <img
                    src={row.assignee_avatar_url}
                    alt={name}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      flexShrink: 0,
                      objectFit: 'cover',
                      boxShadow: '0 2px 6px rgba(15,18,30,0.08)',
                      background: C.subtle,
                    }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: email ? color : C.subtle,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    boxShadow: '0 2px 6px rgba(15,18,30,0.08)',
                  }}>
                    {email ? initials(name) : '—'}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 14,
                    fontWeight: 650,
                    color: C.text,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {isPodium && <span style={{ fontSize: 14 }}>{rankIcons[idx]}</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                  </div>
                  {email && (
                    <div style={{
                      fontSize: 11,
                      color: C.muted,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {email}
                    </div>
                  )}
                </div>
              </div>

              {/* Leads attribués */}
              <div style={{
                textAlign: 'right',
                fontSize: 16,
                fontWeight: 700,
                color: C.text,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtInt(row.assigned || 0)}
              </div>

              {/* Signés */}
              <div style={{
                textAlign: 'right',
                fontSize: 16,
                fontWeight: 700,
                color: (row.signed || 0) > 0 ? C.emerald.fg : C.muted,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtInt(row.signed || 0)}
              </div>

              {/* Taux closing avec barre */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                <div style={{
                  flex: 1,
                  maxWidth: 120,
                  height: 6,
                  background: C.subtle,
                  borderRadius: 50,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(row.closing_rate_pct || 0, 100)}%`,
                    height: '100%',
                    background: closingColors.bar,
                    borderRadius: 50,
                    transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)',
                  }} />
                </div>
                <div style={{
                  minWidth: 56,
                  textAlign: 'right',
                  padding: '3px 10px',
                  background: closingColors.bg,
                  color: closingColors.fg,
                  borderRadius: 50,
                  fontSize: 12,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtPct(row.closing_rate_pct || 0)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
