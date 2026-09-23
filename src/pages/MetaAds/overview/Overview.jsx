// src/pages/MetaAds/overview/Overview.jsx — vue d'ensemble de la page Meta Ads.
//
// Lit `GET /api/v1/marketing/meta-ads/overview` (les deux portefeuilles Meta,
// croisés avec nos ventes) et raconte la période en trois temps :
//   1. L'essentiel : ce qu'on a dépensé, ce que ça a rapporté (leads, ventes).
//   2. Ce qu'on diffuse : formats, placements, publicités lancées, portefeuilles.
//   3. À qui on parle : âge, genre, régions.
// Chaque bloc a un titre et une phrase qui dit comment le lire.

import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import apiClient from '../../../services/apiClient.js';
import { Card, RankedRow, ShareBar, Legend, Empty, EASE } from './Card.jsx';
import { SpendLeadsChart, LaunchesChart } from './charts.jsx';
import SalesList from '../SalesList.jsx';
import { fmtInt, fmtCompact, fmtEur, fmtEur2, fmtPct, fmtShare, fmtRoas } from '../theme.js';

const GENDER_LABEL = { female: 'Femmes', male: 'Hommes', unknown: 'Non renseigné' };
const FORMAT_LABEL = { video: 'Vidéo', image: 'Image', carousel: 'Carrousel', other: 'Autre' };
const PLATFORM_LABEL = { facebook: 'Facebook', instagram: 'Instagram', audience_network: 'Audience Network', messenger: 'Messenger' };
const POSITION_LABEL = {
  feed: 'Fil', facebook_feed: 'Fil', instagram_feed: 'Fil', instagram_stories: 'Stories', facebook_stories: 'Stories',
  instagram_reels: 'Reels', facebook_reels: 'Reels', instagram_explore: 'Explorer', right_hand_column: 'Colonne de droite',
  marketplace: 'Marketplace', search: 'Recherche', instream_video: 'Vidéo in-stream', instagram_profile_feed: 'Profil',
};
const humanize = (v) => String(v || '').replace(/_/g, ' ');

// ── section : titre + phrase de lecture ────────────────────────────────────
function Section({ T, kicker, title, lead, children }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4, ease: EASE }} style={{ marginTop: 34 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.accent }}>{kicker}</span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 750, letterSpacing: '-0.02em', color: T.text }}>{title}</h2>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: T.textMuted, maxWidth: 760, lineHeight: 1.5 }}>{lead}</p>
      {children}
    </motion.div>
  );
}

// ── tuile d'indicateur ─────────────────────────────────────────────────────
function Delta({ T, current, previous, goodWhenDown }) {
  if (previous == null || current == null || !previous) return <span style={{ fontSize: 11.5, color: T.textFaint }}>pas de comparable</span>;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(pct)) return <span style={{ fontSize: 11.5, color: T.textFaint }}>pas de comparable</span>;
  const flat = Math.abs(pct) < 1;
  const up = pct > 0;
  const good = flat ? null : (goodWhenDown ? !up : up);
  const color = flat ? T.textFaint : good ? T.green : T.red;
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: flat ? 'none' : up ? 'none' : 'rotate(180deg)' }}>
        {flat ? <path d="M2.5 6h7" /> : <><path d="M6 9.5v-7" /><path d="M2.9 5.6L6 2.5l3.1 3.1" /></>}
      </svg>
      {flat ? 'stable' : `${Math.abs(pct).toFixed(0)} % vs période précédente`}
    </span>
  );
}

function Tile({ T, label, value, sub, delta, index = 0, hero = false }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.04 * index, ease: EASE }}
      style={{ padding: hero ? '18px 20px' : '15px 17px', borderRadius: 16, minWidth: 0,
        background: hero ? T.navy : T.surface, border: `1px solid ${hero ? T.navy : T.border}`, boxShadow: T.shadow,
        color: hero ? '#eef1f8' : T.text }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: hero ? 'rgba(238,241,248,0.7)' : T.textFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: hero ? 30 : 23, fontWeight: 750, letterSpacing: '-0.025em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 16 }}>
        {delta}
        {sub && <span style={{ fontSize: 11.5, color: hero ? 'rgba(238,241,248,0.75)' : T.textMuted }}>{sub}</span>}
      </div>
    </motion.div>
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
    return [...m.values()].sort((x, y) => x.age.localeCompare(y.age)).map((a) => ({ ...a, share: total ? a.total / total : 0 }));
  }, [rows]);
  const genders = audience?.gender || [];
  const colors = { female: T.green, male: T.navy, unknown: T.textFaint };
  return (
    <Card T={T} index={index} title="Âge et genre" subtitle="Part des impressions par tranche d'âge, et répartition femmes / hommes dans chaque tranche"
      right={<Legend T={T} items={[{ label: 'Femmes', color: colors.female }, { label: 'Hommes', color: colors.male }, { label: 'Non renseigné', color: colors.unknown }]} />}>
      {ages.length === 0 ? <Empty T={T}>Répartition par âge indisponible sur cette période.</Empty> : (
        <>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
            {genders.map((g) => (
              <div key={g.gender} style={{ flex: '1 1 120px', padding: '10px 12px', borderRadius: 12, background: T.surfaceAlt }}>
                <div style={{ fontSize: 11.5, color: T.textFaint, fontWeight: 600 }}>{GENDER_LABEL[g.gender] || humanize(g.gender)}</div>
                <div style={{ fontSize: 20, fontWeight: 750, color: T.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtShare(g.share, 0)}</div>
                <div style={{ fontSize: 11.5, color: T.textMuted }}>{fmtCompact(g.reach)} personnes · {fmtInt(g.leads)} leads</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '58px minmax(0, 1fr) 52px', gap: '10px 12px', alignItems: 'center' }}>
            {ages.map((a, i) => (
              <React.Fragment key={a.age}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.age}</span>
                <div style={{ display: 'flex', height: 14, borderRadius: 99, overflow: 'hidden', background: T.navySoft }}>
                  {['female', 'male', 'unknown'].map((g) => a.total ? (
                    <motion.div key={g} initial={{ width: 0 }} whileInView={{ width: `${(a[g] / a.total) * 100}%` }} viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: 0.05 * i, ease: EASE }} style={{ background: colors[g], height: '100%' }}
                      title={`${GENDER_LABEL[g]} : ${fmtPct((a[g] / a.total) * 100, 0)}`} />
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

function GeoCard({ T, geo, index }) {
  const rows = (geo?.rows || []).slice(0, 10);
  return (
    <Card T={T} index={index} title={geo?.level === 'country' ? 'Pays' : 'Régions'} subtitle="Où les publicités sont vues, en part des impressions, avec les leads reçus">
      {rows.length === 0 ? <Empty T={T}>Répartition géographique indisponible sur cette période.</Empty> : rows.map((r, i) => (
        <RankedRow key={r.name} T={T} index={i} label={r.name} sub={`${fmtInt(r.leads)} leads`} value={fmtCompact(r.impressions)} share={r.share} color={i === 0 ? T.green : T.navy} />
      ))}
    </Card>
  );
}

function FormatsCard({ T, formats, index }) {
  const rows = (formats || []).filter((f) => f.ads > 0);
  return (
    <Card T={T} index={index} title="Formats" subtitle="Nombre de publicités par format, et part de la dépense qu'elles ont reçue">
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
    <Card T={T} index={index} title="Placements" subtitle="Fil, Reels, Stories… sur Facebook et Instagram, en part des impressions">
      {rows.length === 0 ? <Empty T={T}>Répartition par placement indisponible sur cette période.</Empty> : rows.map((p, i) => (
        <RankedRow key={`${p.platform}-${p.position}`} T={T} index={i} label={`${PLATFORM_LABEL[p.platform] || humanize(p.platform)} · ${POSITION_LABEL[p.position] || humanize(p.position)}`}
          sub={`${fmtInt(p.leads)} leads`} value={fmtEur(p.spend)} share={p.share} color={p.platform === 'instagram' ? T.green : T.navy} />
      ))}
    </Card>
  );
}

function PortfoliosCard({ T, portfolios, index }) {
  const rows = portfolios || [];
  const totalSpend = rows.reduce((s, p) => s + (p.spend || 0), 0);
  return (
    <Card T={T} index={index} title="Par portefeuille" subtitle="Les deux comptes publicitaires Meta, côte à côte">
      {rows.length === 0 ? <Empty T={T}>Aucun portefeuille.</Empty> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {rows.map((p, i) => (
            <div key={p.key} style={{ padding: '12px 14px', borderRadius: 14, background: T.surfaceAlt }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{p.label}</div>
              <div style={{ fontSize: 11.5, color: T.textFaint, marginBottom: 8 }}>{fmtInt(p.accounts)} compte{p.accounts > 1 ? 's' : ''}</div>
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
    if (win) {
      apiClient.get(`/api/v1/marketing/meta-ads/overview?since=${win.since}&until=${win.until}&portfolio=${portfolio}`)
        .then((r) => { if (alive) setPrev(r?.totals || null); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [period, portfolio]);

  if (loading) return <Centered T={T}>Lecture des deux portefeuilles Meta et de nos ventes…</Centered>;
  if (error?.kind === 'config') return <Centered T={T}><div style={{ fontWeight: 600, color: T.text }}>Configuration Meta en attente</div><div style={{ marginTop: 4, fontSize: 13 }}>{error.msg || 'Les tokens Meta ne sont pas encore configurés sur le serveur.'}</div></Centered>;
  if (error) return <Centered T={T}><span style={{ color: T.red }}>{error.msg}</span></Centered>;
  if (!data) return null;

  const t = data.totals || {};
  const s = data.sales || {};
  const p = prev || {};
  const roas = t.spend ? (s.ca_attributed || 0) / t.spend : null;
  const prevRoas = p.spend && prev?.sales ? (prev.sales.ca_attributed || 0) / p.spend : null;
  const salesLine = `${fmtInt(s.meta)} via une créa · ${fmtInt(s.webinaire)} webinaire · ${fmtInt(s.hors_meta)} hors Meta${s.sans_client ? ` · ${fmtInt(s.sans_client)} sans client` : ''}`;

  return (
    <div>
      {/* ── 1. L'essentiel ── */}
      <Section T={T} kicker="1 · L'essentiel" title="Ce que la période a donné" lead="Ce qu'on a dépensé sur Meta, combien de personnes on a touchées, combien de leads sont arrivés au CRM et combien de ventes ont été déclarées sur la période (le même total que le Suivi des ventes).">
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <Tile T={T} hero index={0} label="Ventes déclarées" value={fmtInt(s.total)} sub={salesLine} delta={<Delta T={{ ...T, green: '#8fd1ad', red: '#f0a396', textFaint: 'rgba(238,241,248,0.6)' }} current={s.total} previous={prev?.sales?.total} />} />
          <Tile T={T} index={1} label="Dépense" value={fmtEur(t.spend)} delta={<Delta T={T} current={t.spend} previous={p.spend} />} />
          <Tile T={T} index={2} label="Leads reçus" value={fmtInt(t.leads)} sub={t.cpl != null ? `${fmtEur2(t.cpl)} par lead` : null} delta={<Delta T={T} current={t.leads} previous={p.leads} />} />
          <Tile T={T} index={3} label="Retour sur dépense" value={fmtRoas(roas)} sub={s.ca_attributed ? `${fmtEur(s.ca_attributed)} de CA rattaché aux créas` : 'aucun CA rattaché'} delta={<Delta T={T} current={roas} previous={prevRoas} />} />
          <Tile T={T} index={4} label="Portée" value={fmtCompact(t.reach)} sub={t.frequency ? `vue ${Number(t.frequency).toFixed(1)} fois par personne` : null} delta={<Delta T={T} current={t.reach} previous={p.reach} />} />
          <Tile T={T} index={5} label="Impressions" value={fmtCompact(t.impressions)} sub={t.cpm != null ? `${fmtEur2(t.cpm)} CPM` : null} delta={<Delta T={T} current={t.impressions} previous={p.impressions} />} />
          <Tile T={T} index={6} label="Clics" value={fmtInt(t.clicks)} sub={t.ctr != null ? `${fmtPct(t.ctr, 2)} de taux de clic` : null} delta={<Delta T={T} current={t.clicks} previous={p.clicks} />} />
          <Tile T={T} index={7} label="Publicités" value={fmtInt(t.ads_count)} sub={`${fmtInt(t.ads_active)} active${t.ads_active > 1 ? 's' : ''}`} />
        </div>
        <div style={{ marginTop: 14 }}><SpendLeadsChart T={T} daily={data.daily} sales={data.sales} index={0} /></div>
      </Section>

      {/* ── 2. Ce qu'on diffuse ── */}
      <Section T={T} kicker="2 · Ce qu'on diffuse" title="Formats, placements et rythme de lancement" lead="Quels formats reçoivent la dépense, où les publicités sont montrées, combien de nouvelles publicités partent chaque semaine, et le partage entre les deux portefeuilles.">
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <FormatsCard T={T} formats={data.formats} index={0} />
          <PlacementsCard T={T} placements={data.placements} index={1} />
          <LaunchesChart T={T} launches={data.launches} index={2} />
          <PortfoliosCard T={T} portfolios={data.portfolios} index={3} />
        </div>
      </Section>

      {/* ── 3. À qui on parle ── */}
      <Section T={T} kicker="3 · À qui on parle" title="Audience touchée" lead="Qui voit les publicités : tranches d'âge, femmes et hommes, et régions. À lire avec les leads reçus pour chaque segment.">
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          <AudienceCard T={T} audience={data.audience} index={0} />
          <GeoCard T={T} geo={data.geo} index={1} />
        </div>
      </Section>

      {/* ── 4. Les ventes, une par une ── */}
      <Section T={T} kicker="4 · Vérification" title="Les ventes de la période, une par une" lead="Chaque vente déclarée, avec son origine et la créa à laquelle elle est rattachée : le total se vérifie ici contre le Suivi des ventes.">
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
