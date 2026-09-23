// src/pages/MetaAds/CreativePanel.jsx — le détail d'une créa, pour creuser.
//
// S'ouvre au clic sur une créa (onglet Créas ou onglet Campagnes au niveau
// publicité) : le visuel en grand, le score et ses composantes, l'entonnoir
// leads → R1 tenus → R2 tenus → ventes, les coûts, la recommandation, et les
// clients signés rattachés à cette créa. Si la ligne vient du tableau
// Campagnes (sans entonnoir), le panneau va chercher la créa dans le
// leaderboard de la même période.

import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import apiClient from '../../services/apiClient.js';
import CreativeThumb from './CreativeThumb.jsx';
import Pict from './icons.jsx';
import { Ring, Funnel, Pill, EASE } from './motion.jsx';
import { fmtInt, fmtEur, fmtEur2, fmtRoas, fmtDay, fmtPct } from './theme.js';

const norm = (v) => String(v || '').trim().toLowerCase();

export const RECO_TONE = {
  observer: 'navy', garder: 'muted', decliner: 'green', hook: 'amber', qualif: 'amber', noshow: 'red', couper: 'red',
};
export const toneColors = (T, tone) => ({
  green: { color: T.green, bg: T.accentBg },
  navy: { color: T.text, bg: T.navySoft },
  amber: { color: T.amber, bg: T.isDark ? 'rgba(217,163,92,0.16)' : 'rgba(185,138,58,0.12)' },
  red: { color: T.red, bg: T.isDark ? 'rgba(217,123,108,0.16)' : 'rgba(181,84,74,0.10)' },
  muted: { color: T.textMuted, bg: T.surfaceAlt },
}[tone] || { color: T.textMuted, bg: T.surfaceAlt });

export function scoreColor(score, T) {
  if (score == null) return T.textFaint;
  if (score >= 65) return T.green;
  if (score >= 40) return T.navy;
  return T.red;
}

function Block({ T, icon, title, children, sub }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Pict name={icon} size={16} color={T.accent} />
        <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.textMuted }}>{title}</h4>
        {sub && <span style={{ fontSize: 11.5, color: T.textFaint }}>{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({ T, label, value, strong }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, background: T.surfaceAlt }}>
      <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 16, fontWeight: 750, letterSpacing: '-0.02em', color: strong || T.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

export default function CreativePanel({ row, sales, period, T, onClose }) {
  const reduce = useReducedMotion();
  const [full, setFull] = useState(row);
  const [lookup, setLookup] = useState(false);

  // Ligne sans entonnoir (tableau Campagnes) : on complète depuis le leaderboard.
  useEffect(() => {
    setFull(row);
    if (!row || row.r1_fait != null) return undefined;
    let alive = true;
    setLookup(true);
    apiClient.get(`/api/v1/marketing/meta-ads/leaderboard?since=${period.since}&until=${period.until}`)
      .then((r) => {
        if (!alive) return;
        const hit = (r?.rows || []).find((x) => norm(x.name) === norm(row.name));
        if (hit) setFull({ ...row, ...hit });
      })
      .catch(() => {})
      .finally(() => { if (alive) setLookup(false); });
    return () => { alive = false; };
  }, [row, period]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mine = useMemo(() => (sales?.detail || []).filter((s) => s.attributed_to && norm(s.attributed_to) === norm(row?.name)), [sales, row]);
  if (!row) return null;
  const r = full || row;
  const hasFunnel = r.r1_fait != null;
  const leads = hasFunnel ? Math.max(r.crm_leads || 0, r.leads_meta || 0) : (r.leads ?? r.match ?? 0);
  const active = (r.status || 'active') === 'active';
  const tone = toneColors(T, RECO_TONE[r.reco?.key] || 'muted');
  const subs = r.subs ? [['Coût par lead', r.subs.cpl], ['Lead → R1 tenu', r.subs.r1], ['R1 → R2', r.subs.r2], ['Closing', r.subs.close], ['Volume', r.subs.vol]] : [];
  const ventesCa = r.ca ?? mine.reduce((s, x) => s + (x.amount || 0), 0);

  return (
    <>
      <motion.div onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(18,27,53,0.34)', zIndex: 80, backdropFilter: 'blur(2px)' }} />
      <motion.aside role="dialog" aria-label={`Détail de la créa ${r.name}`}
        initial={reduce ? { x: 0, opacity: 1 } : { x: 56, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={reduce ? { opacity: 0 } : { x: 56, opacity: 0 }}
        transition={{ duration: 0.36, ease: EASE }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 100vw)', zIndex: 81, background: T.surface, color: T.text,
          boxShadow: '-12px 0 40px rgba(18,27,53,0.18)', overflowY: 'auto', padding: '18px 22px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.accent }}>Créa</span>
          <button onClick={onClose} aria-label="Fermer" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.textMuted, cursor: 'pointer' }}>
            <Pict name="close" size={16} />
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <CreativeThumb creative={r.creative} name={r.name} size="fluid" aspect="4 / 3" radius={16} T={T} />
        </div>
        <h3 style={{ margin: '14px 0 4px', fontSize: 19, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{r.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: T.textMuted }}>
          {r.campaign_name && <span>{r.campaign_name}</span>}
          <Pill T={T} color={active ? T.green : T.textMuted} bg={active ? T.accentBg : T.surfaceAlt}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: active ? T.green : T.textFaint }} />{active ? 'Active' : 'Inactive'}
          </Pill>
          {r.confidence && <Pill T={T}>confiance {r.confidence}</Pill>}
        </div>

        {(r.score != null || lookup) && (
          <Block T={T} icon="score" title="Score" sub="0 à 100, lissé sur la période">
            {lookup && r.score == null ? <div style={{ fontSize: 12.5, color: T.textFaint }}>Recherche dans le leaderboard…</div> : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Ring value={(r.score || 0) / 100} size={72} stroke={6} color={scoreColor(r.score, T)} label={Math.round(r.score || 0)} sub="/ 100" T={T} />
                <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                  {subs.map(([label, v]) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 34px', gap: 8, alignItems: 'center', fontSize: 11.5 }}>
                      <span style={{ color: T.textMuted }}>{label}</span>
                      <div style={{ height: 6, borderRadius: 99, background: T.navySoft, overflow: 'hidden' }}>
                        <motion.div initial={reduce ? { scaleX: v } : { scaleX: 0 }} animate={{ scaleX: Math.max(0.02, v || 0) }} transition={{ duration: 0.7, ease: EASE }}
                          style={{ height: '100%', transformOrigin: 'left center', background: T.green, borderRadius: 99 }} />
                      </div>
                      <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{Math.round((v || 0) * 100)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Block>
        )}

        <Block T={T} icon="funnel" title="Entonnoir" sub={hasFunnel ? 'leads de la période' : 'leads de la période (détail CRM indisponible)'}>
          {hasFunnel ? (
            <>
              <Funnel T={T} steps={[{ label: 'Leads', value: leads }, { label: 'R1 posés', value: r.r1_pose }, { label: 'R1 tenus', value: r.r1_fait }, { label: 'R2 tenus', value: r.r2_fait }, { label: 'Ventes', value: r.ventes }]} />
              {r.r1_noshow > 0 && <div style={{ marginTop: 8, fontSize: 11.5, color: T.textFaint }}>{fmtInt(r.r1_noshow)} no-show en R1 ({fmtPct((r.r1_noshow / Math.max(1, r.r1_pose)) * 100, 0)} des R1 posés)</div>}
            </>
          ) : (
            <Funnel T={T} steps={[{ label: 'Leads Meta', value: r.leads ?? 0 }, { label: 'Retrouvés CRM', value: r.match ?? 0 }, { label: 'Ventes', value: r.ventes ?? mine.length }]} />
          )}
        </Block>

        <Block T={T} icon="spend" title="Les chiffres">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <Stat T={T} label="Dépense" value={fmtEur(r.spend)} />
            <Stat T={T} label="Coût par lead" value={fmtEur2(r.cpl)} />
            {hasFunnel ? <Stat T={T} label="Coût par R1 tenu" value={fmtEur2(r.cpr1)} /> : <Stat T={T} label="CPM" value={fmtEur2(r.cpm)} />}
            <Stat T={T} label="Ventes" value={fmtInt(r.ventes ?? mine.length)} strong={T.green} />
            <Stat T={T} label="Coût par vente" value={fmtEur(r.cac ?? (r.ventes ? r.spend / r.ventes : null))} />
            <Stat T={T} label="Retour sur dépense" value={fmtRoas(r.roas ?? (r.spend ? ventesCa / r.spend : null))} strong={(r.roas ?? 0) >= 1 ? T.green : undefined} />
          </div>
        </Block>

        {r.reco && (
          <Block T={T} icon="info" title="Recommandation">
            <div style={{ padding: '12px 14px', borderRadius: 12, background: tone.bg }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: tone.color }}>{r.reco.label}</div>
              {r.reco.detail && <div style={{ marginTop: 4, fontSize: 12.5, color: T.textMuted, lineHeight: 1.45 }}>{r.reco.detail}</div>}
              {r.reco.suggestions?.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 16, display: 'grid', gap: 4 }}>
                  {r.reco.suggestions.map((s, i) => <li key={i} style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.45 }}>{s}</li>)}
                </ul>
              )}
            </div>
          </Block>
        )}

        <Block T={T} icon="sales" title="Ventes signées" sub={`${mine.length} sur la période`}>
          {mine.length === 0 ? <div style={{ fontSize: 12.5, color: T.textFaint }}>Aucune vente déclarée rattachée à cette créa sur la période.</div> : (
            <div style={{ display: 'grid', gap: 6 }}>
              {mine.map((s) => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 10px', padding: '9px 12px', borderRadius: 12, background: T.surfaceAlt }}>
                  <span style={{ fontSize: 13, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.client || '—'} <span style={{ color: T.textFaint, fontWeight: 500 }}>{s.numero_client || ''}</span></span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: T.green }}>{fmtEur(s.amount)}</span>
                  <span style={{ fontSize: 11.5, color: T.textFaint }}>{fmtDay(s.date)} · {s.seller || 'vendeur inconnu'}</span>
                </div>
              ))}
            </div>
          )}
        </Block>
      </motion.aside>
    </>
  );
}
