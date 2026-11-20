import { CalendarCheck, Mail, MessageSquareText, MousePointerClick, Send } from 'lucide-react';

import { Card, CountUp, Empty, Fact, Hint, Rings } from './parts.jsx';
import { num, rateText } from './format.js';

// Deux vues courtes : le mail de confirmation (par niche) et la relance no-show (R1 / R2).

export function ConfirmationView({ data }) {
  const total = data.total || {};
  const niches = data.niches || [];
  return (
    <div className="seq-body" data-hue="blue">
      <Card className="seq-hero" delay={1} data-hue="blue">
        <div className="seq-hero-top">
          <div>
            <div className="seq-hero-label">
              <span className="seq-mono">Confirmations envoyées</span>
              <Hint label="Détail : confirmations envoyées">leads ADS auto-affectés</Hint>
            </div>
            <span className="seq-big"><CountUp value={total.sent} /></span>
          </div>
          <Rings rings={[{ key: 'rate', label: 'Taux de prise de RDV', hue: 'green', pct: total.rate == null ? null : Math.round(Number(total.rate)) }]}
            center={{ num: total.rate == null ? '—' : `${Math.round(Number(total.rate))} %`, cap: 'RDV / envoyés' }} ariaLabel="Taux de prise de RDV" />
        </div>
        <div className="seq-facts">
          <Fact label="RDV pris via le lien" value={total.rdv} hue="green" icon={<CalendarCheck size={16} />} hint="réservé via le mail" />
          <Fact label="Taux de prise de RDV" value={total.rate} hue="blue" icon={<MousePointerClick size={16} />} hint="RDV / envoyés">{rateText(total.rate)}</Fact>
        </div>
      </Card>
      <Card title="Ventilation par niche" delay={2} hintTitle="Ventilation par niche"
        hint="Confirmations envoyées et RDV R1 pris, selon la niche du lead (origine). « RDV pris » = leads ayant réservé leur R1 via le lien du mail de confirmation (attribution stricte).">
        {!niches.length ? <Empty>Aucune niche.</Empty> : (
          <div className="seq-table-wrap" tabIndex={0} role="region" aria-label="Ventilation par niche">
            <table className="seq-table">
              <thead><tr><th>Niche</th><th className="is-num">Envoyés</th><th className="is-num">RDV pris</th><th>Taux</th></tr></thead>
              <tbody>
                {niches.map((n) => (
                  <tr key={n.key}>
                    <td className="seq-cell-name">{n.label}</td>
                    <td className="is-num">{num(n.sent)}</td>
                    <td className="is-num" style={{ color: 'var(--good-strong)', fontWeight: 600 }}>{num(n.rdv)}</td>
                    <td>
                      <div className="seq-rate">
                        <span className="seq-rate-bar"><span style={{ width: `${Math.min(100, Math.max(0, Number(n.rate) || 0))}%` }} /></span>
                        <span className="seq-num" style={{ color: 'var(--muted)', fontSize: 13 }}>{rateText(n.rate)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function NoShowView({ data }) {
  const ns = data?.noshow_relance;
  if (!ns) return <Card delay={1}><Empty>Monitoring no-show indisponible.</Empty></Card>;
  const stages = [{ key: 'r1', label: 'No-show R1', d: ns.r1 || {} }, { key: 'r2', label: 'No-show R2', d: ns.r2 || {} }];
  return (
    <div className="seq-body">
      {stages.map((r, i) => (
        <Card key={r.key} title={r.label} delay={i + 1} data-hue="blue" className="seq-stage">
          <div className="seq-facts" style={{ marginTop: 0 }}>
            <Fact label="Emails envoyés" value={r.d.email_sent} hue="blue" icon={<Mail size={16} />} hint="relance automatique" />
            <Fact label="SMS envoyés" value={r.d.sms_sent} hue="violet" icon={<MessageSquareText size={16} />} hint="Brevo · 1 max par lead" />
            <Fact label="RDV repris" value={r.d.recovered_total} hue="green-soft" icon={<CalendarCheck size={16} />} hint="nouvelle date après relance" />
            <Fact label="dont via le lien" value={r.d.recovered_link} hue="green-deep" icon={<Send size={16} />} hint="réservé via le lien de reprise" />
          </div>
        </Card>
      ))}
    </div>
  );
}
