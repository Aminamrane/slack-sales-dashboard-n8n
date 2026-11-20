import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, FileSignature, MousePointerClick, Search, Send, TriangleAlert, UserCheck, Users } from 'lucide-react';

import { EmailActivity } from '../SequenceActivity.jsx';
import { Card, CountUp, Donut, Empty, Fact, Hint, Pill, Rings, Segmented, Tag } from './parts.jsx';
import {
  DASH, ROWS_PAGE, effectiveView, factsOf, fmtDate, funnelOf, initial, num, perEmailOf, ringsOf, segmentMeta, segmentsOf, statusOf, tableRows,
} from './format.js';

// Une séquence Meta (Broad, BTP, Restaurant, Ambulance…) : hero et chiffres, activité, parcours, qualifications,
// funnel par email, puis le tableau des prospects. Rend uniquement ce qui est affiché (les autres séquences ne coûtent rien).

function Paused({ seq }) {
  return (
    <div className="seq-banner seq-in" role="status">
      <TriangleAlert size={17} aria-hidden="true" />
      <span>
        Séquence <strong>{seq.label}</strong> en pause : aucun email envoyé. Le tableau montre les <strong>{num(seq.stats.eligible)}</strong> prospects éligibles aujourd’hui ;
        à l’activation, seuls les prospects qui entrent ensuite en qualification recevront la séquence.
      </span>
    </div>
  );
}

const FACT_ICONS = {
  eligible: <Users size={16} />, sent: <Send size={16} />, clicked: <MousePointerClick size={16} />,
  rebooked: <CalendarCheck size={16} />, presented: <UserCheck size={16} />, signed: <FileSignature size={16} />,
};

const Hero = memo(function Hero({ seq }) {
  const st = seq.stats;
  const facts = useMemo(() => factsOf(st), [st]);
  const rings = useMemo(() => ringsOf(st), [st]);
  const rdv = rings[1]?.pct;
  return (
    <Card className="seq-hero" delay={1} data-hue="blue">
      <div className="seq-hero-top">
        <div>
          <div className="seq-hero-label">
            <span className="seq-mono">Contactés</span>
            <Hint label="Détail : contactés">au moins un email reçu</Hint>
          </div>
          <span className="seq-big"><CountUp value={st.contacted} /></span>
          <div className="seq-hero-badges">
            <Pill tone={seq.enabled ? 'good' : 'warn'}>{seq.enabled ? 'Active' : 'En pause'}</Pill>
            <Pill hue="blue">{num(st.sent)} emails envoyés</Pill>
          </div>
        </div>
        <Rings rings={rings} center={{ num: rdv === null || rdv === undefined ? DASH : `${rdv} %`, cap: 'RDV repris' }}
          ariaLabel="Part des contactés qui ont cliqué, repris un RDV et signé" />
      </div>
      <div className="seq-facts">
        {facts.map((f) => <Fact key={f.key} label={f.label} value={f.value} hue={f.hue} hint={f.hint} icon={FACT_ICONS[f.key]} />)}
      </div>
    </Card>
  );
});

const Funnel = memo(function Funnel({ st }) {
  const rows = useMemo(() => funnelOf(st), [st]);
  return (
    <Card title="Parcours des prospects" className="seq-span-7" delay={3}>
      <div className="seq-funnel">
        {rows.map((f, i) => (
          <div key={f.key} className="seq-funnel-row">
            <span className="seq-funnel-label">{f.label}<Hint label={`Détail : ${f.label}`}>{f.hint}</Hint></span>
            <div className="seq-bar" data-hue={f.tone}>
              <span className="seq-bar-fill" style={{ width: `${f.width}%`, '--i': i, visibility: f.width ? 'visible' : 'hidden' }} />
              <span className="seq-bar-value" style={f.width < 14 ? { paddingLeft: `calc(${f.width}% + 14px)` } : undefined}>{num(f.value)}</span>
            </div>
            <span className="seq-funnel-conv">{f.conv === null ? '' : `${f.conv} %`}</span>
          </div>
        ))}
      </div>
    </Card>
  );
});

const Qualifications = memo(function Qualifications({ seq }) {
  const { total, rows } = useMemo(() => segmentsOf(seq), [seq]);
  return (
    <Card title="Qualifications entrantes" className="seq-span-5" delay={4}
      hintTitle="Qualifications entrantes" hint={`Répartition des ${num(total)} prospects éligibles aujourd’hui par motif d’entrée.`}>
      <div className="seq-donut-wrap">
        <Donut rows={rows} total={total} cap="éligibles" ariaLabel="Répartition des éligibles par motif d’entrée" />
        <div className="seq-legend">
          {rows.map((r) => (
            <div key={r.key} className="seq-legend-row" data-hue={r.tone}>
              <span className="seq-legend-dot" />
              <span className="seq-legend-name">{r.label}<Hint label={`Détail : ${r.label}`}>{r.desc}</Hint></span>
              <span className="seq-legend-n">{num(r.n)}</span>
              <span className="seq-legend-share">{r.share === null ? DASH : `${r.share} %`}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
});

const PerEmail = memo(function PerEmail({ seq }) {
  const sent = seq.stats.sent;
  const rows = useMemo(() => perEmailOf(seq, 10), [seq]);
  return (
    <Card title="Funnel par email" className="seq-span-12" delay={5}
      hintTitle="Funnel par email" hint="Envoyés, clics et RDV pour chacun des 10 emails."
      right={<div className="seq-legend-inline"><span><i style={{ background: 'linear-gradient(180deg, var(--c-blue-solid), var(--c-blue-bg))' }} />Envoyés</span><span><i style={{ background: 'var(--c-blue-fg)', opacity: 0.7 }} />Dont cliqués</span></div>}>
      {!sent ? <Empty>Aucun envoi pour l’instant.</Empty> : (
        <div className="seq-emails">
          {rows.map((e, i) => (
            <div key={e.n} className="seq-email" data-hue="blue">
              <div className="seq-email-col">
                <div className="seq-email-bar" style={{ height: `${Math.max(4, e.height * 96)}px`, '--i': i }}>
                  {e.clicked > 0 && <div className="seq-email-click" style={{ height: `${Math.max(2, e.clickShare * 100)}%` }} />}
                </div>
              </div>
              <div className="seq-email-n">#{e.n}</div>
              <div className="seq-email-sent">{num(e.sent)}</div>
              <div className="seq-email-sub" data-tone="cyan">{e.clicked} clic{e.clicked > 1 ? 's' : ''}</div>
              <div className="seq-email-sub" data-tone="good">{e.booked} rdv</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
});

function ProspectsTable({ seq }) {
  const [chosen, setChosen] = useState(null);                 // null = automatique
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(ROWS_PAGE);
  const view = effectiveView(seq, chosen);
  const deferred = useDeferredValue(query);                   // la saisie reste fluide, le filtrage suit
  useEffect(() => { setChosen(null); setQuery(''); setLimit(ROWS_PAGE); }, [seq.key]);
  useEffect(() => { setLimit(ROWS_PAGE); }, [view, deferred]);
  const t = useMemo(() => tableRows(seq, view, deferred, limit), [seq, view, deferred, limit]);

  return (
    <Card className="seq-span-12" delay={6}>
      <div className="seq-table-bar">
        <Segmented label="Prospects affichés" value={view} onChange={setChosen}
          options={[{ key: 'in_seq', label: 'Dans la séquence', count: seq.stats.contacted }, { key: 'eligible', label: 'Prospects éligibles', count: seq.stats.eligible }]} />
        <label className="seq-search">
          <Search size={15} aria-hidden="true" />
          <input className="seq-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher (nom, email, sales)…" aria-label="Rechercher un prospect" />
        </label>
      </div>
      {t.truncated && (
        <span className="seq-trunc">Aperçu des {num(seq.eligible_sample.length)} premiers sur {num(t.total)} prospects éligibles · la recherche ne porte que sur cet aperçu.</span>
      )}
      <div className="seq-table-wrap" tabIndex={0} role="region" aria-label="Prospects">
        <table className="seq-table">
          <thead>
            <tr>
              <th>Prospect</th><th className="seq-col-sales">Sales</th><th className="seq-col-qual">Qualification</th>
              {!t.eligible && <><th className="seq-col-last">Dernier email</th><th>Statut</th><th className="seq-col-rdv">RDV repris</th></>}
            </tr>
          </thead>
          <tbody>
            {t.list.length === 0 ? (
              <tr><td colSpan={t.eligible ? 3 : 6}><Empty>{query.trim() ? 'Aucun prospect ne correspond à la recherche.' : t.eligible ? 'Aucun prospect éligible.' : 'Aucun lead dans la séquence.'}</Empty></td></tr>
            ) : t.list.map((r, i) => {
              const sm = segmentMeta(r.segment);
              const status = statusOf(r);
              return (
                <tr key={r.lead_id ?? i}>
                  <td><span className="seq-cell-name">{r.full_name || DASH}</span><span className="seq-cell-mail">{r.email}</span><span className="seq-q-inline"><Tag hue={sm.tone} dot>{sm.label}</Tag></span></td>
                  <td className="seq-col-sales">
                    {r.sales ? <span className="seq-cell-sales"><span className="seq-avatar" aria-hidden="true">{initial(r.sales)}</span>{r.sales}</span> : DASH}
                  </td>
                  <td className="seq-col-qual"><Tag hue={sm.tone} dot>{sm.label}</Tag></td>
                  {!t.eligible && (
                    <>
                      <td className="seq-col-last"><span className="seq-cell-when">{r.last_email_num ? `#${r.last_email_num} · ${fmtDate(r.last_sent_at)}` : DASH}</span></td>
                      <td><Tag hue={status.hue}>{status.label}</Tag></td>
                      <td className="seq-col-rdv">{r.rebooked ? <span className="seq-cell-rdv">{fmtDate(r.rdv_at)}</span> : DASH}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {t.hidden > 0 && (
          <div className="seq-more">
            <button type="button" className="seq-btn seq-btn--ghost" onClick={() => setLimit((n) => n + ROWS_PAGE)}>
              Afficher {Math.min(ROWS_PAGE, t.hidden)} de plus · {num(t.hidden)} restants
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function MetaSequence({ seq }) {
  return (
    <div className="seq-body" data-hue="blue">
      {!seq.enabled && <Paused seq={seq} />}
      <Hero seq={seq} />
      <EmailActivity seqKey={seq.key} delay={2} />
      <div className="seq-grid">
        <Funnel st={seq.stats} />
        <Qualifications seq={seq} />
        <PerEmail seq={seq} />
        <ProspectsTable seq={seq} />
      </div>
    </div>
  );
}
