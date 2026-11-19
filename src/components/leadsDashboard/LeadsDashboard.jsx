// Dashboard Leads du CEO (dev 18/11/2026) : ce qui est entré aujourd'hui, ou sur une période, par canal ; ce que coûtent
// les ads Meta, créa par créa ; le travail des setters (RDV, anciens webinaires, Seconde chance) ; les appels ; les
// ventes par origine. Mêmes briques que les Statistiques de la page Finance (parts.jsx, classes fst-) : cartes, chiffre
// héros, barres jour par jour, barre empilée et lignes qui se déplient. Ce qui manque au kit est en ld-.
// Le serveur compte (/api/v1/lead-statistics), la page présente. Chaque chiffre se compare à la période précédente.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  ArrowDown, ArrowDownRight, ArrowUpRight, BadgeEuro, Briefcase, Calculator, CalendarCheck, CalendarClock, CalendarDays, ChevronRight, CircleDot, CopyX, Gift,
  Globe, Handshake, History, Inbox, LifeBuoy, List, Megaphone, Phone, PhoneOutgoing, Presentation, Search, Sparkles, Target, TrendingDown, TrendingUp,
  Users, X,
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { EASE, useCountUp, useDrawn, useRevealed } from '../perfSales/motion.jsx';
import { Avatar, Card, Collapse, Num, Page, Pill, Reveal, Segmented, TableBox, Th } from '../../pages/TrackingSheetFinance/components/PageKit.jsx';
import { Fill, ProgressRing } from '../../pages/TrackingSheetFinance/statistics/parts.jsx';
import { PeriodPicker } from '../../pages/TrackingSheetFinance/statistics/PeriodPicker.jsx';
import { barHeights, count, dayShort, eur, originGroups, pct, plural } from '../../pages/TrackingSheetFinance/statistics/model.js';
import { parisParts, parisToday } from '../../utils/parisDates.js';
import {
  byKey, canReadCalls, categoryColor, categoryTone, channelColor, channelTone, compareWord, TONE_INK, comparisonFor, dayLabel, delta, groupChannels,
  byWeek, headcountText, presetRange, PRESETS, provenanceColor, revenueText,
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

// L'écart avec la période de comparaison, dans la ligne du chiffre : la flèche et l'écart en couleur (vert quand c'est
// mieux, rouge quand c'est moins bien), puis la valeur comparée. Dans un tableau : la valeur d'abord, l'écart ensuite.
// `cmp` : { word, label } de la comparaison, null sans comparaison.
const capital = (w) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`;
function Versus({ value, previous, cmp, invert = false, money = false, inTable = false, bare = false }) {
  const d = delta(value, previous);
  if (!cmp || !d) return null;
  const fmt = money === 'whole' ? euros : money ? cents : count;
  const diff = money === 'whole' ? Math.round(d.diff) : d.diff;
  const tone = !diff ? 'flat' : (invert ? diff < 0 : diff > 0) ? 'good' : 'bad';
  const Arrow = diff > 0 ? ArrowUpRight : ArrowDownRight;
  if (inTable) {
    return (
      <span className="ld-vs" data-tone={tone} data-table title={`${cmp.label} : ${fmt(previous)}`}>
        <span>{fmt(previous)}</span>{diff ? <b><Arrow size={13} strokeWidth={2.4} />{bare ? null : fmt(Math.abs(diff))}</b> : null}
      </span>
    );
  }
  const Trend = diff > 0 ? TrendingUp : TrendingDown;
  return (
    <span className="ld-vs" title={cmp.label}>
      <span className="ld-vs-ref">{fmt(previous)} {cmp.word}</span>
      <span className="ld-chip" data-tone={tone}>{diff ? <><Trend size={15} strokeWidth={2.2} />{diff > 0 ? '+' : '−'}{fmt(Math.abs(diff))}</> : 'autant'}</span>
    </span>
  );
}

// Un grand chiffre qui défile jusqu'à sa valeur ; en euros, les centimes s'estompent.
function BigNumber({ value, money = false }) {
  const revealed = useRevealed();
  const known = value != null && Number.isFinite(Number(value));
  const shown = useCountUp(revealed && known ? Number(value) : 0, { duration: 1100 });
  if (!known) return <span className="ld-big">–</span>;
  if (money === 'cents') {
    const [units, decimals] = cents(shown).split(',');
    return <span className="ld-big fst-num">{units}<span className="ld-big-small">,{decimals}</span></span>;
  }
  return <span className="ld-big fst-num">{money ? euros(shown) : whole(shown)}</span>;
}

// Un anneau partagé entre plusieurs parts (une teinte chacune), tracé depuis midi.
function Donut({ parts, size = 132, stroke = 12, label, children }) {
  const drawn = useDrawn();
  const total = parts.reduce((sum, p) => sum + (p.value || 0), 0);
  const radius = (size - stroke) / 2;
  const shown = parts.filter((p) => p.value > 0);
  const gap = shown.length > 1 ? 1.4 : 0;
  let offset = 0;
  return (
    <div className="fst-ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {shown.map((p) => {
          const length = total ? (p.value / total) * 100 : 0;
          const start = offset;
          offset += length;
          return (
            <circle key={p.key} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={p.color} strokeWidth={stroke} pathLength="100"
              strokeDasharray={`${drawn ? Math.max(0.5, length - gap) : 0} 100`} strokeDashoffset={-start}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 1100ms cubic-bezier(.22,1,.36,1)' }} />
          );
        })}
      </svg>
      <div className="fst-ring-center">{children}</div>
    </div>
  );
}

// Une stat en pastille, avec son petit anneau (la part qu'elle représente).
const StatChip = ({ value, label, share, sub, color, icon }) => (
  <div className="ld-stat">
    <ProgressRing value={share || 0} size={40} stroke={3.5} color={color} label={label}><span className="ld-stat-ico" style={{ color }}>{icon}</span></ProgressRing>
    <div className="ld-stat-text"><b className="fst-num">{count(value)} <span>{label}</span></b><small>{sub}</small></div>
  </div>
);

// Étiquette pastel d'un canal (charte Owner) : son icône dans un petit carré teinté, son nom à l'encre du ton.
const CHANNEL_ICON = {
  meta_ads: Megaphone, google_ads: Search, chatgpt_ads: Sparkles, partners: Handshake, webinar: Presentation, ccs: PhoneOutgoing,
  cold_call: Phone, referral: Gift, linkedin: Briefcase, web: Globe, simulator: Calculator, other: CircleDot,
};
function ChannelTag({ channel, label }) {
  const Icon = CHANNEL_ICON[channel] || CircleDot;
  return <span className="fst-tag ld-tag" data-tone={channelTone(channel)}><i className="ld-tag-ico"><Icon size={12} strokeWidth={2.2} /></i>{label}</span>;
}

// La légende d'un graphique : l'étiquette de chaque canal.
const Keys = ({ items }) => <div className="ld-keys">{items.map((x) => <ChannelTag key={x.key} channel={x.key} label={x.label} />)}</div>;

const Fact = ({ label, value, format = whole, note }) => (
  <div className="fst-fact">
    <span className="fst-fact-label">{label}</span>
    <Num className="fst-fact-value" value={value} format={format} />
    {note && <span className="fst-fact-note">{note}</span>}
  </div>
);

// Barres jour par jour, comme les mois de « Ce que paie un client » : les jours de la période sont pleins, les autres
// estompés ; une barre peut s'empiler par canal. Un clic ouvre le jour.
function DayBars({ days, inPeriod, values, stacks, format = count, tip, onPick, short = false, weeks = false }) {
  const drawn = useDrawn();
  const h = barHeights(values.map((v) => v ?? 0));
  return (
    <div className="fst-bars ld-days" data-short={short || undefined} data-dense={days.length > 16 || undefined}>
      {days.map((day, i) => (
        <button key={day} type="button" className="fst-bar" data-in={inPeriod[i] || undefined} onClick={onPick ? () => onPick(day) : undefined}
          aria-label={`${dayShort(day)} : ${values[i] == null ? '–' : format(values[i])}`}>
          <span className="fst-tip" role="presentation">{tip(i)}</span>
          <span className="fst-bar-value fst-num">{values[i] == null ? '' : format(values[i])}</span>
          <span className="fst-bar-fill" data-stack={stacks ? true : undefined} style={{ height: `${drawn ? h[i] * 0.72 : 0}%`, transitionDelay: `${i * 22}ms` }}>
            {stacks?.[i]?.map((s) => <i key={s.key} style={{ flexGrow: s.n, background: s.color }} />)}
          </span>
          <span className="fst-bar-label">{weeks ? (i % Math.ceil(days.length / 7) ? '' : dayShort(day)) : dayLabel(day, i, days.length, short)}</span>
        </button>
      ))}
    </div>
  );
}

// ── Leads reçus ───────────────────────────────────────────────────────────────────────────────────

function LeadsCard({ state, prev, cmp, when, onPickDay, onSeeLeads }) {
  const d = state.data;
  const h = useMemo(() => (d?.history ? byWeek(d.history) : null), [d]);
  const channels = (d?.channels || []).filter((c) => h?.channels?.[c.key]);
  const stacks = h ? h.days.map((_, i) => channels.map((c) => ({ key: c.key, n: h.channels[c.key][i], color: channelColor(c.key) })).filter((s) => s.n)) : null;
  return (
    <Card title="Leads reçus" Icon={Inbox} state={state} skeleton={380} className="ld-glow" data-glow="blue"
      actions={d && <button type="button" className="fst-btn is-small" onClick={() => onSeeLeads(null)}><List size={14} />Voir les leads</button>}>
      {d && (
        <>
          <div className="ld-hero">
            <button type="button" className="ld-hero-btn" onClick={() => onSeeLeads(null)} title="Voir les leads">
              <BigNumber value={d.total.leads} />
            </button>
            <div className="ld-hero-sub">
              <span>{d.total.leads > 1 ? 'leads reçus' : 'lead reçu'} {when}</span>
              <Versus value={d.total.leads} previous={prev?.total?.leads} cmp={cmp} />
            </div>
          </div>
          <div className="ld-stats">
            <StatChip value={d.total.r1} label={d.total.r1 > 1 ? 'R1 placés' : 'R1 placé'} share={d.total.leads ? d.total.r1 / d.total.leads : 0}
              sub={`${pct(d.total.leads ? d.total.r1 / d.total.leads : 0, 0)} des leads`} color={TONE_INK.green} icon={<CalendarCheck size={15} strokeWidth={2} />} />
            <StatChip value={d.total.r2} label={d.total.r2 > 1 ? 'R2 placés' : 'R2 placé'} share={d.total.leads ? d.total.r2 / d.total.leads : 0}
              sub={`${pct(d.total.leads ? d.total.r2 / d.total.leads : 0, 0)} des leads`} color={TONE_INK.blue} icon={<CalendarClock size={15} strokeWidth={2} />} />
            <StatChip value={d.total.duplicates} label={d.total.duplicates > 1 ? 'doublons écartés' : 'doublon écarté'}
              share={d.total.raw ? d.total.duplicates / d.total.raw : 0} sub={`sur ${plural(d.total.raw, 'fiche')}`} color={TONE_INK.peach} icon={<CopyX size={15} strokeWidth={2} />} />
          </div>
          <div className="fst-chart">
            <div className="fst-chart-title"><span>{h.weeks ? 'Semaine par semaine' : 'Jour par jour'}</span><span>{h.weeks ? plural(h.days.length, 'semaine') : plural(h.days.length, 'jour')}</span></div>
            <DayBars days={h.days} inPeriod={h.in_period} values={h.total} stacks={stacks} onPick={h.weeks ? undefined : onPickDay} weeks={h.weeks}
              tip={(i) => (
                <>
                  <b>{h.weeks ? `Semaine du ${dayShort(h.days[i])}` : dayShort(h.days[i])}</b> · {plural(h.total[i], 'lead')}
                  {channels.filter((c) => h.channels[c.key][i]).map((c) => <span key={c.key}><br />{c.label} · {h.channels[c.key][i]}</span>)}
                </>
              )} />
            <Keys items={channels.map((c) => ({ key: c.key, label: c.label, color: channelColor(c.key) }))} />
          </div>
        </>
      )}
    </Card>
  );
}

// ── Ads Meta ──────────────────────────────────────────────────────────────────────────────────────

// Pour rapprocher les chiffres de l'équipe ads : chaque compte des deux portefeuilles Owner, et ce qui est arrivé chez
// nous (fiches brutes, doublons écartés).
function AdsCheck({ meta, channels }) {
  const accounts = meta?.accounts || [];
  const by = byKey(channels);
  const ads = by.meta_ads || { raw: 0, duplicates: 0 };
  const web = by.webinar || { raw: 0, duplicates: 0, details: [] };
  const direct = (web.details || []).flatMap((x) => x.children).filter((x) => x.label === "Page d'inscription").reduce((sum, x) => sum + x.count, 0);
  const dups = ads.duplicates + web.duplicates;
  return (
    <div className="ld-check">
      <Branch label="Par compte et doublons" note={`${plural(accounts.length, 'compte')} · ${dups ? plural(dups, 'doublon') : 'aucun doublon'}`}>
        <table className="fst-months ld-table">
          <thead><tr><th>Compte publicitaire</th><th>Leads Meta</th><th>Dépensé</th></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.account_id}>
                <td><span className="is-strong">{a.portfolio}</span><span className="ld-line-unit">compte {a.account_id}</span></td>
                <td className="fst-num">{count(a.leads)}</td><td className="fst-num">{euros(a.spend_eur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="fst-kv">
          <dt>Fiches des ads reçues chez nous</dt><dd className="fst-num">{count(ads.raw)} · {ads.duplicates ? plural(ads.duplicates, 'doublon') : 'aucun doublon'}</dd>
          <dt>Inscrits au webinaire (landing)</dt><dd className="fst-num">{count(web.raw)}{direct ? `, dont ${count(direct)} en direct` : ''} · {web.duplicates ? plural(web.duplicates, 'doublon') : 'aucun doublon'}</dd>
        </dl>
      </Branch>
    </div>
  );
}

// Le récap des ads, comme celui que l'équipe ads envoie chaque jour : le coût par lead en grand, l'anneau des leads Meta
// par catégorie, puis le tableau par catégorie (leads, CPL, dépense), le total webinaire compris et la ligne de la
// période comparée. Une catégorie qui dépense sans lead ressort en rouge.
const colorOfCategory = (category) => (category === 'WEBINAIRE' ? channelColor('webinar') : categoryColor(category));

// Ce qui est arrivé chez nous par les ads Meta (fiches des ads et inscrits venus du formulaire Meta), à côté des leads
// comptés par Meta ; les inscrits en direct sur la LP du webinaire n'en font pas partie, ni le simulateur du site
// (organique).
function arrivedFromAds(channels) {
  const by = byKey(channels);
  const children = (by.webinar?.details || []).flatMap((x) => x.children || []);
  const sum = (label) => children.filter((x) => x.label === label).reduce((total, x) => total + x.count, 0);
  return { meta: (by.meta_ads?.total || 0) + sum('Formulaire Meta'), direct: sum("Page d'inscription") };
}

function AdsCard({ state, prev, cmp, campaignsOpen, onCampaigns }) {
  const d = state.data;
  const meta = d?.meta;
  const total = meta?.total;
  const before = prev?.meta?.status === 'ok' ? prev.meta.total : null;
  const rows = [...(meta?.categories || []), ...(meta?.webinar ? [{ category: 'WEBINAIRE', ...meta.webinar }] : [])];
  const h = useMemo(() => (d?.history ? byWeek(d.history, meta?.by_day) : null), [d, meta]);
  const byDay = Object.fromEntries((h?.meta || []).map((x) => [x.date, x]));
  const values = (h?.days || []).map((day) => byDay[day]?.cpl_eur ?? null);
  const arrived = arrivedFromAds(d?.channels);
  return (
    <Card title="Ads Meta" Icon={Megaphone} state={state} skeleton={420} className="ld-glow" data-glow="lilac"
      actions={meta?.synced_at && (
        <span className="ld-synced">Meta lu {meta.synced_at.slice(0, 10) === parisToday() ? '' : `le ${dayShort(meta.synced_at)} `}à {meta.synced_at.slice(11, 16).replace(':', ' h ')}</span>
      )}>
      {meta?.status !== 'ok' ? <div className="fst-empty">Meta pas encore synchronisé sur cette période.</div> : (
        <>
          <div className="ld-ads-top">
            <div className="ld-hero">
              <span className="ld-eyebrow">Coût par lead</span>
              <BigNumber value={total?.cpl_eur} money="cents" />
              <div className="ld-hero-sub"><span>{euros(total?.spend_eur || 0)} dépensés · {plural(total?.leads || 0, 'lead Meta', 'leads Meta')}</span></div>
              <div className="ld-hero-sub ld-arrived">
                <span>Reçus chez nous : <b className="fst-num">{count(arrived.meta)}</b> par Meta{arrived.direct ? <> + <b className="fst-num">{count(arrived.direct)}</b> via la LP du webinaire</> : null}</span>
              </div>
              <div className="ld-hero-sub"><Versus value={total?.cpl_eur} previous={before?.cpl_eur} cmp={cmp} invert money /></div>
            </div>
            <Donut parts={rows.map((c) => ({ key: c.category, value: c.leads, color: colorOfCategory(c.category) }))}
              label={`${plural(total?.leads || 0, 'lead Meta', 'leads Meta')} par catégorie`}>
              <b className="ld-donut-num fst-num">{count(total?.leads)}</b><small className="ld-donut-sub">leads Meta</small>
            </Donut>
          </div>
          <table className="fst-months ld-recap">
            <thead><tr><th>Catégorie</th><th>Leads</th><th>CPL</th><th>Dépensé</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.category} data-idle={!c.leads || undefined}>
                  <td><span className="ld-mark-label" style={{ color: TONE_INK[categoryTone(c.category)] }}><i className="ld-capsule" style={{ background: colorOfCategory(c.category) }} />{c.category}</span></td>
                  <td className="fst-num is-strong">{count(c.leads)}</td>
                  <td className="fst-num ld-recap-cpl" style={c.leads ? { color: TONE_INK[categoryTone(c.category)] } : undefined}>{c.leads ? cents(c.cpl_eur) : 'aucun lead'}</td>
                  <td className="fst-num">{euros(c.spend_eur)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td>Total</td><td className="fst-num">{count(total?.leads)}</td><td className="fst-num">{cents(total?.cpl_eur)}</td><td className="fst-num">{euros(total?.spend_eur)}</td></tr>
              {cmp && before && (
                <tr className="ld-recap-vs">
                  <td>{capital(cmp.word)}</td>
                  <td><Versus value={total?.leads} previous={before.leads} cmp={cmp} inTable bare /></td>
                  <td><Versus value={total?.cpl_eur} previous={before.cpl_eur} cmp={cmp} invert money inTable bare /></td>
                  <td><Versus value={total?.spend_eur} previous={before.spend_eur} cmp={cmp} money="whole" inTable bare /></td>
                </tr>
              )}
            </tfoot>
          </table>
          <AdsCheck meta={meta} channels={d.channels} />
          <div className="fst-chart">
            <div className="fst-chart-title"><span>{h.weeks ? 'CPL semaine par semaine' : 'CPL jour par jour'}</span></div>
            <DayBars short days={h.days} inPeriod={h.in_period} values={values} format={(n) => count(Math.round(n))} weeks={h.weeks}
              tip={(i) => {
                const x = byDay[h.days[i]];
                return (
                  <>
                    <b>{h.weeks ? `Semaine du ${dayShort(h.days[i])}` : dayShort(h.days[i])}</b>
                    {x?.leads != null ? <><br />{x.cpl_eur == null ? 'Aucun lead' : <>CPL {cents(x.cpl_eur)}</>}<br />{plural(x.leads, 'lead Meta', 'leads Meta')} <span>· {euros(x.spend_eur)}</span></> : <><br /><span>Pas encore lu chez Meta</span></>}
                  </>
                );
              }} />
          </div>
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

// Une branche du détail : son nombre, et ce qu'elle contient au clic.
function Branch({ label, n, note, tone, children }) {
  const [open, setOpen] = useState(false);
  const can = Boolean(children);
  return (
    <div className="ld-branch">
      <button type="button" className="ld-branch-row" aria-expanded={can ? open : undefined} disabled={!can} data-tone={tone} onClick={() => setOpen(!open)}>
        {can ? <ChevronRight size={13} className="fst-chev" /> : <span />}
        <span className="ld-branch-label" title={label}>{label}</span>
        <span className="ld-branch-note">{note}</span>
        <b className="fst-num">{n == null ? '' : count(n)}</b>
      </button>
      {can && <Collapse open={open}><div className="ld-branch-body">{children}</div></Collapse>}
    </div>
  );
}

// Le détail d'un canal : d'abord où le lead est arrivé chez nous, puis ce qui le précise. Les ads Meta : l'origine de la
// fiche, puis ses créas ; à part, les créas qui ont dépensé sans amener de lead.
function ChannelDetails({ channel: c, creatives }) {
  if (c.key === 'meta_ads') {
    const known = Object.fromEntries((creatives || []).map((r) => [r.key, r]));
    const idle = (creatives || []).filter((r) => !r.received && (r.spend_eur || 0) >= 1);
    return (
      <>
        {c.details.map((o) => (
          <Branch key={o.label} label={o.label} n={o.count} note={plural(o.children.length, 'créa')}>
            <Creatives rows={o.children.map((ch) => ({ ...(known[ch.label] || { key: ch.label, name: 'Sans créa connue' }), received: ch.count }))} />
          </Branch>
        ))}
        {idle.length > 0 && (
          <Branch label="Créas actives sans lead reçu" tone="bad" note={`${plural(idle.length, 'créa')} · ${euros(idle.reduce((sum, r) => sum + (r.spend_eur || 0), 0))} dépensés`}>
            <Creatives rows={idle} />
          </Branch>
        )}
      </>
    );
  }
  return c.details.map((x) => (
    <Branch key={x.label} label={x.label} n={x.count}>
      {x.children.length ? x.children.map((ch) => (
        <div key={ch.label} className="fst-sub-row"><span title={ch.label}>{ch.label}</span><span /><b className="fst-num">{count(ch.count)}</b></div>
      )) : null}
    </Branch>
  ));
}

// D'où viennent les leads : un tableau, comme le récap des ads. Une ligne par canal qui a reçu des leads (sur la
// période ou celle d'avant), rangée par famille ; la colonne de comparaison fait partie du tableau. Un clic déplie le
// détail. Les canaux sans lead tiennent sur une ligne.
function ChannelsCard({ state, prev, cmp, onSeeLeads }) {
  const drawn = useDrawn();
  const d = state.data;
  const [open, setOpen] = useState(null);
  const [hover, setHover] = useState(null);
  const groups = useMemo(() => groupChannels(d?.channels, d?.groups), [d]);
  const before = prev ? byKey(prev.channels) : null;
  const total = d?.total?.leads || 0;
  const active = (c) => c.total || before?.[c.key]?.total;
  const shown = groups.map((g) => ({ ...g, channels: g.channels.filter(active) })).filter((g) => g.channels.length);
  const silent = groups.flatMap((g) => g.channels).filter((c) => !active(c)).map((c) => c.label);
  const cols = cmp ? 6 : 5;
  return (
    <Card title="D'où viennent les leads" Icon={Target} state={state} skeleton={360}>
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
          <table className="fst-months ld-table ld-channels">
            <thead>
              <tr><th>Canal</th><th>Leads</th><th>Part</th><th>R1 placés</th>{cmp && <th>{capital(cmp.word)}</th>}<th aria-label="Détail" /></tr>
            </thead>
            {shown.map((g) => (
              <tbody key={g.key}>
                <tr className="ld-family"><td colSpan={cols}>{g.label}</td></tr>
                {g.channels.map((c) => {
                  const can = c.total > 0;
                  const isOpen = open === c.key;
                  return (
                    <Fragment key={c.key}>
                      <tr className="ld-line" data-can={can || undefined} data-open={isOpen || undefined} aria-expanded={can ? isOpen : undefined}
                        onClick={can ? () => setOpen(isOpen ? null : c.key) : undefined} onMouseEnter={() => setHover(c.key)} onMouseLeave={() => setHover(null)}>
                        <td><ChannelTag channel={c.key} label={c.label} /></td>
                        <td className="fst-num is-strong">{count(c.total)}</td>
                        <td className="fst-num">{pct(c.share, 0)}</td>
                        <td className="fst-num">{count(c.r1)}</td>
                        {cmp && <td><Versus value={c.total} previous={before?.[c.key]?.total ?? 0} cmp={cmp} inTable /></td>}
                        <td>{can && <ChevronRight size={14} className="fst-chev" />}</td>
                      </tr>
                      {isOpen && (
                        <tr className="ld-line-detail">
                          <td colSpan={cols}>
                            <div className="fst-sub-list">
                              <ChannelDetails channel={c} creatives={c.key === 'meta_ads' ? d.meta?.creatives || [] : null} />
                              <button type="button" className="fst-link" onClick={() => onSeeLeads(c.key)}>
                                Voir {c.total > 1 ? `ces ${count(c.total)} leads` : 'ce lead'}<ArrowDown size={13} style={{ rotate: '-90deg' }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            ))}
            <tfoot>
              <tr>
                <td>Total</td><td className="fst-num">{count(total)}</td><td className="fst-num">{total ? '100 %' : '–'}</td>
                <td className="fst-num">{count(d.total.r1)}</td>{cmp && <td><Versus value={total} previous={prev?.total?.leads} cmp={cmp} inTable /></td>}<td />
              </tr>
            </tfoot>
          </table>
          {silent.length > 0 && <p className="ld-silent">Aucun lead : {silent.join(', ')}.</p>}
        </>
      )}
    </Card>
  );
}

// Relances des setters : ce ne sont pas des leads reçus (Seconde chance, anciens inscrits rappelés). Même tableau.
function RelaunchCard({ state, prev, cmp }) {
  const d = state.data;
  const [open, setOpen] = useState(null);
  const rows = d ? [
    { key: 'second_chance', label: 'Seconde chance', unit: 'leads repris', n: d.second_chance?.claimed || 0, rdv: d.second_chance?.booked || 0,
      before: prev?.second_chance?.claimed, people: (d.second_chance?.setters || []).map((x) => ({ label: x.name, count: x.claimed })) },
    { key: 'webinar_recall', label: 'Anciens webinaires', unit: 'fiches rappelées', n: d.old_webinar?.worked || 0, rdv: d.old_webinar?.rdv_placed || 0,
      before: prev?.old_webinar?.worked, people: (d.old_webinar?.setters || []).map((x) => ({ label: x.name, count: x.worked })) },
  ] : [];
  const cols = cmp ? 5 : 4;
  return (
    <Card title="Relances des setters" Icon={History} state={state} skeleton={220}>
      {d && (
        <table className="fst-months ld-table">
          <thead><tr><th>Relance</th><th>Fiches</th><th>RDV posés</th>{cmp && <th>{capital(cmp.word)}</th>}<th aria-label="Détail" /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const can = r.people.length > 0;
              const isOpen = open === r.key;
              return (
                <Fragment key={r.key}>
                  <tr className="ld-line" data-can={can || undefined} data-open={isOpen || undefined} onClick={can ? () => setOpen(isOpen ? null : r.key) : undefined}>
                    <td><span className="ld-creative-cat is-strong"><span className="fst-dot" style={{ background: provenanceColor(r.key) }} />{r.label}</span><span className="ld-line-unit">{r.unit}</span></td>
                    <td className="fst-num is-strong">{count(r.n)}</td>
                    <td className="fst-num">{count(r.rdv)}</td>
                    {cmp && <td><Versus value={r.n} previous={r.before} cmp={cmp} inTable /></td>}
                    <td>{can && <ChevronRight size={14} className="fst-chev" />}</td>
                  </tr>
                  {isOpen && (
                    <tr className="ld-line-detail"><td colSpan={cols}><div className="fst-sub-list">
                      {r.people.map((x) => <div key={x.label} className="fst-sub-row"><span>{x.label}</span><span /><b className="fst-num">{count(x.count)}</b></div>)}
                    </div></td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// Retour sur dépense : le chiffre d'affaires annuel des ventes venues de la campagne, divisé par sa dépense.
function Roi({ roas, sales }) {
  if (!sales) return <span className="ld-muted">Aucune vente</span>;
  if (roas == null) return <span className="ld-muted">Sans dépense sur la période</span>;
  const x = `×${roas.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}`;
  return <Pill plain tone={roas >= 1 ? 'green' : 'red'}>{roas >= 1 ? 'Rentable' : 'Pas rentable'} · {x}</Pill>;
}

function CampaignsCard({ state }) {
  const rows = state.data?.campaigns || [];
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <Card title="Campagnes Meta" Icon={Megaphone} state={state} skeleton={320}>
      {!rows.length ? <div className="fst-empty">Aucune campagne sur cette période.</div> : (
        <TableBox minWidth={1180} free={false} after={rows.length > 12 && (
          <button type="button" className="fst-link" onClick={() => setAll(!all)}>{all ? 'Réduire' : `Voir les ${rows.length} campagnes`}</button>)}>
          <thead><tr><Th>Campagne</Th><Th>Catégorie</Th><Th num>Dépense</Th><Th num>Impressions</Th><Th num>Clics</Th><Th num>CTR</Th>
            <Th num>Leads Meta</Th><Th num>Reçus</Th><Th num>R1</Th><Th num>R2</Th><Th num>CPL</Th><Th num>Ventes</Th><Th num>CA</Th><Th>Retour sur dépense</Th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.campaign}>
                <td className="is-wrap">{r.campaign}</td>
                <td><span className="ld-creative-cat"><span className="fst-dot" style={{ background: categoryColor(r.category) }} />{r.category}</span></td>
                <td className="is-num">{euros(r.spend_eur)}</td><td className="is-num">{count(r.impressions)}</td>
                <td className="is-num">{count(r.clicks)}</td><td className="is-num">{pct(r.ctr, 2)}</td><td className="is-num">{count(r.leads_meta)}</td>
                <td className="is-num">{count(r.received_in_crm)}</td><td className="is-num">{count(r.r1)}</td><td className="is-num">{count(r.r2)}</td>
                <td className="is-num">{cents(r.cpl_eur)}</td>
                <td className="is-num">{count(r.sales)}</td><td className="is-num">{euros(r.revenue_eur)}</td>
                <td><Roi roas={r.roas} sales={r.sales} /></td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      )}
    </Card>
  );
}

// ── Liste des leads reçus ─────────────────────────────────────────────────────────────────────────

const timeOf = (iso) => (iso ? iso.slice(11, 16).replace(':', ' h ') : '');

function LeadLine({ lead, many }) {
  const facts = [lead.company, headcountText(lead.headcount), revenueText(lead.revenue), lead.sector].filter(Boolean);
  const from = [lead.detail, lead.creative].filter((x, i, all) => x && all.indexOf(x) === i);
  return (
    <div className="ld-lead">
      <span className="ld-lead-time fst-num">{many && lead.at ? <>{dayShort(lead.at)}<br /></> : null}{timeOf(lead.at)}</span>
      <div className="ld-lead-main">
        <div className="ld-lead-name">{lead.name || 'Sans nom'}</div>
        {facts.length > 0 && <div className="ld-lead-sub">{facts.join(' · ')}</div>}
        <div className="ld-lead-tags">
          <ChannelTag channel={lead.channel} label={lead.channel_label} />
          {from.length > 0 && <span className="ld-lead-who">{from.join(' · ')}</span>}
          {lead.r1_date && <Pill plain tone="green">R1 le {dayShort(lead.r1_date)}</Pill>}
          {lead.r2_date && <Pill plain tone="green">R2 le {dayShort(lead.r2_date)}</Pill>}
          {lead.sales && <span className="ld-lead-who">{lead.sales}</span>}
          {!lead.sales && lead.setter && <span className="ld-lead-who">{lead.setter}</span>}
        </div>
      </div>
    </div>
  );
}

function LeadsDrawer({ open, range, channel, onChannel, onClose, when }) {
  const state = useLeadStat('leads', open ? range : null);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => (state.fresh ? state.data.leads : []), [state]);
  const labels = useMemo(() => Object.fromEntries(rows.map((r) => [r.channel, r.channel_label])), [rows]);
  const counts = useMemo(() => rows.reduce((acc, r) => ({ ...acc, [r.channel]: (acc[r.channel] || 0) + 1 }), {}), [rows]);
  const needle = query.trim().toLowerCase();
  const shown = rows.filter((r) => (!channel || r.channel === channel)
    && (!needle || [r.name, r.company, r.sector, r.sales, r.setter, r.detail, r.creative].some((x) => String(x || '').toLowerCase().includes(needle))));
  const many = range.from !== range.to;
  const [limit, setLimit] = useState({ key: '', n: 60 });
  const listKey = `${range.from}/${range.to}/${channel || ''}/${needle}`;
  const n = limit.key === listKey ? limit.n : 60;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <Motion.div key="scrim" className="ld-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <Motion.aside key="drawer" className="ld-drawer" role="dialog" aria-label="Leads reçus"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.34, ease: EASE }}>
            <header className="ld-drawer-head">
              <div>
                <h3 className="fst-card-title"><Inbox size={15} strokeWidth={2.1} />Leads reçus</h3>
                <p className="ld-drawer-sub">{state.fresh ? `${plural(rows.length, 'lead')} ${when}` : 'Lecture des leads…'}</p>
              </div>
              <button type="button" className="ld-close" onClick={onClose} aria-label="Fermer"><X size={17} /></button>
            </header>
            <div className="ld-drawer-tools">
              <div className="fst-tabs" role="group" aria-label="Canal">
                <button type="button" className="fst-tab" aria-pressed={!channel} onClick={() => onChannel(null)}>
                  <span>Tous</span><span className="fst-tab-count fst-num">{count(rows.length)}</span>
                </button>
                {Object.keys(counts).map((key) => (
                  <button key={key} type="button" className="fst-tab" aria-pressed={channel === key} onClick={() => onChannel(channel === key ? null : key)}>
                    <span className="fst-dot" style={{ background: channelColor(key) }} /><span>{labels[key]}</span><span className="fst-tab-count fst-num">{count(counts[key])}</span>
                  </button>
                ))}
              </div>
              <label className="fst-search">
                <Search size={14} />
                <input type="search" placeholder="Nom, entreprise, sales…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Chercher un lead" />
              </label>
            </div>
            <div className="ld-drawer-body">
              {!state.fresh && !state.error && <div className="fst-skel" style={{ height: 240 }} />}
              {state.error && <div className="fst-error" role="alert">{state.error}<button type="button" onClick={state.retry}>Réessayer</button></div>}
              {state.fresh && shown.slice(0, n).map((lead) => <LeadLine key={`${lead.id}-${lead.channel}`} lead={lead} many={many} />)}
              {state.fresh && !shown.length && <div className="fst-empty">Aucun lead.</div>}
              {state.fresh && shown.length > n && (
                <div className="fst-more"><button type="button" onClick={() => setLimit({ key: listKey, n: n + 120 })}>Afficher les {count(Math.min(120, shown.length - n))} suivants</button></div>
              )}
            </div>
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
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

function SettersCard({ state, prev, cmp }) {
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
            <Versus value={s.rdv_placed} previous={prev?.setters?.rdv_placed} cmp={cmp} />
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

function OldWebinarCard({ state, prev, cmp }) {
  const old = state.data?.old_webinar;
  return (
    <Card title="Anciens webinaires" Icon={Presentation} state={state} skeleton={300}>
      {old && (
        <>
          <div className="fst-hero">
            <div><Num className="fst-big" value={old.worked} format={whole} duration={1100} /><span className="fst-big-unit">fiches rappelées</span></div>
            <Versus value={old.worked} previous={prev?.old_webinar?.worked} cmp={cmp} />
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

function SecondChanceCard({ state, prev, cmp }) {
  const sc = state.data?.second_chance;
  return (
    <Card title="Seconde chance" Icon={LifeBuoy} state={state} skeleton={300}>
      {sc && (
        <>
          <div className="fst-hero">
            <div><Num className="fst-big" value={sc.claimed} format={whole} duration={1100} /><span className="fst-big-unit">leads repris</span></div>
            <Versus value={sc.claimed} previous={prev?.second_chance?.claimed} cmp={cmp} />
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
  const people = (block?.people || []).filter((p) => p.status === 'ok').map((p) => ({ ...p, stats: p.total, total: p.total.calls }));
  return (
    <Card title="Appels" Icon={Phone} state={tooLong ? null : state} skeleton={360} hint={!tooLong && !state.data ? 'Lecture des appels chez Allo…' : null}
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
              parts={(p) => [{ key: 'answered', n: p.stats.answered || 0 }, { key: 'other', n: Math.max(0, (p.stats.calls || 0) - (p.stats.answered || 0)) }]}
              tip={(p) => <><b>{p.name}</b><br />{plural(p.stats.calls, 'appel')} · {plural(p.stats.answered, 'décroché')}<br /><span>{plural(p.stats.outbound, 'sortant')} · {Math.round((p.stats.duration_seconds || 0) / 60)} min au téléphone</span></>} />
          </div>
          {block.team.missing?.length > 0 && <dl className="fst-kv"><dt>Sans compte Allo</dt><dd>{block.team.missing.join(', ')}</dd></dl>}
        </>
      )}
    </Card>
  );
}

// ── Ventes ────────────────────────────────────────────────────────────────────────────────────────

function SalesCard({ state, prev, cmp }) {
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
            <Versus value={total} previous={prev?.sales?.totals?.sales} cmp={cmp} />
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
  const [list, setList] = useState({ open: false, channel: null });
  const seeLeads = useCallback((channel) => setList({ open: true, channel }), []);
  const closeLeads = useCallback(() => setList((l) => ({ ...l, open: false })), []);
  const range = useMemo(() => (custom ? { from: custom.from, to: custom.to } : presetRange(preset, today)), [custom, preset, today]);
  const compareKey = custom ? 'custom' : preset;
  const prevRange = useMemo(() => comparisonFor(compareKey, range), [compareKey, range]);
  // Une période qui finit aujourd'hui se compare à la même heure : hier jusqu'à 10 h 30 face à aujourd'hui à 10 h 30.
  const [clock, setClock] = useState(parisClock);
  const until = range.to === today ? clock : null;
  const word = compareWord(compareKey, range);
  const cmp = compare ? {
    word,
    label: `${word.charAt(0).toUpperCase()}${word.slice(1)} (${dayShort(prevRange.from)}${prevRange.from === prevRange.to ? '' : ` – ${dayShort(prevRange.to)}`}${until ? `, jusqu'à ${until.replace(':', ' h ')}` : ''})`,
  } : null;

  const current = useLeadStat('overview', range);
  const previous = useLeadStat('overview', compare ? prevRange : null, until);
  const tooLong = !canReadCalls(range);
  // Les appels se lisent chez Allo (lent la première fois) : demandés dès que les leads sont là, pour être prêts à
  // l'ouverture de l'onglet.
  const calls = useLeadStat('calls', !tooLong && current.fresh ? range : null);
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
            <LeadsCard state={current} prev={p} cmp={cmp} when={when} onPickDay={pickDay} onSeeLeads={seeLeads} />
            <AdsCard state={current} prev={p} cmp={cmp} campaignsOpen={campaignsOpen} onCampaigns={() => setCampaignsOpen(!campaignsOpen)} />
          </Reveal>
          <Collapse open={campaignsOpen}>
            <Reveal className="ld-gap"><CampaignsCard state={campaigns} /></Reveal>
          </Collapse>
          <Reveal className="fst-grid ld-gap">
            <ChannelsCard state={current} prev={p} cmp={cmp} onSeeLeads={seeLeads} />
            <RelaunchCard state={current} prev={p} cmp={cmp} />
          </Reveal>
        </>
      )}
      {tab === 'setters' && (
        <>
          <Reveal className="fst-grid is-even">
            <SettersCard state={current} prev={p} cmp={cmp} />
            <SetterPeopleCard state={current} />
          </Reveal>
          <Reveal className="fst-grid is-even ld-gap">
            <OldWebinarCard state={current} prev={p} cmp={cmp} />
            <SecondChanceCard state={current} prev={p} cmp={cmp} />
          </Reveal>
        </>
      )}
      {tab === 'calls' && <Reveal><CallsCard state={calls} tooLong={tooLong} /></Reveal>}
      {tab === 'sales' && <Reveal><SalesCard state={current} prev={p} cmp={cmp} /></Reveal>}
      <LeadsDrawer open={list.open} range={range} channel={list.channel} onChannel={(channel) => setList((l) => ({ ...l, channel }))}
        onClose={closeLeads} when={when} />
      {d && (
        <p className="ld-source">
          Calculé à {d.period.generated_at.slice(11, 16).replace(':', ' h ')}{d.meta?.synced_at ? ` · Meta lu à ${d.meta.synced_at.slice(11, 16).replace(':', ' h ')}` : ''}
        </p>
      )}
    </Page>
  );
}
