// Dashboard Leads du CEO (dev 18/11/2026) : ce qui est entré aujourd'hui, ou sur une période, par canal ; ce que coûtent
// les ads Meta, créa par créa ; le travail des setters (RDV, anciens webinaires, Seconde chance) ; les appels ; les
// ventes par origine. Mêmes briques que les Statistiques de la page Finance (parts.jsx, classes fst-) : cartes, chiffre
// héros, barres jour par jour, barre empilée et lignes qui se déplient. Ce qui manque au kit est en ld-.
// Le serveur compte (/api/v1/lead-statistics), la page présente. Chaque chiffre se compare à la période précédente.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeEuro, CalendarDays, ChevronRight, Inbox, LifeBuoy, Megaphone, Phone, PhoneOutgoing, Presentation, Target, Users,
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useDrawn } from '../perfSales/motion.jsx';
import { Avatar, Card, Collapse, Num, Page, Pill, Reveal, Segmented, TableBox, Th } from '../../pages/TrackingSheetFinance/components/PageKit.jsx';
import { Fill } from '../../pages/TrackingSheetFinance/statistics/parts.jsx';
import { PeriodPicker } from '../../pages/TrackingSheetFinance/statistics/PeriodPicker.jsx';
import { barHeights, count, dayShort, eur, originGroups, pct, plural } from '../../pages/TrackingSheetFinance/statistics/model.js';
import { parisParts, parisToday } from '../../utils/parisDates.js';
import {
  byKey, canReadCalls, categoryColor, channelColor, compareWord, comparisonFor, dayLabel, delta, groupChannels,
  presetRange, PRESETS, provenanceColor, signed, signedEur,
} from './model.js';
import './leads.css';

const REFRESH_MS = 5 * 60 * 1000;
const parisClock = () => { const t = parisParts(new Date()); return `${t.hour}:${t.minute}`; };
const CREATIVES_SHOWN = 8;
const whole = (n) => count(Math.round(n));      // un chiffre qui défile reste entier
const euros = (n) => eur(Math.round(n));
const cents = (n) => eur(n, 2);

// Une lecture du serveur : la dernière demande seule compte ; la précédente reste affichée, estompée, pendant le
// rechargement. `fresh` : les chiffres affichés sont bien ceux de la période demandée. `until` (HH:MM) arrête le
// dernier jour à cette heure.
function useLeadStat(name, range, until = null) {
  const key = range ? `${range.from}/${range.to}${until ? `/${until}` : ''}` : '';
  const [state, setState] = useState({ data: null, dataKey: '', loading: Boolean(key), error: '' });
  const latest = useRef(0);
  const load = useCallback(() => {
    if (!key) return;
    const id = ++latest.current;
    const [from, to, cut] = key.split('/');
    setState((s) => ({ ...s, loading: true, error: '' }));
    apiClient.get(`/api/v1/lead-statistics/${name}?date_from=${from}&date_to=${to}${cut ? `&until=${cut}` : ''}`)
      .then((data) => { if (id === latest.current) setState({ data, dataKey: key, loading: false, error: '' }); })
      .catch((e) => {
        if (id !== latest.current) return;
        const detail = e?.data?.detail;
        setState((s) => ({ ...s, loading: false, error: typeof detail === 'string' ? detail : 'Ces chiffres sont indisponibles pour le moment.' }));
      });
  }, [name, key]);
  useEffect(() => { load(); }, [load]);
  return { ...state, fresh: Boolean(key) && state.dataKey === key, retry: load };
}

// L'écart avec la période de comparaison : vert quand c'est mieux, rouge quand c'est moins bien ; rien quand c'est pareil.
function Change({ value, previous, label, invert = false, money = false }) {
  const d = delta(value, previous);
  if (!d || !d.diff) return null;
  const good = invert ? d.diff < 0 : d.diff > 0;
  return (
    <Pill plain tone={good ? 'green' : 'red'} title={label ? `${label} : ${money ? cents(previous) : count(previous)}` : undefined}>
      {money ? signedEur(d.diff) : signed(d.diff)}
    </Pill>
  );
}

const Fact = ({ label, value, format = whole, note }) => (
  <div className="fst-fact">
    <span className="fst-fact-label">{label}</span>
    <Num className="fst-fact-value" value={value} format={format} />
    {note && <span className="fst-fact-note">{note}</span>}
  </div>
);

// Barres jour par jour, comme les mois de « Ce que paie un client » : les jours de la période sont pleins, les autres
// estompés ; une barre peut s'empiler par canal. Un clic ouvre le jour.
function DayBars({ days, inPeriod, values, stacks, format = count, tip, onPick, short = false }) {
  const drawn = useDrawn();
  const h = barHeights(values.map((v) => v ?? 0));
  return (
    <div className="fst-bars ld-days" data-short={short || undefined}>
      {days.map((day, i) => (
        <button key={day} type="button" className="fst-bar" data-in={inPeriod[i] || undefined} onClick={onPick ? () => onPick(day) : undefined}
          aria-label={`${dayShort(day)} : ${values[i] == null ? '–' : format(values[i])}`}>
          <span className="fst-tip" role="presentation">{tip(i)}</span>
          <span className="fst-bar-value fst-num">{values[i] == null ? '' : format(values[i])}</span>
          <span className="fst-bar-fill" data-stack={stacks ? true : undefined} style={{ height: `${drawn ? h[i] * 0.72 : 0}%`, transitionDelay: `${i * 22}ms` }}>
            {stacks?.[i]?.map((s) => <i key={s.key} style={{ flexGrow: s.n, background: s.color }} />)}
          </span>
          <span className="fst-bar-label">{dayLabel(day, i, days.length, short)}</span>
        </button>
      ))}
    </div>
  );
}

// ── Leads reçus ───────────────────────────────────────────────────────────────────────────────────

function LeadsCard({ state, prev, compareLabel, when, onPickDay }) {
  const d = state.data;
  const h = d?.history;
  const channels = (d?.channels || []).filter((c) => h?.channels?.[c.key]);
  const stacks = h ? h.days.map((_, i) => channels.map((c) => ({ key: c.key, n: h.channels[c.key][i], color: channelColor(c.key) })).filter((s) => s.n)) : null;
  return (
    <Card title="Leads reçus" Icon={Inbox} state={state} skeleton={380}>
      {d && (
        <>
          <div className="fst-hero">
            <div>
              <Num className="fst-big" value={d.total.leads} format={whole} duration={1100} />
              <span className="fst-big-unit">{d.total.leads > 1 ? 'leads reçus' : 'lead reçu'} {when}</span>
            </div>
            <Change value={d.total.leads} previous={prev?.total?.leads} label={compareLabel} />
          </div>
          <div className="fst-chart">
            <div className="fst-chart-title"><span>Jour par jour</span><span>{plural(h.days.length, 'jour')}</span></div>
            <DayBars days={h.days} inPeriod={h.in_period} values={h.total} stacks={stacks} onPick={onPickDay}
              tip={(i) => (
                <>
                  <b>{dayShort(h.days[i])}</b> · {plural(h.total[i], 'lead')}
                  {channels.filter((c) => h.channels[c.key][i]).map((c) => <span key={c.key}><br />{c.label} · {h.channels[c.key][i]}</span>)}
                </>
              )} />
            <div className="fst-keys">
              {channels.map((c) => <span key={c.key}><span className="fst-dot" style={{ background: channelColor(c.key) }} />{c.label}</span>)}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ── Ads Meta ──────────────────────────────────────────────────────────────────────────────────────

function AdsCard({ state, prev, compareLabel, campaignsOpen, onCampaigns }) {
  const d = state.data;
  const meta = d?.meta;
  const ads = meta?.excluding_webinar;
  const before = prev?.meta?.status === 'ok' ? prev.meta : null;
  const cats = meta?.categories || [];
  const catLeads = cats.reduce((sum, c) => sum + (c.leads || 0), 0);
  const h = d?.history;
  const byDay = Object.fromEntries((meta?.by_day || []).map((x) => [x.date, x]));
  const values = (h?.days || []).map((day) => byDay[day]?.cpl_eur ?? null);
  return (
    <Card title="Ads Meta" Icon={Megaphone} state={state} skeleton={380}>
      {meta?.status !== 'ok' ? <div className="fst-empty">Meta pas encore synchronisé sur cette période.</div> : (
        <>
          <div className="fst-hero">
            <div>
              <Num className="fst-big" value={ads?.cpl_eur} format={cents} duration={1100} />
              <span className="fst-big-unit">par lead</span>
            </div>
            <Change value={ads?.cpl_eur} previous={before?.excluding_webinar?.cpl_eur} label={compareLabel} invert money />
          </div>
          <div className="fst-facts">
            <Fact label="Leads Meta" value={ads?.leads} />
            <Fact label="Reçus dans le CRM" value={byKey(d.channels).meta_ads?.total} />
            <Fact label="Dépensé" value={ads?.spend_eur} format={euros} />
          </div>
          <div className="fst-chart">
            <div className="fst-chart-title"><span>CPL jour par jour</span></div>
            <DayBars short days={h.days} inPeriod={h.in_period} values={values} format={(n) => count(Math.round(n))}
              tip={(i) => {
                const x = byDay[h.days[i]];
                return (
                  <>
                    <b>{dayShort(h.days[i])}</b>
                    {x?.leads != null ? <><br />{cents(x.cpl_eur)} <span>par lead</span><br />{plural(x.leads, 'lead')} <span>· {euros(x.spend_eur)}</span></> : <><br /><span>Pas encore lu chez Meta</span></>}
                  </>
                );
              }} />
          </div>
          {cats.length > 0 && (
            <div className="fst-chart">
              <div className="fst-chart-title"><span>Par catégorie</span><span>leads · CPL</span></div>
              <div className="fst-dist">
                {cats.map((c) => (
                  <div key={c.category} className="fst-dist-row ld-cat" title={`${c.category} : ${plural(c.leads, 'lead')}, ${euros(c.spend_eur)} dépensés`}>
                    <span>{c.category}</span>
                    <Fill value={catLeads ? c.leads / catLeads : 0} color={categoryColor(c.category)} />
                    <span className="fst-num">{count(c.leads)}</span>
                    <span className="fst-num ld-cat-cpl">{cents(c.cpl_eur)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {meta.webinar && (
            <dl className="fst-kv">
              <dt>Webinaire</dt><dd className="fst-num">{plural(meta.webinar.leads, 'inscrit')} · {cents(meta.webinar.cpl_eur)} · {euros(meta.webinar.spend_eur)}</dd>
            </dl>
          )}
          <button type="button" className="fst-link" aria-expanded={campaignsOpen} onClick={onCampaigns}>
            {campaignsOpen ? 'Masquer les campagnes' : 'Voir les campagnes'}<ChevronRight size={13} />
          </button>
        </>
      )}
    </Card>
  );
}

// ── D'où viennent les leads ───────────────────────────────────────────────────────────────────────

function Creatives({ rows }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, CREATIVES_SHOWN);
  if (!rows.length) return <div className="fst-sub-row ld-muted"><span>Aucune créa lue chez Meta sur cette période.</span></div>;
  return (
    <>
      <table className="fst-months ld-creatives">
        <thead><tr><th>Créa</th><th>Leads</th><th>Reçus</th><th>Dépensé</th><th>CPL</th></tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={`${r.name}-${r.category}`} data-idle={!r.leads && !r.received ? true : undefined}>
              <td><span className="ld-creative">{r.name}</span>{r.category && <span className="ld-creative-cat"><span className="fst-dot" style={{ background: categoryColor(r.category) }} />{r.category}</span>}</td>
              <td className="fst-num is-strong">{r.leads == null ? '–' : count(r.leads)}</td>
              <td className="fst-num">{count(r.received)}</td>
              <td className="fst-num">{r.spend_eur == null ? '–' : euros(r.spend_eur)}</td>
              <td className="fst-num is-strong">{r.cpl_eur == null ? '–' : cents(r.cpl_eur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > CREATIVES_SHOWN && (
        <button type="button" className="fst-link" onClick={() => setAll(!all)}>{all ? 'Réduire' : `Voir les ${rows.length} créas`}</button>
      )}
    </>
  );
}

function ChannelRow({ channel: c, before, word, open, onToggle, onHover, creatives }) {
  const d = before ? delta(c.total, before.total) : null;
  const can = c.total > 0 && Boolean(creatives || c.details?.length);
  return (
    <div onMouseEnter={() => onHover(c.key)} onMouseLeave={() => onHover(null)}>
      <button type="button" className="fst-row" aria-expanded={can ? open : undefined} disabled={!can} data-zero={!c.total || undefined} onClick={onToggle}>
        <span className="fst-row-ico"><span className="fst-dot" style={{ background: c.color }} /></span>
        <span className="fst-row-name">{c.label}
          {before && (
            <small>
              {d?.diff ? <span className={d.diff > 0 ? 'ld-up' : 'ld-down'}>{signed(d.diff)}</span> : null}
              {d?.diff ? ' · ' : ''}{word} : {count(before.total)}
            </small>
          )}
        </span>
        <Fill value={c.share} color={c.color} />
        <span className="fst-row-num fst-num">{count(c.total)}<small>{pct(c.share, 0)}</small></span>
        {can ? <ChevronRight size={14} className="fst-chev" /> : <span />}
      </button>
      <Collapse open={open && can}>
        <div className="fst-sub-list">
          {creatives ? <Creatives rows={creatives} /> : c.details.map((x) => (
            <div key={x.label} className="fst-sub-row"><span title={x.label}>{x.label}</span><span /><b className="fst-num">{count(x.count)}</b></div>
          ))}
        </div>
      </Collapse>
    </div>
  );
}

function ChannelsCard({ state, prev, word }) {
  const drawn = useDrawn();
  const d = state.data;
  const [open, setOpen] = useState(null);
  const [hover, setHover] = useState(null);
  const groups = useMemo(() => groupChannels(d?.channels, d?.groups), [d]);
  const before = prev ? byKey(prev.channels) : null;
  const total = d?.total?.leads || 0;
  return (
    <Card title="D'où viennent les leads" Icon={Target} state={state} skeleton={420}>
      {d && (
        <>
          {total > 0 && (
            <div className="fst-stack" data-focus={hover || open || undefined} aria-hidden="true">
              {groups.flatMap((g) => g.channels).filter((c) => c.total).map((c) => (
                <i key={c.key} data-on={c.key === (hover || open) || undefined} title={`${c.label} : ${c.total}`}
                  style={{ flexGrow: drawn ? c.total : 0, flexBasis: 0, background: c.color }} />
              ))}
            </div>
          )}
          {groups.map((g) => (
            <div key={g.key} className="fst-group">
              <div className="fst-group-head">
                <span className="fst-group-name">{g.label}</span>
                <span className="fst-group-chip fst-num">{pct(g.share, 0)}</span>
                <span className="fst-group-count fst-num"><b>{count(g.total)}</b><i>/</i>{count(total)}</span>
              </div>
              {g.channels.map((c) => (
                <ChannelRow key={c.key} channel={c} before={before?.[c.key]} word={word} open={open === c.key} onHover={setHover}
                  onToggle={() => setOpen(open === c.key ? null : c.key)} creatives={c.key === 'meta_ads' ? d.meta?.creatives || [] : null} />
              ))}
            </div>
          ))}
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
    <Card title="Campagnes Meta" Icon={Megaphone} state={state} skeleton={320}>
      {!rows.length ? <div className="fst-empty">Aucune campagne sur cette période.</div> : (
        <TableBox minWidth={980} free={false} after={rows.length > 12 && (
          <button type="button" className="fst-link" onClick={() => setAll(!all)}>{all ? 'Réduire' : `Voir les ${rows.length} campagnes`}</button>)}>
          <thead><tr><Th>Campagne</Th><Th>Catégorie</Th><Th num>Dépense</Th><Th num>Impressions</Th><Th num>Clics</Th><Th num>CTR</Th>
            <Th num>Leads Meta</Th><Th num>Reçus</Th><Th num>CPL</Th><Th num>Ventes</Th><Th num>CA</Th><Th num>ROAS</Th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.campaign}>
                <td className="is-wrap">{r.campaign}</td>
                <td><span className="ld-creative-cat"><span className="fst-dot" style={{ background: categoryColor(r.category) }} />{r.category}</span></td>
                <td className="is-num">{euros(r.spend_eur)}</td><td className="is-num">{count(r.impressions)}</td>
                <td className="is-num">{count(r.clicks)}</td><td className="is-num">{pct(r.ctr, 2)}</td><td className="is-num">{count(r.leads_meta)}</td>
                <td className="is-num">{count(r.received_in_crm)}</td><td className="is-num">{cents(r.cpl_eur)}</td>
                <td className="is-num">{count(r.sales)}</td><td className="is-num">{euros(r.revenue_eur)}</td>
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

// Une barre par personne, découpée par part (comme « Par sales ») ; le détail au survol.
function PeopleBars({ rows, parts, colorOf, labelOf, total = (r) => r.total, tip }) {
  const drawn = useDrawn();
  const largest = Math.max(1, ...rows.map(total));
  const present = [...new Set(rows.flatMap((r) => parts(r).map((p) => p.key)))];
  if (!rows.length) return <div className="fst-empty">Personne sur cette période.</div>;
  return (
    <>
      {rows.map((r) => (
        <div key={r.name} className="fst-hbar">
          <span className="fst-tip" role="presentation">{tip(r)}</span>
          <Avatar name={r.name} />
          <span className="fst-hbar-name">{r.name}</span>
          <span className="fst-hbar-track" style={{ width: `${(total(r) / largest) * 100}%` }}>
            {parts(r).filter((p) => p.n).map((p) => <i key={p.key} style={{ width: `${drawn && total(r) ? (p.n / total(r)) * 100 : 0}%`, background: colorOf(p.key) }} />)}
          </span>
          <span className="fst-hbar-num fst-num">{count(total(r))}</span>
        </div>
      ))}
      {labelOf && present.length > 1 && (
        <div className="fst-keys">{present.map((k) => <span key={k}><span className="fst-dot" style={{ background: colorOf(k) }} />{labelOf(k)}</span>)}</div>
      )}
    </>
  );
}

function SettersCard({ state, prev, compareLabel }) {
  const drawn = useDrawn();
  const s = state.data?.setters;
  const rows = (s?.by_provenance || []).filter((p) => p.rdv_placed);
  const held = (s?.by_provenance || []).reduce((sum, p) => sum + p.rdv_qualified, 0);
  return (
    <Card title="RDV posés par les setters" Icon={PhoneOutgoing} state={state} skeleton={360}>
      {s && (
        <>
          <div className="fst-hero">
            <div><Num className="fst-big" value={s.rdv_placed} format={whole} duration={1100} /><span className="fst-big-unit">RDV posés</span></div>
            <Change value={s.rdv_placed} previous={prev?.setters?.rdv_placed} label={compareLabel} />
          </div>
          <div className="fst-facts"><Fact label="Honorés à ce jour" value={held} /></div>
          {rows.length > 0 && (
            <>
              <div className="fst-split" aria-hidden="true">
                {rows.map((p) => <i key={p.key} style={{ flexGrow: drawn ? p.rdv_placed : 0, flexBasis: 0, background: provenanceColor(p.key) }} />)}
              </div>
              <div className="fst-legend">
                {rows.map((p) => (
                  <div key={p.key} className="fst-legend-row">
                    <span className="fst-dot" style={{ background: provenanceColor(p.key) }} />{p.label}
                    <b className="fst-num">{count(p.rdv_placed)}</b>
                    <small className="fst-num">{pct(s.rdv_placed ? p.rdv_placed / s.rdv_placed : 0, 0)}</small>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
}

function SetterPeopleCard({ state }) {
  const s = state.data?.setters;
  const labels = Object.fromEntries((s?.by_provenance || []).map((p) => [p.key, p.label]));
  const rows = (s?.setters || []).map((r) => ({ ...r, total: r.rdv_placed }));
  return (
    <Card title="Par setter" Icon={Users} state={state} skeleton={360}>
      {s && (
        <PeopleBars rows={rows} colorOf={provenanceColor} labelOf={(k) => labels[k] || k}
          parts={(r) => Object.entries(r.by_provenance).map(([key, n]) => ({ key, n }))}
          tip={(r) => (
            <>
              <b>{r.name}</b>
              {Object.entries(r.by_provenance).map(([k, n]) => <span key={k}><br />{labels[k] || k} · {n}</span>)}
            </>
          )} />
      )}
    </Card>
  );
}

function OldWebinarCard({ state, prev, compareLabel }) {
  const old = state.data?.old_webinar;
  return (
    <Card title="Anciens webinaires" Icon={Presentation} state={state} skeleton={300}>
      {old && (
        <>
          <div className="fst-hero">
            <div><Num className="fst-big" value={old.worked} format={whole} duration={1100} /><span className="fst-big-unit">fiches rappelées</span></div>
            <Change value={old.worked} previous={prev?.old_webinar?.worked} label={compareLabel} />
          </div>
          <div className="fst-facts"><Fact label="RDV posés" value={old.rdv_placed} /></div>
          <div className="fst-chart">
            <PeopleBars rows={(old.setters || []).map((r) => ({ ...r, total: r.worked }))} colorOf={() => provenanceColor('webinar_recall')}
              parts={(r) => [{ key: 'worked', n: r.worked }]} tip={(r) => <><b>{r.name}</b><br />{plural(r.worked, 'fiche rappelée', 'fiches rappelées')}</>} />
          </div>
        </>
      )}
    </Card>
  );
}

function SecondChanceCard({ state, prev, compareLabel }) {
  const sc = state.data?.second_chance;
  return (
    <Card title="Seconde chance" Icon={LifeBuoy} state={state} skeleton={300}>
      {sc && (
        <>
          <div className="fst-hero">
            <div><Num className="fst-big" value={sc.claimed} format={whole} duration={1100} /><span className="fst-big-unit">leads repris</span></div>
            <Change value={sc.claimed} previous={prev?.second_chance?.claimed} label={compareLabel} />
          </div>
          <div className="fst-facts"><Fact label="RDV reposés" value={sc.booked} /></div>
          <div className="fst-chart">
            <PeopleBars rows={(sc.setters || []).map((r) => ({ ...r, total: r.claimed }))} colorOf={(k) => (k === 'booked' ? provenanceColor('second_chance') : '#e5e1db')}
              parts={(r) => [{ key: 'booked', n: r.booked }, { key: 'open', n: r.claimed - r.booked }]}
              tip={(r) => <><b>{r.name}</b><br />{plural(r.claimed, 'lead repris', 'leads repris')}<br /><span>{plural(r.booked, 'RDV reposé', 'RDV reposés')}</span></>} />
          </div>
        </>
      )}
    </Card>
  );
}

// ── Appels ────────────────────────────────────────────────────────────────────────────────────────

function CallsCard({ state, tooLong }) {
  const [team, setTeam] = useState('setters');
  const block = state.data?.[team];
  const people = (block?.people || []).filter((p) => p.status === 'ok').map((p) => ({ ...p, total: p.total.calls }));
  return (
    <Card title="Appels" Icon={Phone} state={tooLong ? null : state} skeleton={360}
      actions={<Segmented small value={team} onChange={setTeam} label="Équipe" options={[{ key: 'setters', label: 'Setters' }, { key: 'sales', label: 'Sales' }]} />}>
      {tooLong ? <div className="fst-empty">Les appels se lisent sur 31 jours au plus.</div> : block && (
        <>
          <div className="fst-hero">
            <div><Num className="fst-big" value={block.team.calls} format={whole} duration={1100} /><span className="fst-big-unit">appels</span></div>
          </div>
          <div className="fst-facts">
            <Fact label="Sortants" value={block.team.outbound} />
            <Fact label="Décrochés" value={block.team.answered} />
            <Fact label="Taux de décroché" value={block.team.outbound ? block.team.answered / block.team.outbound : null} format={(n) => pct(n, 0)} />
          </div>
          <div className="fst-chart">
            <PeopleBars rows={people} colorOf={(k) => (k === 'answered' ? 'var(--charcoal)' : '#e5e1db')} labelOf={(k) => (k === 'answered' ? 'Décrochés' : 'Sans réponse')}
              parts={(p) => [{ key: 'answered', n: p.total.answered || 0 }, { key: 'other', n: Math.max(0, (p.total.calls || 0) - (p.total.answered || 0)) }]}
              tip={(p) => <><b>{p.name}</b><br />{plural(p.total.calls, 'appel')} · {plural(p.total.answered, 'décroché')}<br /><span>{Math.round((p.total.duration_seconds || 0) / 60)} min au téléphone</span></>} />
          </div>
          {block.team.missing?.length > 0 && <dl className="fst-kv"><dt>Sans compte Allo</dt><dd>{block.team.missing.join(', ')}</dd></dl>}
        </>
      )}
    </Card>
  );
}

// ── Ventes ────────────────────────────────────────────────────────────────────────────────────────

function SalesCard({ state, prev, compareLabel }) {
  const drawn = useDrawn();
  const sales = state.data?.sales;
  const groups = useMemo(() => originGroups(sales?.by_origin), [sales]);
  const total = sales?.totals?.sales || 0;
  return (
    <Card title="Ventes signées" Icon={BadgeEuro} state={state} skeleton={360}>
      {sales && (
        <>
          <div className="fst-hero">
            <div><Num className="fst-big" value={total} format={whole} duration={1100} /><span className="fst-big-unit">{total > 1 ? 'ventes' : 'vente'}</span></div>
            <Change value={total} previous={prev?.sales?.totals?.sales} label={compareLabel} />
          </div>
          <div className="fst-facts">
            <Fact label="Contrats signés, annuel HT" value={sales.totals.revenue_eur} format={euros} />
            <Fact label="Cash à la signature" value={sales.totals.cash_eur} format={euros} />
          </div>
          {total > 0 && (
            <div className="fst-chart">
              <div className="fst-stack" aria-hidden="true">
                {groups.flatMap((g) => g.items).map((o) => <i key={o.key} style={{ flexGrow: drawn ? o.sales : 0, flexBasis: 0, background: o.color }} />)}
              </div>
              {groups.map((g) => (
                <div key={g.key} className="fst-group">
                  <div className="fst-group-head">
                    <span className="fst-group-name">{g.label}</span>
                    <span className="fst-group-chip fst-num">{pct(g.share, 0)}</span>
                    <span className="fst-group-count fst-num"><b>{count(g.sales)}</b><i>/</i>{count(total)}</span>
                  </div>
                  {g.items.map((o) => (
                    <div key={o.key} className="fst-row ld-static" title={o.definition}>
                      <span className="fst-row-ico"><span className="fst-dot" style={{ background: o.color }} /></span>
                      <span className="fst-row-name">{o.label}<small>{euros(o.revenue_eur)} annuel HT</small></span>
                      <Fill value={o.share} color={o.color} />
                      <span className="fst-row-num fst-num">{count(o.sales)}<small>{pct(o.share, 0)}</small></span>
                      <span />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────────────────────────

const TABS = [{ key: 'leads', label: 'Canaux et ads' }, { key: 'setters', label: 'Setters' }, { key: 'calls', label: 'Appels' }, { key: 'sales', label: 'Ventes' }];

export default function LeadsDashboard() {
  const today = parisToday();
  const [preset, setPreset] = useState('today');
  const [custom, setCustom] = useState(null);
  const [compare, setCompare] = useState(true);
  const [tab, setTab] = useState('leads');
  const [campaignsOpen, setCampaignsOpen] = useState(false);
  const range = useMemo(() => (custom ? { from: custom.from, to: custom.to } : presetRange(preset, today)), [custom, preset, today]);
  const compareKey = custom ? 'custom' : preset;
  const prevRange = useMemo(() => comparisonFor(compareKey, range), [compareKey, range]);
  // Une période qui finit aujourd'hui se compare à la même heure : hier jusqu'à 10 h 30 face à aujourd'hui à 10 h 30.
  const [clock, setClock] = useState(parisClock);
  const until = range.to === today ? clock : null;
  const word = compareWord(compareKey, range);
  const compareLabel = compare
    ? `${word.charAt(0).toUpperCase()}${word.slice(1)} (${dayShort(prevRange.from)}${prevRange.from === prevRange.to ? '' : ` – ${dayShort(prevRange.to)}`}${until ? `, jusqu'à ${until.replace(':', ' h ')}` : ''})`
    : null;

  const current = useLeadStat('overview', range);
  const previous = useLeadStat('overview', compare ? prevRange : null, until);
  const tooLong = !canReadCalls(range);
  const calls = useLeadStat('calls', tab === 'calls' && !tooLong ? range : null);
  const campaigns = useLeadStat('campaigns', tab === 'leads' && campaignsOpen ? range : null);

  // Le jour en cours se met à jour tout seul, toutes les cinq minutes.
  const { retry } = current;
  useEffect(() => {
    if (range.to !== today) return undefined;
    const timer = setInterval(() => { if (!document.hidden) { setClock(parisClock()); retry(); } }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [range.to, today, retry]);

  const d = current.fresh ? current.data : null;
  const p = compare && current.fresh && previous.fresh ? previous.data : null;
  const shownRange = current.data?.period ? { from: current.data.period.from, to: current.data.period.to } : range;
  const when = shownRange.from === shownRange.to
    ? (shownRange.to === today ? "aujourd'hui" : `le ${dayShort(shownRange.to)}`)
    : `du ${dayShort(shownRange.from)} au ${dayShort(shownRange.to)}`;
  const choose = useCallback((next) => { setClock(parisClock()); setCustom(next); }, []);
  const pickDay = useCallback((day) => choose({ from: day, to: day }), [choose]);

  return (
    <Page title="Leads"
      actions={(
        <div className="ld-actions">
          <Segmented small value={custom ? null : preset} label="Période"
            onChange={(key) => { choose(null); setPreset(key); }} options={PRESETS} />
          <PeriodPicker value={custom} onChange={choose} label="Autre période" />
          <button type="button" className="fst-btn is-small" aria-pressed={compare} onClick={() => setCompare(!compare)}>
            <CalendarDays size={14} />{compare ? `Comparé à ${word}${until ? ' à la même heure' : ''}` : 'Sans comparaison'}
          </button>
        </div>
      )}>
      <div className="ld-tabs"><Segmented value={tab} onChange={setTab} label="Vue" options={TABS} /></div>

      {tab === 'leads' && (
        <>
          <Reveal className="fst-grid">
            <LeadsCard state={current} prev={p} compareLabel={compareLabel} when={when} onPickDay={pickDay} />
            <AdsCard state={current} prev={p} compareLabel={compareLabel} campaignsOpen={campaignsOpen} onCampaigns={() => setCampaignsOpen(!campaignsOpen)} />
          </Reveal>
          <Collapse open={campaignsOpen}>
            <Reveal className="ld-gap"><CampaignsCard state={campaigns} /></Reveal>
          </Collapse>
          <Reveal className="ld-gap"><ChannelsCard state={current} prev={p} word={word} /></Reveal>
        </>
      )}
      {tab === 'setters' && (
        <>
          <Reveal className="fst-grid is-even">
            <SettersCard state={current} prev={p} compareLabel={compareLabel} />
            <SetterPeopleCard state={current} />
          </Reveal>
          <Reveal className="fst-grid is-even ld-gap">
            <OldWebinarCard state={current} prev={p} compareLabel={compareLabel} />
            <SecondChanceCard state={current} prev={p} compareLabel={compareLabel} />
          </Reveal>
        </>
      )}
      {tab === 'calls' && <Reveal><CallsCard state={calls} tooLong={tooLong} /></Reveal>}
      {tab === 'sales' && <Reveal><SalesCard state={current} prev={p} compareLabel={compareLabel} /></Reveal>}
      {d && (
        <p className="ld-source">
          Calculé à {d.period.generated_at.slice(11, 16).replace(':', ' h ')}{d.meta?.synced_at ? ` · Meta lu à ${d.meta.synced_at.slice(11, 16).replace(':', ' h ')}` : ''}
        </p>
      )}
    </Page>
  );
}
