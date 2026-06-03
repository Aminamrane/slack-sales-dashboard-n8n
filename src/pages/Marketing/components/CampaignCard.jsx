import React, { useState } from 'react';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { motion, AnimatePresence } from 'framer-motion';
import Card from './Card';
import { fmtPct, fmtParisTime, fmtInt } from '../theme';
import { useCampaignPolling, isCampaignFinished } from '../hooks';

/**
 * Generic reusable campaign card. Used by PostMissed, Postponement, Broad —
 * all 3 share the same shape (progress bar + KPI tiles + sentByHour mini-chart).
 *
 * The Broad campaign card injects an extra "Inscrits via /broad" tile and a
 * conversion rate, supplied via `extraTiles` prop.
 *
 * Polling interval is configurable per kind (PostMissed/Postponement = 15s,
 * Broad/Nurture = 30s).
 */
export default function CampaignCard({
  webinarId,
  kind,
  title,
  subtitle,
  intervalMs = 15000,
  progressColor,
  C,
  extraTiles = null,
  // Liste des tiles d'engagement à NE PAS afficher. Utilisé pour Broad
  // cold outreach qui n'a pas de tracking ouverture/clic Resend (templates
  // sans pixel) — on garde uniquement "Délivrés" + tiles métier via
  // extraTiles (broadSignups). Valeurs possibles : 'opened', 'clicked',
  // 'bounced', 'complained', 'delivered'.
  excludeTiles = [],
  // Masque le mini bar chart "Envois par heure". Pertinent pour les
  // campagnes one-shot massives (Broad cold outreach) où le drain
  // heure-par-heure ne donne pas d'info exploitable.
  hideSentByHour = false,
}) {
  const endpoint = `/api/v1/marketing/webinars/${webinarId}/campaigns/${kind}`;
  const { data, loading, error } = useCampaignPolling(endpoint, intervalMs);
  const [forcedCollapsed, setForcedCollapsed] = useState(null);

  // ── EMPTY / LOADING / ERROR STATES ───────────────────────────────
  if (loading && !data) {
    return (
      <Card title={title} subtitle={subtitle} C={C}>
        <div style={{
          height: 80,
          borderRadius: 12,
          background: C.subtle,
          animation: 'mktPulse 1.4s ease-in-out infinite',
        }} />
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card title={title} subtitle={subtitle} C={C}>
        <div style={{
          padding: 14,
          borderRadius: 12,
          background: C.rose.bg,
          color: C.rose.fg,
          fontSize: 13,
          fontWeight: 600,
        }}>
          Données indisponibles{error ? ` — ${error}` : ''}.
        </div>
      </Card>
    );
  }
  if (data.total === 0) {
    return (
      <Card title={title} subtitle={subtitle} C={C}>
        <p style={{ margin: 0, color: C.muted, fontSize: 13, fontWeight: 500 }}>
          Aucun outbox row pour cette campagne. Le backfill n&apos;a pas
          encore été lancé.
        </p>
      </Card>
    );
  }

  // ── DATA UNPACK ──────────────────────────────────────────────────
  const finished = isCampaignFinished(data);
  const isCollapsed = forcedCollapsed ?? finished;
  const pct = data.rates?.progressPct ?? 0;
  const sent = data.counts?.sent ?? 0;
  const pending = data.counts?.pending ?? 0;
  const failed = data.counts?.failed ?? 0;
  const sending = data.counts?.sending ?? 0;

  const HeaderAction = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {finished && (
        <span style={{
          padding: '4px 10px',
          background: C.emerald.bg,
          color: C.emerald.fg,
          borderRadius: 50,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Terminée
        </span>
      )}
      <button
        type="button"
        onClick={() => setForcedCollapsed(!isCollapsed)}
        style={{
          padding: '6px 10px',
          background: 'transparent',
          color: C.muted,
          border: `1px solid ${C.hairline}`,
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {isCollapsed ? 'Voir détails' : 'Réduire'} {isCollapsed ? '▸' : '▾'}
      </button>
    </div>
  );

  return (
    <Card
      title={title}
      subtitle={excludeTiles.includes('opened')
        ? `${fmtInt(sent)} / ${fmtInt(data.total)} envoyés`
        : `${fmtInt(sent)} / ${fmtInt(data.total)} envoyés · ${fmtInt(data.engagement?.opened ?? 0)} ouvertures`}
      C={C}
      action={HeaderAction}
      noPadding
    >
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: 24 }}>
              <RefreshBadge intervalMs={intervalMs} C={C} />

              {/* Progress bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtInt(sent)} / {fmtInt(data.total)} envoyés
                  </span>
                  <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>
                    {fmtPct(pct)}
                  </span>
                </div>
                <div style={{
                  height: 10,
                  width: '100%',
                  background: C.subtle,
                  borderRadius: 50,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(pct, 100)}%`,
                    height: '100%',
                    background: progressColor,
                    borderRadius: 50,
                    transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)',
                  }} />
                </div>
                <div style={{
                  marginTop: 10,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 16,
                  fontSize: 12,
                  color: C.muted,
                }}>
                  <span>
                    En attente : <strong style={{ color: C.text }}>{fmtInt(pending)}</strong>
                  </span>
                  {sending > 0 && (
                    <span>
                      En cours : <strong style={{ color: C.amber.fg }}>{fmtInt(sending)}</strong>
                    </span>
                  )}
                  <span>
                    Échec : <strong style={{ color: failed > 0 ? C.rose.fg : C.text }}>{fmtInt(failed)}</strong>
                  </span>
                  {data.timing?.lastScheduledAt && pending > 0 && (
                    <span>
                      Dernier envoi prévu vers{' '}
                      <strong style={{ color: C.text }}>{fmtParisTime(data.timing.lastScheduledAt)}</strong>
                    </span>
                  )}
                  {pending === 0 && sending === 0 && data.timing?.lastSentAt && (
                    <span style={{ color: C.emerald.fg, fontWeight: 600 }}>
                      ✓ Tous envoyés à {fmtParisTime(data.timing.lastSentAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* Engagement tiles */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 12,
              }}>
                {!excludeTiles.includes('delivered') && (
                  <Tile label="Délivrés" value={data.engagement?.delivered ?? 0} sub={fmtPct(data.rates?.deliveryRatePct)} C={C} />
                )}
                {!excludeTiles.includes('opened') && (
                  <Tile label="Ouverts" value={data.engagement?.opened ?? 0} sub={fmtPct(data.rates?.openRatePct)} highlight C={C} />
                )}
                {!excludeTiles.includes('clicked') && (
                  <Tile label="Cliqués" value={data.engagement?.clicked ?? 0} sub={fmtPct(data.rates?.clickRatePct)} C={C} />
                )}
                {!excludeTiles.includes('bounced') && (
                  <Tile label="Bounce" value={data.engagement?.bounced ?? 0} sub={null} tone={data.engagement?.bounced > 0 ? 'warn' : null} C={C} />
                )}
                {!excludeTiles.includes('complained') && (
                  <Tile label="Plaintes" value={data.engagement?.complained ?? 0} sub={null} tone={data.engagement?.complained > 0 ? 'warn' : null} C={C} />
                )}
                {extraTiles && extraTiles(data, C)}
              </div>

              {/* Sent by hour mini bar chart */}
              {!hideSentByHour && Array.isArray(data.sentByHour) && data.sentByHour.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.faded,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 10,
                  }}>
                    Envois par heure (Europe/Paris)
                  </div>
                  <SentByHourTable rows={data.sentByHour} sent={sent} barColor={progressColor} C={C} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function RefreshBadge({ intervalMs, C }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6,
      fontSize: 11,
      color: C.faded,
      fontWeight: 500,
      marginBottom: 12,
    }}>
      <span style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        background: C.emerald.strong,
        borderRadius: '50%',
        animation: 'mktPulse 1.8s ease-in-out infinite',
      }} />
      Live · {Math.round(intervalMs / 1000)}s
    </div>
  );
}

function Tile({ label, value, sub, highlight, tone, C }) {
  const color = tone === 'warn' ? C.amber.fg : highlight ? C.emerald.fg : C.text;
  return (
    <div style={{
      background: C.subtle,
      borderRadius: 12,
      padding: '12px 14px',
      border: `1px solid ${C.hairline}`,
    }}>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        color: C.faded,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {label}
      </div>
      <div style={{
        marginTop: 6,
        fontSize: 22,
        fontWeight: 700,
        color,
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {fmtInt(value)}
      </div>
      {sub && (
        <div style={{
          marginTop: 4,
          fontSize: 11,
          color: C.muted,
          fontWeight: 500,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SentByHourTable({ rows, sent, barColor, C }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((row) => {
        const ratio = sent > 0 ? (row.count / sent) * 100 : 0;
        return (
          <div key={row.hour} style={{
            display: 'grid',
            gridTemplateColumns: '80px 60px 1fr',
            alignItems: 'center',
            gap: 12,
            padding: '6px 4px',
          }}>
            <span style={{ fontSize: 12, fontFamily: 'ui-monospace, SF Mono, Menlo, monospace', color: C.muted }}>
              {row.hour}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
              {fmtInt(row.count)}
            </span>
            <div style={{ height: 6, background: C.subtle, borderRadius: 50, overflow: 'hidden' }}>
              <div style={{
                width: `${ratio}%`,
                height: '100%',
                background: barColor,
                borderRadius: 50,
                transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
