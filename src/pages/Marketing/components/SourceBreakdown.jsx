import React from 'react';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { motion } from 'framer-motion';
import { fmtInt, fmtPct } from '../theme';

/**
 * Three side-by-side coloured cards (blue/fuchsia/amber) showing inscrits
 * split by acquisition source — Landing, Meta Ads, Broad. Mirror of the
 * landing's SourceBreakdownCards but adapted to the light-mode palette
 * and softer card style of refs (rounded 16px, pill upper-right).
 */
export default function SourceBreakdown({ summary, C }) {
  if (!summary) return null;
  const bySrc = summary.leadsBySource || { landing: 0, meta: 0, broad: 0 };
  const total = (bySrc.landing || 0) + (bySrc.meta || 0) + (bySrc.broad || 0);
  const share = (n) => total > 0 ? (n / total) * 100 : null;

  const cards = [
    {
      key: 'landing',
      title: 'Landing',
      value: bySrc.landing || 0,
      pct: share(bySrc.landing || 0),
      tag: 'webinaire.ownertechnology.com',
      sub: `${fmtInt(summary.visitors)} visiteurs uniques`,
      tone: C.blue,
    },
    {
      key: 'meta',
      title: 'Meta Ads',
      value: bySrc.meta || 0,
      pct: share(bySrc.meta || 0),
      tag: 'Lead Form → n8n',
      sub: 'Ingestion webhook',
      tone: C.fuchsia,
    },
    {
      key: 'broad',
      title: 'Broad',
      value: bySrc.broad || 0,
      pct: share(bySrc.broad || 0),
      tag: '/broad · cold outreach',
      sub: 'Anciens prospects relancés',
      tone: C.amber,
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16,
    }}>
      {cards.map((card, i) => (
        <motion.div
          key={card.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -2 }}
          style={{
            background: card.tone.bg,
            borderRadius: 18,
            padding: '20px 22px',
            border: `1px solid ${card.tone.bg}`,
            boxShadow: C.shadow,
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: card.tone.fg,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {card.title}
            </span>
            <span style={{
              padding: '3px 9px',
              borderRadius: 50,
              background: card.tone.strong + '22',
              color: card.tone.fg,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              {card.tag}
            </span>
          </div>
          <div style={{
            fontSize: 36,
            fontWeight: 700,
            color: card.tone.fg,
            letterSpacing: '-0.025em',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}>
            {fmtInt(card.value)}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: C.muted, fontWeight: 500 }}>
            {fmtPct(card.pct)} des inscrits · {card.sub}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
