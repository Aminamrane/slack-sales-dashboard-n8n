import React from 'react';
import Card from './Card';
import { fmtInt, fmtParisTime } from '../theme';
import { useCampaignPolling } from '../hooks';

// Hard-coded metadata per nurture kind, indexed by cohort (webinarId). Matches
// the landing's labels — kept here so the dashboard remains accurate even if the
// backend reorders the rows. If new kinds are added backend-side, the row will
// simply render with the raw kind as fallback. When a new cohort gets a sequence
// deployed landing-side, add its label set here keyed by webinarId.
const LABELS_BY_COHORT = {
  'webinar-2026-05-26': {
    email_post_missed_no_rdv:        { day: 'Mar 26/05 16h17', subject: 'Vous avez raté quelque chose…' },
    email_post_missed_no_rdv_d2:     { day: 'Mer 27/05 10h00', subject: 'La majorité des dirigeants pensent être déjà optimisés' },
    email_post_missed_no_rdv_d3:     { day: 'Jeu 28/05 10h00', subject: 'Combien vous coûte votre entreprise ?' },
    email_post_missed_no_rdv_d4:     { day: 'Ven 29/05 10h00', subject: 'Dernière relance (lien /rdv)' },
    email_post_attended_no_rdv:      { day: 'Mar 26/05 17h00', subject: 'Merci d\'avoir participé au webinaire.' },
    email_post_attended_no_rdv_d2:   { day: 'Mer 27/05 10h00', subject: '+12 500 € : ce chiffre revient souvent' },
    email_post_attended_no_rdv_d3:   { day: 'Jeu 28/05 10h00', subject: 'Dirigeants d\'entreprises : comment mieux vous rémunérer ?' },
    email_post_attended_no_rdv_d4:   { day: 'Ven 29/05 10h00', subject: 'Dernière relance (lien /rdv)' },
  },
  'webinar-2026-06-22': {
    email_post_missed_no_rdv:        { day: '23/06',       subject: 'Vous avez raté quelque chose…' },
    email_post_missed_no_rdv_d2:     { day: '24/06 · 10h', subject: 'La plupart des dirigeants se croient déjà optimisés' },
    email_post_missed_no_rdv_d3:     { day: '25/06 · 10h', subject: 'Combien votre entreprise vous coûte vraiment ?' },
    email_post_missed_no_rdv_d4:     { day: '26/06 · 10h', subject: 'Dernière relance' },
    email_post_attended_no_rdv:      { day: '23/06',       subject: 'Merci d\'avoir participé au webinaire' },
    email_post_attended_no_rdv_d2:   { day: '24/06 · 10h', subject: '+12 500€ : ce chiffre revient souvent' },
    email_post_attended_no_rdv_d3:   { day: '25/06 · 10h', subject: 'Vous développez votre activité… mais en profitez-vous ?' },
    email_post_attended_no_rdv_d4:   { day: '26/06 · 10h', subject: 'Dernière relance' },
  },
  // 21 septembre (TPE/PME) : une seule séquence J+1 → J+4 pour les inscrits,
  // sans découpage présents / absents (kinds email_post21_*).
  'webinar-2026-09-21': {
    email_post21_j1: { day: 'Mar 22/09 · 11h', subject: 'Payez-vous trop de charges ? Voici comment le savoir' },
    email_post21_j2: { day: 'Mer 23/09 · 11h', subject: '3 façons de garantir que vous perdez de l\'argent' },
    email_post21_j3: { day: 'Jeu 24/09 · 11h', subject: 'Combien votre entreprise sort pour vous payer ?' },
    email_post21_j4: { day: 'Ven 25/09 · 11h', subject: 'Dernier mail sur le sujet' },
  },
};

// Cohorte sans jeu d'étiquettes (20/07, 07/09…) : le sujet retombe sur le kind
// brut et la date sur l'horodatage réel renvoyé par la landing. Surtout pas les
// étiquettes d'une autre cohorte, qui afficheraient de fausses dates.
const FALLBACK_LABELS = {};

const segment = (kind) => {
  if (kind.includes('attended')) return 'attended';
  if (kind.includes('missed')) return 'missed';
  return 'all';
};
const SEGMENT_BADGE = {
  attended: { label: 'Présents', tone: 'emerald' },
  missed: { label: 'Pas venus', tone: 'amber' },
  all: { label: 'Inscrits', tone: 'blue' },
};

/**
 * Nurture campaign : emails programmés dans les jours qui suivent le live,
 * par segment ("missed" = pas venus, "attended" = présents, ou une séquence
 * unique pour tous les inscrits). Rendered as a clean table with segment
 * badges + sent/pending/opens/clics columns.
 *
 * Polls every 30s like the broad campaign.
 */
export default function NurtureTable({ webinarId, C }) {
  const endpoint = `/api/v1/marketing/webinars/${webinarId}/campaigns/post-nurture`;
  const { data, loading, error } = useCampaignPolling(endpoint, 30000);
  const labels = LABELS_BY_COHORT[webinarId] || FALLBACK_LABELS;

  if (loading && !data) {
    return (
      <Card
        title="Relances post-webinaire · séquence 4 jours"
        subtitle="Emails programmés après le live, par segment"
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

  // Une cohorte n'affiche que les emails qu'elle a réellement programmés :
  // un kind sans ligne ni étiquette pour cette cohorte n'apparaît pas.
  const rows = (data?.rows || []).filter((r) => r.total > 0 || labels[r.kind]);
  const grandSent = rows.reduce((s, r) => s + r.sent, 0);
  const grandPending = rows.reduce((s, r) => s + r.pending, 0);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  if (rows.length === 0) {
    return (
      <Card
        title="Relances post-webinaire · séquence 4 jours"
        subtitle="Aucun email post-webinaire remonté pour cette cohorte"
        C={C}
      >
        <div style={{ padding: '14px 0', fontSize: 13, color: C.muted }}>
          La landing n&apos;a renvoyé aucune ligne de séquence post-webinaire pour cette cohorte.
        </div>
      </Card>
    );
  }

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
      subtitle={`${fmtInt(grandSent)} envoyés · ${fmtInt(grandPending)} en attente · ${fmtInt(grandTotal)} total sur ${rows.length} emails programmés`}
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
              const meta = labels[r.kind];
              const badge = SEGMENT_BADGE[segment(r.kind)];
              const when = meta?.day || fmtParisTime(r.last_sent || r.first_pending);
              const subject = meta?.subject || r.kind;
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
                      background: C[badge.tone].bg,
                      color: C[badge.tone].fg,
                    }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ ...CELL, fontFamily: 'ui-monospace, SF Mono, Menlo, monospace', fontSize: 11, color: C.muted }}>
                    {when}
                  </td>
                  <td style={{ ...CELL, fontWeight: 500 }}>{subject}</td>
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
