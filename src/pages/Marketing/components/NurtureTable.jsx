import React from 'react';
import Card from './Card';
import { fmtInt } from '../theme';
import { useCampaignPolling } from '../hooks';

// Hard-coded metadata per nurture kind. Matches the landing's labels —
// kept here so the dashboard remains accurate even if the backend
// reorders the rows. If new kinds are added backend-side, the row
// will simply render with the raw kind as fallback.
const LABELS = {
  email_post_missed_no_rdv:        { day: 'Mar 26/05 16h17', subject: 'Vous avez raté quelque chose…' },
  email_post_missed_no_rdv_d2:     { day: 'Mer 27/05 10h00', subject: 'La majorité des dirigeants pensent être déjà optimisés' },
  email_post_missed_no_rdv_d3:     { day: 'Jeu 28/05 10h00', subject: 'Combien vous coûte votre entreprise ?' },
  email_post_missed_no_rdv_d4:     { day: 'Ven 29/05 10h00', subject: 'Dernière relance (lien /rdv)' },
  email_post_attended_no_rdv:      { day: 'Mar 26/05 17h00', subject: 'Merci d\'avoir participé au webinaire.' },
  email_post_attended_no_rdv_d2:   { day: 'Mer 27/05 10h00', subject: '+12 500 € : ce chiffre revient souvent' },
  email_post_attended_no_rdv_d3:   { day: 'Jeu 28/05 10h00', subject: 'Dirigeants d\'entreprises : comment mieux vous rémunérer ?' },
  email_post_attended_no_rdv_d4:   { day: 'Ven 29/05 10h00', subject: 'Dernière relance (lien /rdv)' },
};

const segment = (kind) => (kind.includes('attended') ? 'attended' : 'missed');

/**
 * Nurture campaign : 8 emails over 4 days, split between "missed" (pas
 * venus) and "attended" (présents) segments. Rendered as a clean table
 * with segment badges + sent/pending/opens/clics columns.
 *
 * Polls every 30s like the broad campaign.
 */
export default function NurtureTable({ webinarId, C }) {
  const endpoint = `/api/v1/marketing/webinars/${webinarId}/campaigns/post-nurture`;
  const { data, loading, error } = useCampaignPolling(endpoint, 30000);

  if (loading && !data) {
    return (
      <Card
        title="Relances post-webinaire · séquence 4 jours"
        subtitle="8 emails programmés sur 2 segments (pas venus + présents)"
        C={C}
      >
        <div style={{
          height: 160,
          borderRadius: 12,
          background: C.subtle,
          animation: 'mktPulse 1.4s ease-in-out infinite',
        }} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        title="Relances post-webinaire · séquence 4 jours"
        subtitle="Post-nurture"
        C={C}
      >
        <div style={{
          padding: 14,
          borderRadius: 12,
          background: C.rose.bg,
          color: C.rose.fg,
          fontSize: 13,
          fontWeight: 600,
        }}>
          Données indisponibles — {error}
        </div>
      </Card>
    );
  }

  const rows = data?.rows || [];
  const grandSent = rows.reduce((s, r) => s + r.sent, 0);
  const grandPending = rows.reduce((s, r) => s + r.pending, 0);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  const HEADER_CELL = {
    padding: '14px 16px',
    fontSize: 10,
    fontWeight: 700,
    color: C.faded,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    textAlign: 'left',
    background: C.subtle,
    borderBottom: `1px solid ${C.hairline}`,
    whiteSpace: 'nowrap',
  };
  const CELL = {
    padding: '14px 16px',
    fontSize: 13,
    color: C.text,
    fontVariantNumeric: 'tabular-nums',
    borderTop: `1px solid ${C.hairline}`,
  };

  return (
    <Card
      title="Relances post-webinaire · séquence 4 jours"
      subtitle={`${fmtInt(grandSent)} envoyés · ${fmtInt(grandPending)} en attente · ${fmtInt(grandTotal)} total sur 8 emails programmés`}
      C={C}
      noPadding
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={HEADER_CELL}>Segment</th>
              <th style={HEADER_CELL}>Quand</th>
              <th style={HEADER_CELL}>Sujet</th>
              <th style={{ ...HEADER_CELL, textAlign: 'right' }}>Envoyés</th>
              <th style={{ ...HEADER_CELL, textAlign: 'right' }}>En attente</th>
              <th style={{ ...HEADER_CELL, textAlign: 'right' }}>Ouvertures</th>
              <th style={{ ...HEADER_CELL, textAlign: 'right' }}>Clics</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = LABELS[r.kind] || { day: '—', subject: r.kind };
              const seg = segment(r.kind);
              const openRate = r.sent > 0 ? Math.round((r.opened / r.sent) * 100) : null;
              return (
                <tr key={r.kind}>
                  <td style={CELL}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 9px',
                      borderRadius: 50,
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      background: seg === 'missed' ? C.amber.bg : C.emerald.bg,
                      color: seg === 'missed' ? C.amber.fg : C.emerald.fg,
                    }}>
                      {seg === 'missed' ? 'Pas venus' : 'Présents'}
                    </span>
                  </td>
                  <td style={{ ...CELL, fontFamily: 'ui-monospace, SF Mono, Menlo, monospace', fontSize: 11, color: C.muted }}>
                    {meta.day}
                  </td>
                  <td style={{ ...CELL, fontWeight: 500 }}>{meta.subject}</td>
                  <td style={{ ...CELL, textAlign: 'right', color: C.emerald.fg, fontWeight: 700 }}>
                    {fmtInt(r.sent)}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', color: C.muted }}>{fmtInt(r.pending)}</td>
                  <td style={{ ...CELL, textAlign: 'right' }}>
                    <span style={{ color: C.text, fontWeight: 600 }}>{fmtInt(r.opened)}</span>
                    {openRate !== null && (
                      <span style={{ marginLeft: 6, color: C.faded, fontSize: 11 }}>
                        ({openRate}%)
                      </span>
                    )}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right', color: C.text, fontWeight: 600 }}>
                    {fmtInt(r.clicked)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{
        padding: '10px 16px',
        textAlign: 'right',
        fontSize: 11,
        color: C.faded,
        borderTop: `1px solid ${C.hairline}`,
      }}>
        Live · 30s
      </div>
    </Card>
  );
}
