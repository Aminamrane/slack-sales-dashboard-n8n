// Dashboard Leads du CEO (dev 18/11/2026) : ce qui est entré aujourd'hui, ou sur une période, par canal ; le travail des
// setters (cold call, anciens webinaires, Seconde chance) ; les appels ; Meta et ses campagnes ; les ventes par origine.
// Même langage que les Statistiques de la page Finance (kit PageKit, classes fst-) ; ce qui manque au kit est en ld-.
// Le serveur compte (/api/v1/lead-statistics), la page présente. Chaque chiffre se compare à la période précédente.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { BadgeEuro, CalendarDays, History, Inbox, LifeBuoy, Megaphone, Phone, PhoneOutgoing, Presentation, Target,
  Users } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { Card, Collapse, Page, Reveal, Segmented, TableBox, Th, Who } from '../../pages/TrackingSheetFinance/components/PageKit.jsx';
import { PeriodPicker } from '../../pages/TrackingSheetFinance/statistics/PeriodPicker.jsx';
import { dayRangeLabel } from '../../pages/TrackingSheetFinance/statistics/period.js';
import { count, dayShort, eur, pct, plural } from '../../pages/TrackingSheetFinance/statistics/model.js';
import { parisToday } from '../../utils/parisDates.js';
import { byKey, canReadCalls, COMPARE_LABEL, comparisonFor, delta, groupChannels, heights, PRESETS, presetRange, signed,
  weekdayShort } from './model.js';
import './leads.css';

const REFRESH_MS = 5 * 60 * 1000;

// Une lecture du serveur : la dernière demande seule compte, la précédente reste affichée pendant le rechargement.
function useLeadStat(name, range) {
  const [state, setState] = useState({ data: null, loading: Boolean(range), error: '' });
  const latest = useRef(0);
  const key = range ? `${range.from}/${range.to}` : '';
  const load = useCallback(() => {
    if (!key) { setState({ data: null, loading: false, error: '' }); return; }
    const id = ++latest.current;
    const [from, to] = key.split('/');
    setState((s) => ({ ...s, loading: true, error: '' }));
    apiClient.get(`/api/v1/lead-statistics/${name}?date_from=${from}&date_to=${to}`)
      .then((data) => { if (id === latest.current) setState({ data, loading: false, error: '' }); })
      .catch((e) => {
        if (id !== latest.current) return;
        const detail = e?.data?.detail;
        setState((s) => ({ ...s, loading: false, error: typeof detail === 'string' ? detail : 'Ces chiffres sont indisponibles pour le moment.' }));
      });
  }, [name, key]);
  useEffect(() => { load(); }, [load]);
  return { ...state, retry: load };
}

// L'écart avec la période de comparaison, en pastille : vert en hausse, rouge en baisse.
function Delta({ value, previous, label, invert = false }) {
  const d = delta(value, previous);
  if (!d) return null;
  const good = invert ? d.tone === 'down' : d.tone === 'up';
  const tone = d.tone === 'flat' ? 'flat' : good ? 'good' : 'bad';
  return (
    <span className="ld-delta" data-tone={tone} title={label ? `Comparé à ${label} : ${count(previous)}` : undefined}>
      {d.tone === 'flat' ? '=' : signed(d.diff)}
    </span>
  );
}

// ── Leads par canal ───────────────────────────────────────────────────────────────────────────────

function DailyBars({ days, values, details, selected }) {
  const h = heights(values);
  return (
    <div className="fst-bars ld-bars" style={{ '--n': days.length }}>
      {days.map((day, i) => (
        <div key={day} className="fst-bar" data-in={values[i] > 0 || undefined}>
          <span className="fst-bar-value">{count(values[i])}</span>
          <Motion.span className="fst-bar-fill" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
            transition={{ duration: 0.6, delay: Math.min(i * 0.02, 0.4), ease: [0.22, 1, 0.36, 1] }}
            style={{ height: `${Math.max(h[i] * 100, values[i] ? 4 : 1)}%` }} />
          <span className="fst-bar-label">{days.length > 16 ? (i % Math.ceil(days.length / 10) ? '' : dayShort(day)) : `${weekdayShort(day)} ${Number(day.slice(8))}`}</span>
          <span className="fst-tip">
            <b>{dayShort(day)}</b> · {plural(values[i], 'lead')}{selected ? ` ${selected}` : ''}
            {(details[i] || []).map((d) => <span key={d.label}><br />{d.label} : {count(d.n)}</span>)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChannelsCard({ state, prev, compareLabel }) {
  const data = state.data;
  const [selected, setSelected] = useState(null);
  const before = byKey(prev?.channels);
  const groups = useMemo(() => groupChannels(data?.channels, data?.groups)
    .map((g) => ({ ...g, channels: g.channels.filter((c) => c.total || before[c.key]?.total) }))
    .filter((g) => g.channels.length), [data, before]);
  const silent = (data?.channels || []).filter((c) => !c.total && !before[c.key]?.total).map((c) => c.label);
  const total = data?.total?.leads || 0;
  const channel = selected ? data?.channels.find((c) => c.key === selected) : null;
  const values = channel ? channel.by_day : data?.total?.by_day || [];
  const details = (data?.days || []).map((_, i) => (channel ? [] : (data?.channels || [])
    .filter((c) => c.by_day[i]).sort((a, b) => b.by_day[i] - a.by_day[i]).slice(0, 4).map((c) => ({ label: c.label, n: c.by_day[i] }))));
  return (
    <Card title="Leads reçus par canal" Icon={Inbox} state={state} skeleton={420}
      hint={`Fiches arrivées sur la période, une personne comptée une fois par canal et par jour${compareLabel ? `. Écarts comparés à ${compareLabel}` : ''}.`}>
      {data && (
        <>
          {data.days.length > 1 && (
            <div className="ld-chart">
              <div className="ld-chart-head">
                <span className="fst-micro">{channel ? channel.label : 'Tous les canaux'}, jour par jour</span>
                {channel && <button type="button" className="ld-link" onClick={() => setSelected(null)}>Tous les canaux</button>}
              </div>
              <DailyBars days={data.days} values={values} details={details} selected={channel?.label} />
            </div>
          )}
          {groups.map((g) => (
            <div key={g.key} className="fst-group">
              <div className="fst-group-head">
                <span className="fst-group-name">{g.label}</span>
                <span className="fst-group-count"><b>{count(g.total)}</b></span>
              </div>
              {g.channels.map((c) => (
                <div key={c.key}>
                  <button type="button" className="ld-row" aria-pressed={selected === c.key} disabled={data.days.length < 2 || !c.total}
                    onClick={() => setSelected(selected === c.key ? null : c.key)}>
                    <span className="ld-row-name">{c.label}</span>
                    <span className="fst-track ld-row-track"><span className="fst-fill" style={{ width: `${total ? (c.total / total) * 100 : 0}%` }} /></span>
                    <span className="ld-row-num">{count(c.total)}</span>
                    <span className="ld-row-delta"><Delta value={c.total} previous={before[c.key]?.total} label={compareLabel} /></span>
                  </button>
                  {c.key === 'other' && c.origins?.length > 0 && (
                    <div className="ld-origins">{c.origins.slice(0, 6).map((o) => `${o.label} (${count(o.count)})`).join(' · ')}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {silent.length > 0 && <p className="ld-silent">Aucun lead : {silent.join(', ')}.</p>}
        </>
      )}
    </Card>
  );
}

// ── Meta ──────────────────────────────────────────────────────────────────────────────────────────

function MetaCard({ state, prev, compareLabel, onCampaigns, campaignsOpen }) {
  const meta = state.data?.meta;
  // Leads reçus : le canal « Ads Meta » des leads reçus, le même chiffre partout sur la page.
  const received = byKey(state.data?.channels).meta_ads?.total;
  const receivedBefore = byKey(prev?.channels).meta_ads?.total;
  const before = prev?.meta?.status === 'ok' ? prev.meta : null;
  const ads = meta?.excluding_webinar;
  const cats = byKey((before?.categories || []).map((c) => ({ ...c, key: c.category })));
  const max = Math.max(1, ...(meta?.categories || []).map((c) => c.leads));
  return (
    <Card title="Ads Meta" Icon={Megaphone} state={state} skeleton={420} className="ld-ads"
      hint="Leads reçus des publicités et ce qu'ils ont coûté, hors webinaire.">
      {meta?.status !== 'ok' ? <div className="fst-empty is-box">Statistiques Meta pas encore synchronisées pour cette période.</div> : (
        <>
          <div className="ld-ads-hero">
            <div className="ld-ads-main">
              <strong>{count(received)}</strong>
              <span>{received > 1 ? 'leads reçus' : 'lead reçu'}</span>
              <Delta value={received} previous={receivedBefore} label={compareLabel} />
            </div>
            <dl className="ld-ads-facts">
              <div><dt>CPL</dt><dd>{eur(ads?.cpl_eur, 2)} <Delta value={ads?.cpl_eur} previous={before?.excluding_webinar?.cpl_eur} label={compareLabel} invert /></dd></div>
              <div><dt>Dépensé</dt><dd>{eur(ads?.spend_eur)}</dd></div>
            </dl>
          </div>
          <div className="ld-sub ld-ads-sub">Par catégorie, leads comptés par Meta</div>
          <div className="ld-ads-cats">
            {(meta.categories || []).map((c) => (
              <div key={c.category} className="ld-ads-cat">
                <span className="ld-row-name">{c.category}</span>
                <span className="fst-track ld-row-track"><span className="fst-fill" style={{ width: `${(c.leads / max) * 100}%` }} /></span>
                <span className="ld-ads-num">{count(c.leads)}</span>
                <span className="ld-ads-cpl">{eur(c.cpl_eur, 2)}<Delta value={c.cpl_eur} previous={cats[c.category]?.cpl_eur} label={compareLabel} invert /></span>
              </div>
            ))}
          </div>
          {meta.webinar && (
            <p className="ld-ads-webinar">Webinaire : {plural(meta.webinar.leads, 'inscrit')}, CPL {eur(meta.webinar.cpl_eur, 2)}, {eur(meta.webinar.spend_eur)} dépensés.</p>
          )}
          <div className="ld-ads-foot">
            {!meta.complete ? <span className="ld-muted">Meta se lit chaque heure : un jour n'est pas encore à jour.</span> : <span />}
            <button type="button" className="ld-link" aria-expanded={campaignsOpen} onClick={onCampaigns}>
              {campaignsOpen ? 'Masquer les campagnes' : 'Voir les campagnes'}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

function CampaignsCard({ state }) {
  const rows = state.data?.campaigns || [];
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <Card title="Campagnes Meta" Icon={Target} state={state} skeleton={320}
      hint="Coût, clics et leads de chaque campagne ; ventes signées sur la période venues de ses leads, chiffre d'affaires annuel et retour sur dépense.">
      {!rows.length ? <div className="fst-empty is-box">Aucune campagne sur cette période.</div> : (
        <TableBox minWidth={980} free={false} after={rows.length > 12 && (
          <button type="button" className="fst-more" onClick={() => setAll(!all)}>{all ? 'Réduire' : `Voir les ${rows.length} campagnes`}</button>)}>
          <thead><tr><Th>Campagne</Th><Th>Catégorie</Th><Th num>Dépense</Th><Th num>Impressions</Th><Th num>Clics</Th><Th num>CTR</Th>
            <Th num>Leads Meta</Th><Th num>Reçus</Th><Th num>CPL</Th><Th num>Ventes</Th><Th num>CA</Th><Th num>ROAS</Th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.campaign}>
                <td className="is-wrap">{r.campaign}{!r.in_meta && <span className="ld-muted"> · sans dépense sur la période</span>}</td>
                <td>{r.category}</td><td className="is-num">{eur(r.spend_eur)}</td><td className="is-num">{count(r.impressions)}</td>
                <td className="is-num">{count(r.clicks)}</td><td className="is-num">{pct(r.ctr, 2)}</td><td className="is-num">{count(r.leads_meta)}</td>
                <td className="is-num">{count(r.received_in_crm)}</td><td className="is-num">{eur(r.cpl_eur, 2)}</td>
                <td className="is-num">{count(r.sales)}</td><td className="is-num">{eur(r.revenue_eur)}</td>
                <td className="is-num">{r.roas == null ? '–' : `${r.roas.toLocaleString('fr-FR')}×`}</td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      )}
    </Card>
  );
}

// ── Setters ───────────────────────────────────────────────────────────────────────────────────────

function People({ rows, value, one, many }) {
  if (!rows?.length) return <div className="fst-empty">Personne sur cette période.</div>;
  return (
    <div className="ld-people">
      {rows.map((r) => (
        <div key={r.name} className="ld-person"><Who name={r.name} /><span>{plural(value(r), one, many)}</span></div>
      ))}
    </div>
  );
}

function SettersCard({ state, prev, compareLabel }) {
  const s = state.data?.setters;
  const before = byKey(prev?.setters?.by_provenance);
  const rows = (s?.by_provenance || []).filter((p) => p.rdv_placed || before[p.key]?.rdv_placed);
  return (
    <Card title="RDV posés par les setters" Icon={PhoneOutgoing} state={state} skeleton={360}
      hint="Par provenance du lead, règle du classement des setters : un RDV compte le jour où il est posé.">
      {s && (
        <>
          <div className="ld-hero is-two">
            <div><span className="fst-micro">RDV posés</span><strong>{count(s.rdv_placed)}</strong>
              <Delta value={s.rdv_placed} previous={prev?.setters?.rdv_placed} label={compareLabel} /></div>
            <div><span className="fst-micro">Honorés à ce jour</span><strong>{count(rows.reduce((sum, p) => sum + p.rdv_qualified, 0))}</strong></div>
          </div>
          {!rows.length ? <div className="fst-empty">Aucun RDV posé sur cette période.</div> : rows.map((p) => (
            <div key={p.key} className="ld-row is-static">
              <span className="ld-row-name">{p.label}</span>
              <span className="fst-track ld-row-track"><span className="fst-fill" style={{ width: `${s.rdv_placed ? (p.rdv_placed / s.rdv_placed) * 100 : 0}%` }} /></span>
              <span className="ld-row-num">{count(p.rdv_placed)}</span>
              <span className="ld-row-delta"><Delta value={p.rdv_placed} previous={before[p.key]?.rdv_placed} label={compareLabel} /></span>
            </div>
          ))}
          <div className="ld-sub">Par setter</div>
          <People rows={s.setters} value={(r) => r.rdv_placed} one="RDV" many="RDV" />
        </>
      )}
    </Card>
  );
}

function RecallsCard({ state, prev, compareLabel }) {
  const old = state.data?.old_webinar;
  const sc = state.data?.second_chance;
  return (
    <Card title="Relances des setters" Icon={History} state={state} skeleton={360}
      hint="Anciens inscrits aux webinaires rappelés, et leads perdus repris en Seconde chance.">
      {old && sc && (
        <div className="ld-split">
          <section>
            <h4 className="ld-h"><Presentation size={14} />Anciens webinaires</h4>
            <div className="ld-hero is-two">
              <div><span className="fst-micro">Fiches rappelées</span><strong>{count(old.worked)}</strong>
                <Delta value={old.worked} previous={prev?.old_webinar?.worked} label={compareLabel} /></div>
              <div><span className="fst-micro">RDV posés</span><strong>{count(old.rdv_placed)}</strong>
                <Delta value={old.rdv_placed} previous={prev?.old_webinar?.rdv_placed} label={compareLabel} /></div>
            </div>
            <People rows={old.setters} value={(r) => r.worked} one="fiche" many="fiches" />
          </section>
          <section>
            <h4 className="ld-h"><LifeBuoy size={14} />Seconde chance</h4>
            <div className="ld-hero is-two">
              <div><span className="fst-micro">Leads repris</span><strong>{count(sc.claimed)}</strong>
                <Delta value={sc.claimed} previous={prev?.second_chance?.claimed} label={compareLabel} /></div>
              <div><span className="fst-micro">RDV reposés</span><strong>{count(sc.booked)}</strong>
                <Delta value={sc.booked} previous={prev?.second_chance?.booked} label={compareLabel} /></div>
            </div>
            <People rows={sc.setters} value={(r) => r.claimed} one="repris" many="repris" />
          </section>
        </div>
      )}
    </Card>
  );
}

// ── Appels ────────────────────────────────────────────────────────────────────────────────────────

function CallsCard({ state, tooLong }) {
  const [team, setTeam] = useState('setters');
  const block = state.data?.[team];
  return (
    <Card title="Appels" Icon={Phone} state={tooLong ? null : state} skeleton={360}
      hint="Appels passés et reçus dans Allo ; décroché = une personne a répondu (un répondeur ne compte pas)."
      actions={<Segmented small value={team} onChange={setTeam} label="Équipe"
        options={[{ key: 'setters', label: 'Setters' }, { key: 'sales', label: 'Sales' }]} />}>
      {tooLong ? <div className="fst-empty is-box">Les appels se lisent sur 31 jours au plus : choisissez une période plus courte.</div> : block && (
        <>
          <div className="ld-hero">
            <div><span className="fst-micro">Appels</span><strong>{count(block.team.calls)}</strong></div>
            <div><span className="fst-micro">Sortants</span><strong>{count(block.team.outbound)}</strong></div>
            <div><span className="fst-micro">Décrochés</span><strong>{count(block.team.answered)}</strong></div>
            <div><span className="fst-micro">Taux de décroché</span><strong>{pct(block.team.outbound ? block.team.answered / block.team.outbound : null, 0)}</strong></div>
          </div>
          <TableBox>
            <thead><tr><Th Icon={Users}>Personne</Th><Th num>Appels</Th><Th num>Décrochés</Th><Th num>Temps</Th></tr></thead>
            <tbody>
              {block.people.map((p) => (
                <tr key={p.name}>
                  <td><Who name={p.name} /></td>
                  {p.status === 'ok' ? (
                    <><td className="is-num">{count(p.total.calls)}</td><td className="is-num">{count(p.total.answered)}</td>
                      <td className="is-num">{Math.round((p.total.duration_seconds || 0) / 60)} min</td></>
                  ) : <td colSpan={3} className="ld-muted">{p.status === 'no_allo_account' ? 'Pas de compte Allo à son nom' : 'Allo indisponible'}</td>}
                </tr>
              ))}
            </tbody>
          </TableBox>
        </>
      )}
    </Card>
  );
}

// ── Ventes ────────────────────────────────────────────────────────────────────────────────────────

function SalesCard({ state, prev, compareLabel }) {
  const sales = state.data?.sales;
  const before = byKey(prev?.sales?.by_origin);
  const rows = (sales?.by_origin || []).filter((o) => o.sales || before[o.key]?.sales);
  return (
    <Card title="Ventes par origine" Icon={BadgeEuro} state={state} skeleton={360}
      hint="Ventes signées sur la période, rangées par origine du client (règle du Suivi des ventes).">
      {sales && (
        <>
          <div className="ld-hero is-two">
            <div><span className="fst-micro">Ventes</span><strong>{count(sales.totals.sales)}</strong>
              <Delta value={sales.totals.sales} previous={prev?.sales?.totals?.sales} label={compareLabel} /></div>
            <div><span className="fst-micro">Valeur annuelle</span><strong>{eur(sales.totals.revenue_eur)}</strong></div>
          </div>
          {!rows.length ? <div className="fst-empty">Aucune vente sur cette période.</div> : rows.map((o) => (
            <div key={o.key} className="ld-row is-static" title={o.definition}>
              <span className="ld-row-name">{o.label}</span>
              <span className="fst-track ld-row-track"><span className="fst-fill" style={{ width: `${sales.totals.sales ? (o.sales / sales.totals.sales) * 100 : 0}%` }} /></span>
              <span className="ld-row-num">{count(o.sales)}</span>
              <span className="ld-row-delta"><Delta value={o.sales} previous={before[o.key]?.sales} label={compareLabel} /></span>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────────────────────────

export default function LeadsDashboard() {
  const today = parisToday();
  const [preset, setPreset] = useState('today');
  const [custom, setCustom] = useState(null);
  const [compare, setCompare] = useState(true);
  const [campaignsOpen, setCampaignsOpen] = useState(false);
  const range = useMemo(() => (custom ? { from: custom.from, to: custom.to } : presetRange(preset, today)), [custom, preset, today]);
  const compareKey = custom ? 'custom' : preset;
  const prevRange = useMemo(() => comparisonFor(compareKey, range), [compareKey, range]);
  const compareLabel = compare ? `${COMPARE_LABEL[compareKey]} (${dayRangeLabel(prevRange)})` : null;

  const current = useLeadStat('overview', range);
  const previous = useLeadStat('overview', compare ? prevRange : null);
  const tooLong = !canReadCalls(range);
  const calls = useLeadStat('calls', tooLong ? null : range);
  const campaigns = useLeadStat('campaigns', campaignsOpen ? range : null);

  // Le jour en cours se met à jour tout seul, toutes les cinq minutes.
  const { retry } = current;
  useEffect(() => {
    if (range.to !== today) return undefined;
    const timer = setInterval(() => { if (!document.hidden) retry(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [range.to, today, retry]);

  const d = current.data;
  const p = compare ? previous.data : null;
  const ads = d?.meta?.status === 'ok' ? d.meta.excluding_webinar : null;
  const [tab, setTab] = useState('leads');
  const when = range.from === range.to ? (range.to === today ? "aujourd'hui" : `le ${dayShort(range.to)}`)
    : `du ${dayShort(range.from)} au ${dayShort(range.to)}`;

  return (
    <Page title="Leads" sub="Ce qui entre, d'où ça vient, et ce que coûtent les ads."
      actions={(
        <div className="ld-actions">
          <Segmented small value={custom ? null : preset} label="Période"
            onChange={(key) => { setCustom(null); setPreset(key); }} options={PRESETS} />
          <PeriodPicker value={custom} onChange={setCustom} label="Autre période" />
          <button type="button" className="fst-btn is-small" aria-pressed={compare} onClick={() => setCompare(!compare)}>
            <CalendarDays size={14} />{compare ? `Comparé à ${COMPARE_LABEL[compareKey]}` : 'Sans comparaison'}
          </button>
        </div>
      )}>
      {current.error && !d && (
        <div className="fst-error" role="alert">{current.error}<button type="button" onClick={current.retry}>Réessayer</button></div>
      )}
      <Motion.section className="ld-answer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        data-stale={(current.loading && Boolean(d)) || undefined}>
        {d ? (
          <>
            <p className="ld-answer-main">
              <strong>{count(d.total.leads)}</strong> {d.total.leads > 1 ? 'leads reçus' : 'lead reçu'} {when}
              {compare && <Delta value={d.total.leads} previous={p?.total?.leads} label={compareLabel} />}
            </p>
            {ads && (
              <p className="ld-answer-sub">
                dont <b>{count(byKey(d.channels).meta_ads?.total)}</b> par les ads Meta, à <b>{eur(ads.cpl_eur, 2)}</b> le lead, pour <b>{eur(ads.spend_eur)}</b> dépensés.
              </p>
            )}
          </>
        ) : <p className="ld-answer-main is-wait">Lecture des leads…</p>}
      </Motion.section>

      <div className="ld-tabs">
        <Segmented value={tab} onChange={setTab} label="Vue" options={[
          { key: 'leads', label: 'Canaux et ads' }, { key: 'setters', label: 'Setters' },
          { key: 'calls', label: 'Appels' }, { key: 'sales', label: 'Ventes' }]} />
      </div>

      {tab === 'leads' && (
        <>
          <Reveal className="fst-grid">
            <ChannelsCard state={current} prev={p} compareLabel={compareLabel} />
            <MetaCard state={current} prev={p} compareLabel={compareLabel} campaignsOpen={campaignsOpen}
              onCampaigns={() => setCampaignsOpen(!campaignsOpen)} />
          </Reveal>
          <Collapse open={campaignsOpen}>
            <Reveal className="ld-gap"><CampaignsCard state={campaigns} /></Reveal>
          </Collapse>
        </>
      )}
      {tab === 'setters' && (
        <Reveal className="fst-grid is-even">
          <SettersCard state={current} prev={p} compareLabel={compareLabel} />
          <RecallsCard state={current} prev={p} compareLabel={compareLabel} />
        </Reveal>
      )}
      {tab === 'calls' && <Reveal><CallsCard state={calls} tooLong={tooLong} /></Reveal>}
      {tab === 'sales' && <Reveal><SalesCard state={current} prev={p} compareLabel={compareLabel} /></Reveal>}
      {d && <p className="ld-source">Calculé à {d.period.generated_at.slice(11, 16)}{d.meta?.synced_at ? ` · Meta lu à ${d.meta.synced_at.slice(11, 16)}` : ''}
        {range.to === today ? ' · mis à jour toutes les cinq minutes' : ''}</p>}
    </Page>
  );
}
