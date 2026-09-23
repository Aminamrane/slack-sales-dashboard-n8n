// src/pages/MetaAds/Structure.jsx — onglet « Campagnes » : où part l'argent.
//
// La structure Meta (campagnes → ensembles de publicités → publicités) en un
// seul tableau lisible : dépense avec sa part, leads et coût par lead, leads
// retrouvés au CRM, ventes, CA et retour sur dépense. Au niveau publicité,
// un clic ouvre le détail de la créa.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import apiClient from '../../services/apiClient.js';
import CreativeThumb from './CreativeThumb.jsx';
import CreativePanel from './CreativePanel.jsx';
import KpiBar from './KpiBar.jsx';
import Pict from './icons.jsx';
import { EASE } from './motion.jsx';
import { fmtInt, fmtEur, fmtEur2, fmtRoas } from './theme.js';

const LEVELS = [
  { key: 'campaign', label: 'Campagnes', unit: 'campagne', icon: 'structure' },
  { key: 'adset', label: 'Ensembles de pub', unit: 'ensemble', icon: 'placement' },
  { key: 'ad', label: 'Publicités', unit: 'publicité', icon: 'creatives' },
];

export function previousWindow(since, until) {
  const a = new Date(`${since}T00:00:00Z`), b = new Date(`${until}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const days = Math.round((b - a) / 86400000) + 1;
  if (days < 1) return null;
  const pu = new Date(a); pu.setUTCDate(pu.getUTCDate() - 1);
  const ps = new Date(pu); ps.setUTCDate(ps.getUTCDate() - (days - 1));
  const iso = (d) => d.toISOString().slice(0, 10);
  return { since: iso(ps), until: iso(pu) };
}

function Seg({ T, value, onChange, options }) {
  return (
    <div style={{ display: 'inline-flex', padding: 3, borderRadius: 12, background: T.surface, border: `1px solid ${T.border}` }}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button key={o.key} onClick={() => onChange(o.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: on ? T.accentBg : 'transparent', color: on ? T.accent : T.textMuted, fontSize: 12.5, fontWeight: 650 }}>
            {o.icon && <Pict name={o.icon} size={14} />}{o.dot && <span style={{ width: 6, height: 6, borderRadius: 99, background: o.dot }} />}{o.label}
          </button>
        );
      })}
    </div>
  );
}

function Row({ r, level, T, maxSpend, onOpen, index }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(false);
  const active = (r.status || 'active') === 'active';
  const clickable = level === 'ad';
  const share = maxSpend ? (r.spend || 0) / maxSpend : 0;
  const td = { padding: '11px 14px', fontSize: 13.5, textAlign: 'right', color: T.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  return (
    <motion.tr onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={clickable ? () => onOpen(r) : undefined}
      initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: Math.min(index, 10) * 0.02 }}
      style={{ background: hover ? T.rowHover : 'transparent', borderTop: `1px solid ${T.borderSoft}`, cursor: clickable ? 'pointer' : 'default', transition: 'background 0.12s' }}>
      <td style={{ ...td, textAlign: 'left', position: 'sticky', left: 0, background: hover ? T.rowHover : T.surface, transition: 'background 0.12s', minWidth: 260 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 360 }}>
          {level === 'ad' && <CreativeThumb creative={r.creative} name={r.name} size={36} radius={9} T={T} />}
          {level === 'ad' && <span style={{ width: 7, height: 7, borderRadius: 99, background: active ? T.green : T.textFaint, flexShrink: 0 }} title={active ? 'Active' : 'Inactive'} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name || '—'}</div>
            {level !== 'campaign' && r.campaign_name && <div style={{ fontSize: 11.5, color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.campaign_name}</div>}
          </div>
        </div>
      </td>
      <td style={{ ...td, minWidth: 170 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <span style={{ fontWeight: 700 }}>{fmtEur(r.spend)}</span>
          <div style={{ width: 120, height: 5, borderRadius: 99, background: T.navySoft, overflow: 'hidden' }}>
            <motion.div initial={reduce ? { scaleX: share } : { scaleX: 0 }} whileInView={{ scaleX: share }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE }}
              style={{ height: '100%', transformOrigin: 'left center', background: T.navy, borderRadius: 99 }} />
          </div>
        </div>
      </td>
      <td style={{ ...td, fontWeight: 700 }}>{fmtInt(r.leads)}</td>
      <td style={td}>{fmtEur2(r.cpl)}</td>
      <td style={{ ...td, color: r.match ? T.text : T.textFaint }}>{fmtInt(r.match)}<span style={{ fontSize: 11, color: T.textFaint }}>{r.leads ? ` · ${Math.round(((r.match || 0) / r.leads) * 100)} %` : ''}</span></td>
      <td style={{ ...td, color: r.ventes ? T.green : T.textFaint, fontWeight: 750 }}>{fmtInt(r.ventes)}</td>
      <td style={td}>{fmtEur(r.ca)}</td>
      <td style={{ ...td, color: r.roas == null ? T.textFaint : r.roas >= 1 ? T.green : T.red, fontWeight: 700 }}>{fmtRoas(r.roas)}</td>
      <td style={{ ...td, width: 30, color: T.textFaint }}>{clickable && <Pict name="back" size={14} style={{ transform: 'rotate(180deg)' }} />}</td>
    </motion.tr>
  );
}

export default function Structure({ T, period }) {
  const [level, setLevel] = useState('campaign');
  const [data, setData] = useState(null);
  const [prev, setPrev] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    apiClient.get(`/api/v1/marketing/meta-ads?level=${level}&since=${period.since}&until=${period.until}`)
      .then((r) => { if (alive) setData(r); })
      .catch((e) => { if (!alive) return; setData(null); setError(e?.status === 503 ? { kind: 'config', msg: e?.data?.detail } : { kind: 'err', msg: e?.data?.detail || e?.message || 'Erreur de chargement' }); })
      .finally(() => { if (alive) setLoading(false); });
    const win = previousWindow(period.since, period.until);
    setPrev(null);
    if (win) apiClient.get(`/api/v1/marketing/meta-ads?level=${level}&since=${win.since}&until=${win.until}`).then((r) => { if (alive) setPrev(r?.totals || null); }).catch(() => {});
    return () => { alive = false; };
  }, [level, period]);

  const rows = useMemo(() => {
    let r = data?.rows || [];
    if (level === 'ad' && status !== 'all') r = r.filter((x) => (x.status || 'active') === status);
    const s = search.trim().toLowerCase();
    if (s) r = r.filter((x) => (x.name || '').toLowerCase().includes(s) || (x.campaign_name || '').toLowerCase().includes(s));
    return [...r].sort((a, b) => (b.spend || 0) - (a.spend || 0));
  }, [data, level, status, search]);
  const maxSpend = rows[0]?.spend || 0;
  const unit = LEVELS.find((l) => l.key === level)?.unit || '';
  const onOpen = useCallback((r) => setSelected(r), []);
  const onClose = useCallback(() => setSelected(null), []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <Seg T={T} value={level} onChange={(k) => { setLevel(k); setSelected(null); }} options={LEVELS} />
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textFaint, display: 'flex' }}><Pict name="search" size={15} /></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Chercher une ${unit}…`}
            style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 12, fontSize: 13, color: T.text, background: T.surface, border: `1px solid ${T.border}`, outline: 'none' }} />
        </div>
        {level === 'ad' && <Seg T={T} value={status} onChange={setStatus} options={[{ key: 'all', label: 'Toutes' }, { key: 'active', label: 'Actives', dot: T.green }, { key: 'inactive', label: 'Inactives', dot: T.textFaint }]} />}
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: T.textFaint, fontWeight: 600 }}>{rows.length} {unit}{rows.length > 1 ? 's' : ''}</span>
      </div>

      {!loading && !error && data?.totals && <KpiBar totals={data.totals} sales={data.sales} previous={prev} T={T} loading={false} />}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.shadow, overflow: 'hidden' }}>
        {loading && <Centered T={T}><Pict name="structure" size={24} color={T.accent} /><div style={{ marginTop: 10, fontWeight: 600, color: T.text }}>Lecture de Meta…</div></Centered>}
        {!loading && error?.kind === 'config' && <Centered T={T}><div style={{ fontWeight: 600, color: T.text }}>Configuration Meta en attente</div><div style={{ marginTop: 4, fontSize: 13 }}>{error.msg}</div></Centered>}
        {!loading && error?.kind === 'err' && <Centered T={T}><span style={{ color: T.red }}>{error.msg}</span></Centered>}
        {!loading && !error && rows.length === 0 && <Centered T={T}>Aucune donnée sur cette période.</Centered>}
        {!loading && !error && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr>
                  {[['NOM', 'left'], ['DÉPENSE', 'right'], ['LEADS', 'right'], ['COÛT / LEAD', 'right'], ['RETROUVÉS CRM', 'right'], ['VENTES', 'right'], ['CA', 'right'], ['ROAS', 'right'], ['', 'right']].map(([h, al], i) => (
                    <th key={h || 'x'} style={{ textAlign: al, padding: '11px 14px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: T.textFaint, whiteSpace: 'nowrap', position: i === 0 ? 'sticky' : 'static', left: 0, background: T.surface }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{rows.map((r, i) => <Row key={(r.name || '') + i} r={r} level={level} T={T} maxSpend={maxSpend} onOpen={onOpen} index={i} />)}</tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && <CreativePanel key={selected.name} row={selected} sales={data?.sales} period={period} T={T} onClose={onClose} />}
      </AnimatePresence>
    </div>
  );
}

function Centered({ T, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '56px 20px', color: T.textMuted, fontSize: 14 }}>{children}</div>;
}
