// src/pages/MetaAds/overview/Overview.jsx — vue d'ensemble de la page Meta Ads.
//
// Lit `GET /api/v1/marketing/meta-ads/overview` (les deux portefeuilles Meta,
// croisés avec nos ventes) et raconte la période en trois temps :
//   1. L'essentiel : ce qu'on a dépensé, ce que ça a rapporté (leads, ventes),
//      le flux de leads Meta → CRM et le rythme jour par jour.
//   2. Ce qu'on diffuse : formats, placements, publicités lancées, portefeuilles.
//   3. À qui on parle : âge, genre, régions.
// puis les ventes une par une pour vérifier le total. Chaque bloc a un
// titre, un pictogramme et une phrase qui dit comment le lire.

import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import apiClient from '../../../services/apiClient.js';
import Pict from '../icons.jsx';
import { CountUp, Ring, EASE } from '../motion.jsx';
import { Card, RankedRow, ShareBar, Legend, Empty } from './Card.jsx';
import { SpendLeadsChart, LaunchesChart } from './charts.jsx';
import SalesList from '../SalesList.jsx';
import { fmtInt, fmtCompact, fmtEur, fmtEur2, fmtPct, fmtShare, fmtShortDay } from '../theme.js';

const nf = new Intl.NumberFormat('fr-FR');
const GENDER_LABEL = { female: 'Femmes', male: 'Hommes', unknown: 'Non renseigné' };
const FORMAT_LABEL = { video: 'Vidéo', image: 'Image', carousel: 'Carrousel', other: 'Autre' };
const PLATFORM_LABEL = { facebook: 'Facebook', instagram: 'Instagram', audience_network: 'Audience Network', messenger: 'Messenger' };
const POSITION_LABEL = {
  feed: 'Fil', facebook_feed: 'Fil', instagram_feed: 'Fil', instagram_stories: 'Stories', facebook_stories: 'Stories',
  instagram_reels: 'Reels', facebook_reels: 'Reels', facebook_reels_overlay: 'Reels (bandeau)', instagram_explore: 'Explorer',
  right_hand_column: 'Colonne de droite', marketplace: 'Marketplace', search: 'Recherche', instream_video: 'Vidéo in-stream', instagram_profile_feed: 'Profil',
};
const humanize = (v) => String(v || '').replace(/_/g, ' ');

// ── section : pictogramme + titre + phrase de lecture ───────────────────────
function Section({ T, kicker, icon, title, children }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.4, ease: EASE }} style={{ marginTop: 34 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <span style={{ width: 34, height: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.accentBg, color: T.accent }}><Pict name={icon} size={18} /></span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.accent }}>{kicker}</div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 750, letterSpacing: '-0.02em', color: T.text }}>{title}</h2>
        </div>
      </div>
      <div style={{ height: 14 }} />
      {children}
    </motion.div>
  );
}

// ── tuile d'indicateur ─────────────────────────────────────────────────────
function Delta({ T, current, previous, goodWhenDown, light }) {
  const faint = light ? 'rgba(238,241,248,0.6)' : T.textFaint;
  if (previous == null || current == null || !previous) return <span style={{ fontSize: 11.5, color: faint }}>pas de comparable</span>;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(pct)) return <span style={{ fontSize: 11.5, color: faint }}>pas de comparable</span>;
  const flat = Math.abs(pct) < 1;
  const up = pct > 0;
  const good = flat ? null : (goodWhenDown ? !up : up);
  const color = flat ? faint : good ? (light ? '#8fd1ad' : T.green) : (light ? '#f0a396' : T.red);
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: flat ? 'none' : up ? 'none' : 'rotate(180deg)' }}>
        {flat ? <path d="M2.5 6h7" /> : <><path d="M6 9.5v-7" /><path d="M2.9 5.6L6 2.5l3.1 3.1" /></>}
      </svg>
      {flat ? 'stable' : `${Math.abs(pct).toFixed(0)} % vs période précédente`}
    </span>
  );
}

function Tile({ T, icon, label, value, format, sub, delta, index = 0, hero = false }) {
  const reduce = useReducedMotion();
  const light = hero;
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.04 * index, ease: EASE }}
      style={{ padding: hero ? '18px 20px' : '15px 17px', borderRadius: 16, minWidth: 0, background: hero ? T.navy : T.surface, border: `1px solid ${hero ? T.navy : T.border}`, boxShadow: T.shadow, color: hero ? '#eef1f8' : T.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: light ? 'rgba(238,241,248,0.7)' : T.textFaint }}>
        <Pict name={icon} size={15} color={light ? '#8fd1ad' : T.accent} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: hero ? 30 : 23, fontWeight: 750, letterSpacing: '-0.025em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
        {typeof value === 'number' && Number.isFinite(value) ? <CountUp value={value} format={format || ((v) => nf.format(Math.round(v)))} /> : (value ?? '—')}
      </div>
      <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 16 }}>
        {delta}
        {sub && <span style={{ fontSize: 11.5, color: light ? 'rgba(238,241,248,0.75)' : T.textMuted }}>{sub}</span>}
      </div>
    </motion.div>
  );
}

// ── flux de leads : Meta → CRM ─────────────────────────────────────────────
function FlowCard({ T, period, index }) {
  const [rec, setRec] = useState(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    let alive = true;
    setState('loading');
    apiClient.get(`/api/v1/marketing/meta-ads?level=campaign&since=${period.since}&until=${period.until}`)
      .then((r) => { if (!alive) return; setRec(r?.reconciliation || null); setState('ok'); })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [period]);
  const rate = rec?.recovery_rate;
  return (
    <Card T={T} index={index} title="Flux de leads : de Meta au CRM">
      {state === 'loading' ? <Empty T={T}>Rapprochement en cours…</Empty> : state === 'error' || !rec ? <Empty T={T}>Rapprochement indisponible.</Empty> : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <Ring value={rate || 0} size={84} stroke={7} color={rate != null && rate >= 0.9 ? T.green : rate != null && rate >= 0.75 ? T.amber : T.red} label={rate == null ? '—' : `${Math.round(rate * 100)} %`} sub="reçus" T={T} />
          <div style={{ flex: 1, minWidth: 220, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {[['Leads facturés par Meta', fmtInt(rec.meta_leads)], ['Reçus au CRM', fmtInt(rec.received)], ['Doublons écartés', fmtInt(rec.duplicates)], ['Écart inexpliqué', fmtInt(rec.unexplained), rec.unexplained > 0 ? T.red : T.green]].map(([k, v, c]) => (
              <div key={k} style={{ padding: '9px 11px', borderRadius: 11, background: T.surfaceAlt }}>
                <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 600 }}>{k}</div>
                <div style={{ fontSize: 16, fontWeight: 750, color: c || T.text, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
              </div>
            ))}
          </div>
          {rec.fresh_day && <div style={{ flexBasis: '100%', fontSize: 11.5, color: T.textFaint }}>Aujourd'hui inclus : chiffres Meta du jour incomplets.</div>}
        </div>
      )}
    </Card>
  );
}

// ── calendrier des leads ───────────────────────────────────────────────────
function LeadsCalendar({ T, daily, index }) {
  const reduce = useReducedMotion();
  const days = daily || [];
  const max = Math.max(1, ...days.map((d) => d.leads || 0));
  const cells = useMemo(() => {
    if (!days.length) return [];
    const first = new Date(`${days[0].date}T12:00:00Z`);
    const lead = (first.getUTCDay() + 6) % 7; // lundi = 0
    return [...Array(lead).fill(null), ...days];
  }, [days]);
  const total = days.reduce((s, d) => s + (d.leads || 0), 0);
  return (
    <Card T={T} index={index} title="Leads jour par jour"
      right={<span style={{ fontSize: 22, fontWeight: 750, color: T.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}><CountUp value={total} format={(v) => nf.format(Math.round(v))} /></span>}>
      {days.length === 0 ? <Empty T={T}>Aucune donnée quotidienne.</Empty> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 5, fontSize: 10.5, color: T.textFaint, fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 5 }}>
            {cells.map((d, i) => d ? (
              <motion.div key={d.date} title={`${fmtShortDay(d.date)} : ${fmtInt(d.leads)} leads, ${fmtEur(d.spend)}`}
                initial={reduce ? false : { opacity: 0, scale: 0.7 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: Math.min(i, 40) * 0.012, ease: EASE }}
                style={{ aspectRatio: '1 / 1', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  background: d.leads ? `rgba(62,125,90,${0.14 + 0.86 * (d.leads / max)})` : T.navySoft, color: d.leads / max > 0.45 ? '#fff' : T.text }}>
                {d.leads || ''}
              </motion.div>
            ) : <div key={`pad-${i}`} />)}
          </div>
        </>
      )}
    </Card>
  );
}

// ── audience : âge × genre ─────────────────────────────────────────────────
function AudienceCard({ T, audience, index }) {
  const rows = audience?.age_gender || [];
  const ages = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const a = m.get(r.age) || { age: r.age, total: 0, female: 0, male: 0, unknown: 0 };
      a.total += r.impressions || 0; a[r.gender in a ? r.gender : 'unknown'] += r.impressions || 0; m.set(r.age, a);
    });
    const total = [...m.values()].reduce((s, a) => s + a.total, 0);
    return [...m.values()].filter((a) => a.total > 0).sort((x, y) => x.age.localeCompare(y.age)).map((a) => ({ ...a, share: total ? a.total / total : 0 })).filter((a) => a.share >= 0.005);
  }, [rows]);
  const genders = (audience?.gender || []).filter((g) => g.share > 0.001);
  const colors = { female: T.green, male: T.navy, unknown: T.textFaint };
  return (
    <Card T={T} index={index} title="Âge et genre"
      right={<Legend T={T} items={[{ label: 'Femmes', color: colors.female }, { label: 'Hommes', color: colors.male }]} />}>
      {ages.length === 0 ? <Empty T={T}>Indisponible sur cette période.</Empty> : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {genders.map((g) => (
              <div key={g.gender} style={{ flex: '1 1 120px', padding: '10px 12px', borderRadius: 12, background: T.surfaceAlt, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Ring value={g.share} size={42} stroke={4} color={colors[g.gender] || T.textFaint} T={T} />
                <div>
                  <div style={{ fontSize: 11.5, color: T.textFaint, fontWeight: 600 }}>{GENDER_LABEL[g.gender] || humanize(g.gender)}</div>
                  <div style={{ fontSize: 18, fontWeight: 750, color: T.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtShare(g.share, 0)}</div>
                  {genders.some((x) => x.leads > 0) && <div style={{ fontSize: 11, color: T.textMuted }}>{fmtInt(g.leads)} leads</div>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '58px minmax(0, 1fr) 52px', gap: '10px 12px', alignItems: 'center' }}>
            {ages.map((a, i) => (
              <React.Fragment key={a.age}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{/^unknown$/i.test(a.age) ? 'Non renseigné' : a.age}</span>
                <div style={{ display: 'flex', height: 14, borderRadius: 99, overflow: 'hidden', background: T.navySoft }}>
                  {['female', 'male', 'unknown'].map((g) => a.total && a[g] ? (
                    <motion.div key={g} initial={{ width: 0 }} whileInView={{ width: `${(a[g] / a.total) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.05 * i, ease: EASE }}
                      style={{ background: colors[g], height: '100%' }} title={`${GENDER_LABEL[g]} : ${fmtPct((a[g] / a.total) * 100, 0)}`} />
                  ) : null)}
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtShare(a.share, 0)}</span>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// Un chiffre n'apparaît que si Meta le donne : les leads par segment sont
// souvent absents des ventilations (région, placement), on ne montre alors
// que les personnes touchées et la part.
const leadsSub = (rows, r) => (rows.some((x) => x.leads > 0) ? `${fmtInt(r.leads)} leads` : null);

function GeoCard({ T, geo, index }) {
  const rows = (geo?.rows || []).slice(0, 10);
  return (
    <Card T={T} index={index} title={geo?.level === 'country' ? 'Pays' : 'Régions'} right={<span style={{ fontSize: 11.5, color: T.textFaint }}>personnes touchées</span>}>
      {rows.length === 0 ? <Empty T={T}>Indisponible sur cette période.</Empty> : rows.map((r, i) => (
        <RankedRow key={r.name} T={T} index={i} label={r.name} sub={leadsSub(rows, r)} value={fmtCompact(r.reach || r.impressions)} share={r.share} color={i === 0 ? T.green : T.navy} />
      ))}
    </Card>
  );
}

function FormatsCard({ T, formats, index }) {
  const rows = (formats || []).filter((f) => f.ads > 0);
  return (
    <Card T={T} index={index} title="Formats">
      {rows.length === 0 ? <Empty T={T}>Aucune publicité sur cette période.</Empty> : rows.map((f, i) => (
        <RankedRow key={f.format} T={T} index={i} label={FORMAT_LABEL[f.format] || humanize(f.format)} sub={`${fmtInt(f.ads)} pub${f.ads > 1 ? 's' : ''} · ${fmtInt(f.active)} active${f.active > 1 ? 's' : ''} · ${fmtInt(f.leads)} leads`}
          value={fmtEur(f.spend)} share={f.share_spend} color={f.format === 'video' ? T.green : T.navy} />
      ))}
    </Card>
  );
}

function PlacementsCard({ T, placements, index }) {
  const rows = (placements || []).slice(0, 8);
  return (
    <Card T={T} index={index} title="Placements">
      {rows.length === 0 ? <Empty T={T}>Indisponible sur cette période.</Empty> : rows.map((p, i) => (
        <RankedRow key={`${p.platform}-${p.position}`} T={T} index={i} label={`${PLATFORM_LABEL[p.platform] || humanize(p.platform)} · ${POSITION_LABEL[p.position] || humanize(p.position)}`}
          sub={leadsSub(rows, p)} value={fmtEur(p.spend)} share={p.share} color={p.platform === 'instagram' ? T.green : T.navy} />
      ))}
    </Card>
  );
}

function PortfoliosCard({ T, portfolios, index }) {
  const rows = portfolios || [];
  const totalSpend = rows.reduce((s, p) => s + (p.spend || 0), 0);
  return (
    <Card T={T} index={index} title="Par portefeuille">
      {rows.length === 0 ? <Empty T={T}>Aucun portefeuille.</Empty> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {rows.map((p, i) => (
            <div key={p.key} style={{ padding: '12px 14px', borderRadius: 14, background: T.surfaceAlt }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Pict name="portfolio" size={15} color={T.accent} /><span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{p.label}</span></div>
              <div style={{ fontSize: 11.5, color: T.textFaint, margin: '2px 0 8px' }}>{fmtInt(p.accounts)} compte{p.accounts > 1 ? 's' : ''} · {fmtShare(totalSpend ? p.spend / totalSpend : 0, 0)} de la dépense</div>
              <ShareBar T={T} share={totalSpend ? p.spend / totalSpend : 0} color={i === 0 ? T.navy : T.green} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 10px', marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>
                {[['Dépense', fmtEur(p.spend)], ['Leads', fmtInt(p.leads)], ['Coût par lead', fmtEur2(p.cpl)], ['Portée', fmtCompact(p.reach)]].map(([k, v]) => (
                  <div key={k}><div style={{ fontSize: 11, color: T.textFaint }}>{k}</div><div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{v}</div></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function previousWindow(since, until) {
  const a = new Date(`${since}T00:00:00Z`), b = new Date(`${until}T00:00:00Z`);
  const days = Math.round((b - a) / 86400000) + 1;
  if (!Number.isFinite(days) || days < 1) return null;
  const pu = new Date(a); pu.setUTCDate(pu.getUTCDate() - 1);
  const ps = new Date(pu); ps.setUTCDate(ps.getUTCDate() - (days - 1));
  const iso = (d) => d.toISOString().slice(0, 10);
  return { since: iso(ps), until: iso(pu) };
}

export default function Overview({ T, period, portfolio }) {
  const [data, setData] = useState(null);
  const [prev, setPrev] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    const q = `since=${period.since}&until=${period.until}&portfolio=${portfolio}`;
    apiClient.get(`/api/v1/marketing/meta-ads/overview?${q}`)
      .then((r) => { if (alive) setData(r); })
      .catch((e) => { if (!alive) return; setData(null); setError(e?.status === 503 ? { kind: 'config', msg: e?.data?.detail } : { kind: 'err', msg: e?.data?.detail || e?.message || 'Erreur de chargement' }); })
      .finally(() => { if (alive) setLoading(false); });
    const win = previousWindow(period.since, period.until);
    setPrev(null);
    if (win) apiClient.get(`/api/v1/marketing/meta-ads/overview?since=${win.since}&until=${win.until}&portfolio=${portfolio}`).then((r) => { if (alive) setPrev(r || null); }).catch(() => {});
    return () => { alive = false; };
  }, [period, portfolio]);

  if (loading) return <Centered T={T}><Pict name="overview" size={26} color={T.accent} /><div style={{ marginTop: 10, fontWeight: 600, color: T.text }}>Lecture de Meta…</div></Centered>;
  if (error?.kind === 'config') return <Centered T={T}><div style={{ fontWeight: 600, color: T.text }}>Configuration Meta en attente</div><div style={{ marginTop: 4, fontSize: 13 }}>{error.msg || 'Les tokens Meta ne sont pas encore configurés sur le serveur.'}</div></Centered>;
  if (error) return <Centered T={T}><span style={{ color: T.red }}>{error.msg}</span></Centered>;
  if (!data) return null;

  const t = data.totals || {};
  const s = data.sales || {};
  const p = prev?.totals || {};
  const ps = prev?.sales || {};
  const roas = t.spend ? (s.ca_attributed || 0) / t.spend : null;
  const prevRoas = p.spend && ps.ca_attributed != null ? ps.ca_attributed / p.spend : null;
  const salesLine = `${fmtInt(s.meta)} via une créa · ${fmtInt(s.webinaire)} webinaire · ${fmtInt(s.hors_meta)} hors Meta${s.sans_client ? ` · ${fmtInt(s.sans_client)} sans client` : ''}`;
  const eur0 = (v) => fmtEur(v);

  return (
    <div>
      {/* ── 1. L'essentiel ── */}
      <Section T={T} kicker="1 · L'essentiel" icon="overview" title="Ce que la période a donné">
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <Tile T={T} hero index={0} icon="sales" label="Ventes déclarées" value={s.total ?? null} sub={salesLine} delta={<Delta T={T} light current={s.total} previous={ps.total} />} />
          <Tile T={T} index={1} icon="spend" label="Dépense" value={t.spend ?? null} format={eur0} delta={<Delta T={T} current={t.spend} previous={p.spend} />} />
          <Tile T={T} index={2} icon="leads" label="Leads reçus" value={t.leads ?? null} sub={t.cpl != null ? `${fmtEur2(t.cpl)} par lead` : null} delta={<Delta T={T} current={t.leads} previous={p.leads} />} />
          <Tile T={T} index={3} icon="roas" label="Retour sur dépense" value={roas == null ? '—' : `${roas.toFixed(2)}x`} sub={s.ca_attributed ? `${fmtEur(s.ca_attributed)} de CA rattaché aux créas` : 'aucun CA rattaché'} delta={<Delta T={T} current={roas} previous={prevRoas} />} />
          <Tile T={T} index={4} icon="reach" label="Portée" value={t.reach ?? null} format={(v) => fmtCompact(v)} sub={t.frequency ? `vue ${Number(t.frequency).toFixed(1)} fois par personne` : null} delta={<Delta T={T} current={t.reach} previous={p.reach} />} />
          <Tile T={T} index={5} icon="impressions" label="Impressions" value={t.impressions ?? null} format={(v) => fmtCompact(v)} sub={t.cpm != null ? `${fmtEur2(t.cpm)} CPM` : null} delta={<Delta T={T} current={t.impressions} previous={p.impressions} />} />
          <Tile T={T} index={6} icon="clicks" label="Clics" value={t.clicks ?? null} sub={t.ctr != null ? `${fmtPct(t.ctr, 2)} de taux de clic` : null} delta={<Delta T={T} current={t.clicks} previous={p.clicks} />} />
          <Tile T={T} index={7} icon="ads" label="Publicités en compte" value={t.ads_count ?? null} sub={`${fmtInt(t.ads_active)} active${t.ads_active > 1 ? 's' : ''} aujourd'hui`} />
        </div>
        <div style={{ marginTop: 14, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          <div style={{ gridColumn: 'span 2', minWidth: 0 }}><SpendLeadsChart T={T} daily={data.daily} index={0} /></div>
          <LeadsCalendar T={T} daily={data.daily} index={1} />
        </div>
        <div style={{ marginTop: 14 }}><FlowCard T={T} period={period} index={2} /></div>
      </Section>

      {/* ── 2. Ce qu'on diffuse ── */}
      <Section T={T} kicker="2 · Ce qu'on diffuse" icon="format" title="Formats, placements et rythme de lancement">
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <FormatsCard T={T} formats={data.formats} index={0} />
          <PlacementsCard T={T} placements={data.placements} index={1} />
          <LaunchesChart T={T} launches={data.launches} index={2} />
          <PortfoliosCard T={T} portfolios={data.portfolios} index={3} />
        </div>
      </Section>

      {/* ── 3. À qui on parle ── */}
      <Section T={T} kicker="3 · À qui on parle" icon="audience" title="Audience touchée">
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          <AudienceCard T={T} audience={data.audience} index={0} />
          <GeoCard T={T} geo={data.geo} index={1} />
        </div>
      </Section>

      {/* ── 4. Les ventes, une par une ── */}
      <Section T={T} kicker="4 · Vérification" icon="match" title="Les ventes de la période, une par une">
        <SalesList sales={data.sales} level="ad" T={T} />
      </Section>

      {(data.warnings || []).length > 0 && (
        <div style={{ marginTop: 18, fontSize: 12, color: T.textFaint }}>Données partielles : {data.warnings.join(' · ')}</div>
      )}
    </div>
  );
}

function Centered({ T, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '64px 20px', color: T.textMuted, fontSize: 14 }}>{children}</div>;
}
