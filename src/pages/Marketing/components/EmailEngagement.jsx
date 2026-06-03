import React from 'react';
import Card from './Card';
import { fmtInt, fmtPct, openRateBarColor, clickRateBarColor } from '../theme';

// Mirror of EMAIL_KIND_LABELS / EMAIL_KIND_ORDER from landing types.ts
// kept local so the frontend is the source of truth here. If new
// kinds are introduced backend-side, just add them — the table falls
// back to the raw kind name on unknown values.
const EMAIL_KIND_LABELS = {
  email_confirmation: 'Confirmation',
  email_marc_story: 'Marc 15k€',
  email_preview_reveal: 'Preview Reveal',
  email_why_concern: 'Pourquoi ça vous concerne',
  email_charges_unknown: 'Charges sociales inconnues',
  email_j_minus_1: 'J-1',
  email_webinar_morning: 'Matin J',
  email_live_now: 'On est en live',
  email_postponement: 'Décalage 26 mai',
  email_broad_invite: 'Invitation Broad',
  email_live_plus_15: 'Live +15 min',
  n8n_webhook: 'n8n webhook',
  meta_capi_lead: 'Meta CAPI',
  wazzap_contact: 'Wazzap contact',
  wazzap_whatsapp_welcome: 'Wazzap welcome',
  wazzap_whatsapp_followup: 'Wazzap follow-up',
  wazzap_whatsapp_day_j: 'Wazzap jour J',
  wazzap_whatsapp_live_plus_15: 'Wazzap Live +15 min',
};

const EMAIL_KIND_ORDER = [
  'email_confirmation',
  'email_postponement',
  'email_broad_invite',
  'email_marc_story',
  'email_preview_reveal',
  'email_why_concern',
  'email_charges_unknown',
  'email_j_minus_1',
  'email_webinar_morning',
  'email_live_now',
  'email_live_plus_15',
];

/**
 * Per-email-kind engagement table. Each row : email name, sent, delivered,
 * opened, clicked, bounce, open rate (number + bar), click rate (number + bar).
 * Bars get colour-coded by rate magnitude (cf. theme.openRateBarColor).
 */
export default function EmailEngagement({ rows = [], C }) {
  const ordered = [...rows].sort((a, b) => {
    const ai = EMAIL_KIND_ORDER.indexOf(a.kind);
    const bi = EMAIL_KIND_ORDER.indexOf(b.kind);
    if (ai === -1 && bi === -1) return a.kind.localeCompare(b.kind);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  if (!rows || rows.length === 0) {
    return (
      <Card
        title="Performance par email de la séquence"
        subtitle="Open rate & click rate par type d'email"
        C={C}
      >
        <p style={{ margin: 0, color: C.muted, fontSize: 13, fontWeight: 500 }}>
          Aucune donnée d&apos;engagement encore. Activez le tracking dans
          le dashboard Resend pour voir les taux d&apos;ouverture et de clic.
        </p>
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
    borderBottom: `1px solid ${C.hairline}`,
    background: C.subtle,
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
      title="Performance par email de la séquence"
      subtitle={`${rows.length} types d'emails trackés`}
      C={C}
      noPadding
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={HEADER_CELL}>Email</th>
              <th style={{ ...HEADER_CELL, textAlign: 'right' }}>Envoyés</th>
              <th style={{ ...HEADER_CELL, textAlign: 'right' }}>Délivrés</th>
              <th style={{ ...HEADER_CELL, textAlign: 'right' }}>Ouverts</th>
              <th style={{ ...HEADER_CELL, textAlign: 'right' }}>Cliqués</th>
              <th style={{ ...HEADER_CELL, textAlign: 'right' }}>Bounce</th>
              <th style={HEADER_CELL}>Open rate</th>
              <th style={HEADER_CELL}>Click rate</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => (
              <tr key={r.kind}>
                <td style={{ ...CELL, fontWeight: 600 }}>
                  {EMAIL_KIND_LABELS[r.kind] ?? r.kind}
                </td>
                <td style={{ ...CELL, textAlign: 'right', color: C.muted }}>{fmtInt(r.sent)}</td>
                <td style={{ ...CELL, textAlign: 'right', color: C.muted }}>{fmtInt(r.delivered)}</td>
                <td style={{ ...CELL, textAlign: 'right', color: C.muted }}>{fmtInt(r.opened)}</td>
                <td style={{ ...CELL, textAlign: 'right', color: C.muted }}>{fmtInt(r.clicked)}</td>
                <td style={{ ...CELL, textAlign: 'right', color: r.bounced > 0 ? C.rose.fg : C.muted, fontWeight: r.bounced > 0 ? 600 : 400 }}>
                  {fmtInt(r.bounced)}
                </td>
                <td style={CELL}>
                  <RateBar pct={r.openRatePct} color={openRateBarColor(r.openRatePct, C)} C={C} />
                </td>
                <td style={CELL}>
                  <RateBar pct={r.clickRatePct} color={clickRateBarColor(r.clickRatePct, C)} C={C} multiplier={3} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RateBar({ pct, color, C, multiplier = 1 }) {
  // multiplier amplifies low-value bars visually (click rate often single-digit)
  const widthPct = pct === null || pct === undefined
    ? 0
    : Math.min(Math.max(pct * multiplier, 0), 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 140 }}>
      <span style={{
        width: 50,
        fontSize: 13,
        fontWeight: 700,
        color: C.text,
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'right',
      }}>
        {fmtPct(pct)}
      </span>
      <div style={{
        flex: 1,
        height: 6,
        background: C.subtle,
        borderRadius: 50,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${widthPct}%`,
          height: '100%',
          background: color,
          borderRadius: 50,
          transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  );
}
