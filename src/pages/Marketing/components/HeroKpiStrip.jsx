import React from 'react';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { motion } from 'framer-motion';
import { fmtInt, fmtEur, fmtPct, fmtDuration } from '../theme';

/**
 * Top of the page : one large gradient-violet HERO card (ref image 5
 * "99% Data Accuracy" style) sitting next to a strip of small white
 * KPI tiles (ref image 2 "All Orders / Order Created" style).
 *
 * The hero shows : webinar title + headline number (Inscrits DB) + caption.
 * The strip shows : 9 small KPI tiles, each with label, large tabular
 * number, and an optional hint or trend pill.
 */

function HeroCard({ webinar, summary, realtimeLeads, C }) {
  const leadsDb = summary?.leadsDb ?? 0;
  const signedCount = realtimeLeads?.signed ?? 0;
  const signedPct = leadsDb > 0 ? (signedCount / leadsDb) * 100 : null;
  // Subtle aurora / glow inside the violet card — purely visual, ref image 5
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: C.heroViolet,
        borderRadius: 24,
        padding: '32px 36px',
        color: '#fff',
        boxShadow: C.shadow,
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Aurora highlight (ref-image-5 style — soft top-right glow) */}
      <div style={{
        position: 'absolute',
        top: -80,
        right: -60,
        width: 280,
        height: 280,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 70%)',
        pointerEvents: 'none',
      }} />
      {/* Bottom-left subtle glow */}
      <div style={{
        position: 'absolute',
        bottom: -120,
        left: -40,
        width: 260,
        height: 260,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: 'rgba(255,255,255,0.18)',
          borderRadius: 50,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 8px rgba(255,255,255,0.8)',
          }} />
          {webinar?.source || 'Landing webinaire'}
        </div>
        <h1 style={{
          margin: '14px 0 0',
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: '-0.025em',
          lineHeight: 1.1,
        }}>
          {webinar?.title || 'Webinaire'}
        </h1>
        <p style={{
          margin: '6px 0 0',
          fontSize: 13,
          color: 'rgba(255,255,255,0.78)',
          fontWeight: 500,
        }}>
          Performance landing & pipeline prospects
        </p>
      </div>

      {/* Bloc bottom : grand chiffre en haut + pills en colonne en dessous.
          Ancien layout (chiffre + pills côte à côte) cassait les pills sur 2
          lignes dans la grille 3 colonnes. Le stack vertical respire mieux. */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            fontVariantNumeric: 'tabular-nums',
            animation: 'mktNumberTick 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            {fmtInt(leadsDb)}
          </div>
          <div style={{
            marginTop: 4,
            fontSize: 12,
            color: 'rgba(255,255,255,0.85)',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}>
            Inscrits totaux (DB)
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {signedPct !== null && (
            <HeroPill>
              {fmtInt(signedCount)} signés ({fmtPct(signedPct)})
            </HeroPill>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Petite pastille blanche translucide pour le hero violet — taille
 *  ajustée pour qu'elles tiennent en ligne dans la grille 3-colonnes. */
function HeroPill({ children }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '5px 11px',
      background: 'rgba(255,255,255,0.16)',
      borderRadius: 50,
      fontSize: 12,
      fontWeight: 700,
      backdropFilter: 'blur(8px)',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

/** Small white KPI tile. Tone changes the value color when highlighted. */
function KpiTile({ label, value, hint, tone, C, delay = 0, compact = false }) {
  const valueColor = tone === 'emerald' ? C.emerald.fg
    : tone === 'amber' ? C.amber.fg
    : tone === 'rose' ? C.rose.fg
    : C.text;
  const borderColor = tone === 'emerald' ? C.emerald.bg
    : tone === 'amber' ? C.amber.bg
    : tone === 'rose' ? C.rose.bg
    : C.hairline;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: C.surface,
        borderRadius: compact ? 12 : 16,
        padding: compact ? '12px 14px' : '18px 20px',
        boxShadow: C.shadow,
        border: `1px solid ${borderColor}`,
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        cursor: 'default',
      }}
      whileHover={{ y: -2 }}
    >
      <div style={{
        fontSize: compact ? 9 : 10,
        fontWeight: 700,
        color: C.faded,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        lineHeight: 1.2,
      }}>
        {label}
      </div>
      <div style={{
        marginTop: compact ? 6 : 8,
        fontSize: compact ? 20 : 26,
        fontWeight: 700,
        color: valueColor,
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {value}
      </div>
      {hint && (
        <div style={{
          marginTop: compact ? 4 : 6,
          fontSize: compact ? 10 : 11,
          color: C.muted,
          fontWeight: 500,
          lineHeight: 1.3,
        }}>
          {hint}
        </div>
      )}
    </motion.div>
  );
}

export default function HeroKpiStrip({ webinar, summary, realtimeLeads, rankingPanel, C, loading }) {
  if (!summary) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 2fr', gap: 16 }}>
        <div style={{ height: 220, borderRadius: 24, background: C.subtle, animation: 'mktPulse 1.4s ease-in-out infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{ height: 96, borderRadius: 16, background: C.subtle, animation: 'mktPulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  const tiles = [
    {
      label: 'Présents au live',
      value: realtimeLeads?.live_attendees !== undefined
        ? fmtInt(realtimeLeads.live_attendees)
        : '—',
      hint: (realtimeLeads?.live_attendees > 0 && summary.leadsDb > 0)
        ? `${fmtPct((realtimeLeads.live_attendees / summary.leadsDb) * 100)} des inscrits · clic sur lien Zoom`
        : 'Cliquent sur leur lien unique Zoom',
      tone: realtimeLeads?.live_attendees > 0 ? 'emerald' : undefined,
    },
    {
      label: 'Rendez-vous pris',
      value: realtimeLeads?.rdv_taken !== undefined
        ? fmtInt(realtimeLeads.rdv_taken)
        : '—',
      hint: realtimeLeads?.total_leads
        ? `${fmtPct((realtimeLeads.rdv_taken / realtimeLeads.total_leads) * 100)} des inscrits`
        : 'Leads avec R2 planifié',
      tone: realtimeLeads?.rdv_taken > 0 ? 'emerald' : undefined,
    },
    {
      label: 'Prospects 4+ salariés',
      value: fmtInt(summary.leadsLargeCompany),
      hint: summary.leadsDb > 0
        ? `${fmtPct((summary.leadsLargeCompany / summary.leadsDb) * 100)} des inscrits`
        : undefined,
      tone: summary.leadsLargeCompany > 0 ? 'emerald' : undefined,
    },
    {
      label: 'Taux conversion LP',
      value: fmtPct(summary.conversionPct),
      hint: 'Inscrits landing ÷ Visiteurs (hors Meta/Broad)',
      tone: summary.conversionPct >= 10 ? 'emerald' : undefined,
    },
    {
      label: 'Budget engagé',
      value: fmtEur(summary.budgetEur),
    },
    {
      label: 'Coût par lead',
      value: fmtEur(summary.cplEur, { decimals: 2 }),
      hint: 'Budget ÷ Inscrits',
    },
    {
      label: "Taux d'ouverture",
      value: fmtPct(summary.globalOpenRatePct),
      hint: summary.globalClickRatePct !== null && summary.globalClickRatePct !== undefined
        ? `${fmtPct(summary.globalClickRatePct)} de clic`
        : 'Tous emails confondus',
      tone: summary.globalOpenRatePct >= 30 ? 'emerald' : undefined,
    },
    {
      label: 'Durée moy. visite',
      value: fmtDuration(summary.visitDurationSeconds),
      hint: summary.bounceRatePct !== null && summary.bounceRatePct !== undefined
        ? `${fmtPct(summary.bounceRatePct)} de rebond`
        : undefined,
    },
  ];

  // Layout 3 colonnes si rankingPanel fourni : [Hero | Ranking | Tiles].
  // Fallback 2 colonnes [Hero | Tiles] sinon (rétro-compat).
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: rankingPanel
        ? 'minmax(280px, 1fr) minmax(280px, 1.2fr) minmax(360px, 1.6fr)'
        : 'minmax(320px, 1.2fr) 2.4fr',
      gap: 16,
      alignItems: 'stretch',
    }}>
      <HeroCard webinar={webinar} summary={summary} realtimeLeads={realtimeLeads} C={C} />
      {rankingPanel}
      <div style={{
        display: 'grid',
        // 2 colonnes plus compactes quand on partage la largeur avec le ranking.
        gridTemplateColumns: rankingPanel ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: 10,
        opacity: loading ? 0.7 : 1,
        transition: 'opacity 0.25s ease',
        alignContent: 'start',
      }}>
        {tiles.map((t, i) => (
          <KpiTile key={t.label} {...t} C={C} delay={i * 0.04} compact={!!rankingPanel} />
        ))}
      </div>
    </div>
  );
}
