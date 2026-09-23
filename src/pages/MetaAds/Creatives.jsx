// src/pages/MetaAds/Creatives.jsx — onglet « Créas » : qu'est-ce qui vend,
// qu'est-ce qui brûle du budget.
//
// Lit `GET /marketing/meta-ads/leaderboard` (funnel CRM par créa, score
// composite, ventes de la période rattachées). Le total de ventes de la
// période ouvre l'onglet ; un podium met en avant les trois premières créas
// selon le tri choisi ; la liste donne, pour chaque créa, l'entonnoir, la
// dépense, le coût par vente et la recommandation ; un clic ouvre le détail.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import apiClient from '../../services/apiClient.js';
import CreativeThumb from './CreativeThumb.jsx';
import CreativePanel, { RECO_TONE, toneColors, scoreColor } from './CreativePanel.jsx';
import Pict from './icons.jsx';
import { CountUp, Ring, Funnel, Pill, EASE } from './motion.jsx';
import { fmtInt, fmtEur, fmtEur2, fmtRoas } from './theme.js';

const nf = new Intl.NumberFormat('fr-FR');
const SORTS = [
  { key: 'score', label: 'Score', get: (r) => r.score ?? -1 },
  { key: 'ventes', label: 'Ventes', get: (r) => (r.ventes || 0) * 1e6 + (r.score || 0) },
  { key: 'spend', label: 'Dépense', get: (r) => r.spend || 0 },
  { key: 'cpl', label: 'Coût par lead', get: (r) => (r.cpl == null ? Infinity : r.cpl), asc: true },
];

function Segmented({ T, value, onChange, options, icon }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', padding: 3, borderRadius: 12, background: T.surface, border: `1px solid ${T.border}` }}>
      {icon && <span style={{ display: 'inline-flex', padding: '0 6px 0 8px', color: T.textFaint }}><Pict name={icon} size={14} /></span>}
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button key={o.key} onClick={() => onChange(o.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: on ? T.accentBg : 'transparent', color: on ? T.accent : T.textMuted, fontSize: 12.5, fontWeight: 650 }}>
            {o.dot && <span style={{ width: 6, height: 6, borderRadius: 99, background: o.dot }} />}{o.label}
          </button>
        );
      })}
    </div>
  );
}

function RecoPill({ reco, T }) {
  if (!reco) return null;
  const tone = toneColors(T, RECO_TONE[reco.key] || 'muted');
  return <Pill T={T} color={tone.color} bg={tone.bg} style={{ maxWidth: '100%' }} title={reco.detail}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{reco.label}</span></Pill>;
}

function ConfDots({ confidence, T }) {
  const n = confidence === 'haute' ? 3 : confidence === 'moyenne' ? 2 : 1;
  return (
    <span title={`Confiance ${confidence || 'faible'} (volume de leads)`} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => <span key={i} style={{ width: 5, height: 5, borderRadius: 99, background: i < n ? T.accent : T.navySoft }} />)}
    </span>
  );
}

function PodiumCard({ r, rank, T, onOpen, index }) {
  const reduce = useReducedMotion();
  const active = (r.status || 'active') === 'active';
  return (
    <motion.button onClick={() => onOpen(r)} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06 * index, ease: EASE }}
      whileHover={reduce ? undefined : { y: -3 }}
      style={{ textAlign: 'left', cursor: 'pointer', padding: 14, borderRadius: 18, border: `1px solid ${rank === 1 ? T.accentSoft : T.border}`, background: T.surface, boxShadow: T.shadow, color: T.text, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ position: 'relative' }}>
        <CreativeThumb creative={r.creative} name={r.name} size="fluid" aspect="4 / 3" radius={13} T={T} />
        <span style={{ position: 'absolute', top: 10, left: 10, width: 28, height: 28, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: rank === 1 ? T.green : T.navy, color: '#fff', boxShadow: '0 2px 8px rgba(18,27,53,0.25)' }}>{rank}</span>
        <span style={{ position: 'absolute', top: 12, right: 12, width: 9, height: 9, borderRadius: 99, background: active ? T.green : T.textFaint, boxShadow: '0 0 0 3px rgba(255,255,255,0.85)' }} title={active ? 'Active' : 'Inactive'} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 750, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</div>
          <div style={{ fontSize: 12, color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.campaign_name || ''}</div>
        </div>
        <Ring value={(r.score || 0) / 100} size={54} stroke={5} color={scoreColor(r.score, T)} label={Math.round(r.score || 0)} T={T} delay={0.1 * index} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {[['Ventes', fmtInt(r.ventes), r.ventes ? T.green : undefined], ['Coût / vente', fmtEur(r.cac)], ['Leads', fmtInt(Math.max(r.crm_leads || 0, r.leads_meta || 0))], ['Coût / lead', fmtEur2(r.cpl)]].map(([k, v, c]) => (
          <div key={k} style={{ padding: '8px 9px', borderRadius: 10, background: T.surfaceAlt, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: T.textFaint, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</div>
            <div style={{ fontSize: 14, fontWeight: 750, color: c || T.text, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
          </div>
        ))}
      </div>
      <RecoPill reco={r.reco} T={T} />
    </motion.button>
  );
}

function CreativeRow({ r, rank, T, onOpen, index }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(false);
  const active = (r.status || 'active') === 'active';
  const leads = Math.max(r.crm_leads || 0, r.leads_meta || 0);
  return (
    <motion.div role="button" tabIndex={0} onClick={() => onOpen(r)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(r); } }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      initial={reduce ? false : { opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.03, ease: EASE }}
      style={{ display: 'grid', gridTemplateColumns: '28px 52px minmax(180px, 1.4fr) 44px minmax(220px, 1.6fr) 110px 110px 74px minmax(130px, 0.9fr)', gap: 14, alignItems: 'center',
        padding: '12px 16px', borderTop: `1px solid ${T.borderSoft}`, background: hover ? T.rowHover : 'transparent', cursor: 'pointer', transition: 'background 0.12s', outline: 'none' }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: T.textFaint, fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
      <CreativeThumb creative={r.creative} name={r.name} size={52} radius={11} T={T} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: active ? T.green : T.textFaint, flexShrink: 0 }} title={active ? 'Active' : 'Inactive'} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</span>
          <ConfDots confidence={r.confidence} T={T} />
        </div>
        <div style={{ fontSize: 11.5, color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{r.campaign_name || ''}</div>
      </div>
      <Ring value={(r.score || 0) / 100} size={44} stroke={4} color={scoreColor(r.score, T)} label={Math.round(r.score || 0)} T={T} />
      <Funnel T={T} compact steps={[{ label: 'Leads', value: leads }, { label: 'R1 tenus', value: r.r1_fait }, { label: 'R2', value: r.r2_fait }, { label: 'Ventes', value: r.ventes }]} />
      <div style={{ fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{fmtEur(r.spend)}</div>
        <div style={{ fontSize: 11.5, color: T.textFaint }}>{fmtEur2(r.cpl)} / lead</div>
      </div>
      <div style={{ fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ fontSize: 13.5, fontWeight: 750, color: r.ventes ? T.green : T.textFaint }}>{fmtInt(r.ventes)} vente{r.ventes > 1 ? 's' : ''}</div>
        <div style={{ fontSize: 11.5, color: T.textFaint }}>{r.cac != null ? `${fmtEur(r.cac)} / vente` : 'pas de vente'}</div>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: r.roas == null ? T.textFaint : r.roas >= 1 ? T.green : T.red, fontVariantNumeric: 'tabular-nums' }}>{fmtRoas(r.roas)}</div>
      <RecoPill reco={r.reco} T={T} />
    </motion.div>
  );
}

function VariantSuggestions({ rows, T }) {
  const [open, setOpen] = useState(false);
  const candidates = rows.filter((r) => r.reco?.key === 'decliner' && r.reco.suggestions?.length);
  if (!candidates.length) return null;
  return (
    <div style={{ marginTop: 18, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.shadow, overflow: 'hidden' }}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '15px 18px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: T.text }}>
        <span style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.accentBg, color: T.accent }}><Pict name="launch" size={17} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>Variantes à décliner <span style={{ color: T.textMuted, fontWeight: 600 }}>· {candidates.length} créa{candidates.length > 1 ? 's' : ''}</span></div>
          <div style={{ fontSize: 12, color: T.textFaint }}>Pistes de déclinaison pour les créas qui marchent. Rien n'est créé automatiquement.</div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', color: T.textMuted }}><Pict name="back" size={16} style={{ transform: 'rotate(-90deg)' }} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: EASE }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '4px 18px 18px', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              {candidates.map((r) => (
                <div key={r.name} style={{ padding: 14, borderRadius: 12, background: T.surfaceAlt }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>#{r.rank} {r.name}</div>
                  <ul style={{ margin: 0, paddingLeft: 16, display: 'grid', gap: 5 }}>
                    {r.reco.suggestions.map((s, i) => <li key={i} style={{ fontSize: 12.5, lineHeight: 1.45, color: T.textMuted }}>{s}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SalesBanner({ sales, T, icon = 'sales', note = 'même total que le Suivi des ventes' }) {
  if (!sales) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
      style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '16px 20px', marginBottom: 16, borderRadius: 18, background: T.navy, color: '#eef1f8', boxShadow: T.shadow }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.10)' }}><Pict name={icon} size={20} color="#8fd1ad" /></span>
      <div style={{ fontSize: 28, fontWeight: 750, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}><CountUp value={sales.total || 0} format={(v) => nf.format(Math.round(v))} /></div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 650 }}>ventes déclarées sur la période</div>
        <div style={{ fontSize: 12.5, color: 'rgba(238,241,248,0.72)', marginTop: 2 }}>{nf.format(sales.meta || 0)} via une créa · {nf.format(sales.webinaire || 0)} webinaire · {nf.format(sales.hors_meta || 0)} hors Meta{sales.sans_client ? ` · ${sales.sans_client} sans client` : ''}</div>
      </div>
      <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(238,241,248,0.55)' }}>{note}</div>
    </motion.div>
  );
}

export default function Creatives({ T, period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('score');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await apiClient.get(`/api/v1/marketing/meta-ads/leaderboard?since=${period.since}&until=${period.until}`);
      setData(r);
    } catch (e) {
      setData(null);
      if (e?.status === 503) setError({ kind: 'config', msg: e?.data?.detail || 'Configuration Meta en attente.' });
      else setError({ kind: 'err', msg: e?.data?.detail || e?.message || 'Erreur de chargement' });
    } finally { setLoading(false); }
  }, [period]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const rows = useMemo(() => {
    let r = data?.rows || [];
    if (status !== 'all') r = r.filter((x) => (x.status || 'active') === status);
    const s = search.trim().toLowerCase();
    if (s) r = r.filter((x) => (x.name || '').toLowerCase().includes(s) || (x.campaign_name || '').toLowerCase().includes(s));
    const def = SORTS.find((x) => x.key === sort) || SORTS[0];
    r = [...r].sort((a, b) => (def.asc ? def.get(a) - def.get(b) : def.get(b) - def.get(a)));
    return r;
  }, [data, status, search, sort]);

  const onOpen = useCallback((r) => setSelected(r), []);
  const onClose = useCallback(() => setSelected(null), []);

  if (loading) return <Centered T={T}><Pict name="creatives" size={26} color={T.accent} /><div style={{ marginTop: 10, fontWeight: 600, color: T.text }}>Lecture des créas</div><div style={{ marginTop: 4, fontSize: 13 }}>Meta et le CRM sont interrogés, une minute la première fois.</div></Centered>;
  if (error?.kind === 'config') return <Centered T={T}><div style={{ fontWeight: 600, color: T.text }}>Configuration Meta en attente</div><div style={{ marginTop: 4, fontSize: 13 }}>{error.msg}</div></Centered>;
  if (error) return <Centered T={T}><span style={{ color: T.red }}>{error.msg}</span></Centered>;

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div>
      <SalesBanner sales={data?.sales} T={T} />

      {/* barre de contrôle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textFaint, display: 'flex' }}><Pict name="search" size={15} /></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher une créa ou une campagne…"
            style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 12, fontSize: 13, color: T.text, background: T.surface, border: `1px solid ${T.border}`, outline: 'none' }} />
        </div>
        <Segmented T={T} icon="sort" value={sort} onChange={setSort} options={SORTS.map((s) => ({ key: s.key, label: s.label }))} />
        <Segmented T={T} icon="active" value={status} onChange={setStatus} options={[{ key: 'all', label: 'Toutes' }, { key: 'active', label: 'Actives', dot: T.green }, { key: 'inactive', label: 'Inactives', dot: T.textFaint }]} />
        <span style={{ fontSize: 12.5, color: T.textFaint, fontWeight: 600, marginLeft: 'auto' }}>{rows.length} créa{rows.length > 1 ? 's' : ''}</span>
      </div>

      {rows.length === 0 ? <Centered T={T}>Aucune créa sur cette période avec ces filtres.</Centered> : (
        <>
          {/* podium */}
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: 18 }}>
            {podium.map((r, i) => <PodiumCard key={r.name} r={r} rank={i + 1} T={T} onOpen={onOpen} index={i} />)}
          </div>

          {/* liste */}
          {rest.length > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.shadow, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px' }}>
                <Pict name="creatives" size={16} color={T.accent} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>Toutes les créas</span>
                <span style={{ fontSize: 12, color: T.textFaint }}>cliquer une ligne pour creuser</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 1120 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '28px 52px minmax(180px, 1.4fr) 44px minmax(220px, 1.6fr) 110px 110px 74px minmax(130px, 0.9fr)', gap: 14, padding: '6px 16px 8px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: T.textFaint, textTransform: 'uppercase' }}>
                    <span>#</span><span /><span>Créa</span><span>Score</span><span>Entonnoir</span><span>Dépense</span><span>Ventes</span><span>ROAS</span><span>Reco</span>
                  </div>
                  {rest.map((r, i) => <CreativeRow key={r.name} r={r} rank={i + 4} T={T} onOpen={onOpen} index={i} />)}
                </div>
              </div>
            </div>
          )}

          <VariantSuggestions rows={rows} T={T} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '0 4px', color: T.textFaint, fontSize: 12, lineHeight: 1.5 }}>
            <Pict name="info" size={14} style={{ marginTop: 2 }} />
            <span>Score 0 à 100 : 25 % coût par lead face à la médiane, 30 % lead → R1 tenu, 15 % R1 → R2, 20 % closing, 10 % volume ; taux lissés vers la moyenne de la période pour ne pas surclasser les petites créas (les points = confiance). R1 et R2 viennent des leads de la période ; les ventes sont les déclarations de la période rattachées à la créa d'origine du lead.</span>
          </div>
        </>
      )}

      <AnimatePresence>
        {selected && <CreativePanel key={selected.name} row={selected} sales={data?.sales} period={period} T={T} onClose={onClose} />}
      </AnimatePresence>
    </div>
  );
}

function Centered({ T, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '64px 20px', color: T.textMuted, fontSize: 14 }}>{children}</div>;
}
